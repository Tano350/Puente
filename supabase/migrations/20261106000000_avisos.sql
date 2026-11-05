-- Avisos push. La base decide a quién avisar y lo deja en public.avisos; la función "avisos" los manda con Web Push.
-- Qué se avisa: evento nuevo al que te puedes sumar, cambio o cancelación de un evento al que vas, saliste de la lista
-- de espera, recordatorio una hora antes (con la dirección), te asignaron un contacto y alguien marcó que te pagó.
-- Nunca a quien hizo la acción, a quien sacaron del grupo, a quien apagó ese tipo de aviso ni a quien no tiene
-- dispositivos con los avisos activados.
--
-- Los avisos esperan 10 segundos antes de salir, para que "Deshacer" (6 segundos en la app) alcance a anularlos: al
-- mandarlo, la función revisa que siga teniendo sentido (el pago no se deshizo, el cambio no volvió atrás, sigues en
-- el evento…). Los triggers son baratos y nunca hacen fallar lo que hizo la persona: si algo sale mal, solo avisan
-- en el registro de la base.
--
-- Para cargar datos en bloque sin avisar a nadie (por ejemplo, el Excel de contactos), en la misma transacción:
--   select set_config('puente.sin_avisos', 'si', true);
--
-- Para encenderlo, en este orden (lo que va en Vault y en los secretos nunca va en el repositorio):
-- 1. Secretos de la función: VAPID_PUBLIC_KEY (el mismo valor que VITE_VAPID_PUBLIC_KEY), VAPID_PRIVATE_KEY,
--    VAPID_SUBJECT (https://puente-2027.vercel.app) y AVISOS_CLAVE (nueva, al azar):
--      npx supabase secrets set --env-file <archivo temporal>
-- 2. Publicar la función:  npx supabase functions deploy avisos --no-verify-jwt --use-api
-- 3. Aplicar esta migración. Desde ahí se encolan avisos, pero nadie los manda todavía.
-- 4. Crear en Vault la dirección y la clave; con eso los triggers y el reloj despiertan a la función:
--      select vault.create_secret('https://<ref>.supabase.co/functions/v1/avisos', 'avisos_url');
--      select vault.create_secret('<AVISOS_CLAVE>', 'avisos_clave');
--    Lo encolado antes de este paso sale solo si todavía tiene sentido y tiene menos de un día.

create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  persona uuid not null references public.personas (id) on delete cascade,
  tipo text not null check (tipo in ('eventos', 'cambios', 'espera', 'recordatorio', 'contacto', 'pago')),
  -- Si se borra lo avisado (por ejemplo, al deshacer un evento recién creado), el aviso pendiente desaparece
  evento uuid references public.eventos (id) on delete cascade,
  contacto uuid references public.contactos (id) on delete cascade,
  pago uuid references public.pagos (id) on delete cascade,
  -- cambios: cómo era el evento antes ({"antes": {titulo, lugar, direccion, inicio, fin}}).
  -- contacto: quién lo tenía antes ({"antes": persona}), para reconocer un "Deshacer".
  datos jsonb,
  creado_en timestamptz not null default now(),
  -- Desde cuándo puede salir: la espera de 10 segundos para "Deshacer"
  sale_en timestamptz not null default now() + interval '10 seconds',
  -- Una vuelta de la función lo toma hasta esa hora; así dos vueltas a la vez no mandan lo mismo
  reclamado_hasta timestamptz,
  intentos int not null default 0,
  enviado_en timestamptz,
  -- Por qué no se mandó (ya no tenía sentido o no quedaban dispositivos)
  descartado text,
  ultimo_error text,
  constraint con_lo_avisado check (
    case tipo
      when 'contacto' then contacto is not null
      when 'pago' then pago is not null
      else evento is not null
    end
  )
);

-- Lo que falta mandar, por orden de salida
create index avisos_pendientes on public.avisos (sale_en) where enviado_en is null and descartado is null;
create index avisos_persona on public.avisos (persona);
create index avisos_evento on public.avisos (evento) where evento is not null;
create index avisos_contacto on public.avisos (contacto) where contacto is not null;
create index avisos_pago on public.avisos (pago) where pago is not null;
-- Nunca dos recordatorios del mismo evento a la misma persona
create unique index avisos_un_recordatorio on public.avisos (evento, persona) where tipo = 'recordatorio';

-- Sin políticas ni permisos: solo la base y la función los ven
alter table public.avisos enable row level security;
revoke all on public.avisos from public, anon, authenticated;

-- ¿Está pausado para esta transacción? (cargas en bloque)
create function public.avisos_en_pausa()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('puente.sin_avisos', true), '') = 'si'
$$;

-- ¿Le llega este tipo de aviso? Sigue en Puente, no lo apagó (si falta la clave, cuenta como encendido) y tiene al
-- menos un dispositivo con los avisos activados
create function public.quiere_aviso(persona uuid, tipo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.personas p
     where p.id = quiere_aviso.persona
       and p.sacada_en is null
       and (p.avisos -> quiere_aviso.tipo) is distinct from 'false'::jsonb
       and exists (select 1 from public.suscripciones s where s.persona = p.id)
  )
$$;

-- Llama a la función "avisos" (una vez por transacción). Sin avisos_url y avisos_clave en Vault no llama a nadie:
-- lo encolado espera. pg_net manda el pedido recién cuando la transacción termina bien.
create function public.despertar_avisos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  direccion text;
  clave text;
begin
  if coalesce(current_setting('puente.avisos_despiertos', true), '') = 'si' then return; end if;
  select s.decrypted_secret into direccion from vault.decrypted_secrets s where s.name = 'avisos_url';
  select s.decrypted_secret into clave from vault.decrypted_secrets s where s.name = 'avisos_clave';
  if direccion is null or clave is null then return; end if;
  perform net.http_post(
    url := direccion,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || clave),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  perform set_config('puente.avisos_despiertos', 'si', true);
end;
$$;

-- Encola un aviso para una persona, si le corresponde, y despierta a la función
create function public.encolar_aviso(persona uuid, tipo text, evento uuid default null, contacto uuid default null,
  pago uuid default null, datos jsonb default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if encolar_aviso.persona is null
     or encolar_aviso.persona is not distinct from public.mi_persona()
     or not public.quiere_aviso(encolar_aviso.persona, encolar_aviso.tipo) then
    return false;
  end if;
  insert into public.avisos (persona, tipo, evento, contacto, pago, datos)
  values (encolar_aviso.persona, encolar_aviso.tipo, encolar_aviso.evento, encolar_aviso.contacto, encolar_aviso.pago, encolar_aviso.datos);
  perform public.despertar_avisos();
  return true;
end;
$$;

-- Evento nuevo al que te puedes sumar: a quienes están allá ese día y no están ya en él (los cerrados no se anuncian)
create function public.avisar_evento_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  begin
    if public.avisos_en_pausa() or new.modo = 'cerrado' or new.cancelado_en is not null or new.inicio <= now() then
      return null;
    end if;
    insert into public.avisos (persona, tipo, evento)
    select p.id, 'eventos', new.id
      from public.personas p
     where p.sacada_en is null
       and public.esta_alla(p.id, new.inicio)
       and p.id is distinct from new.creado_por
       and p.id is distinct from new.organizador
       and p.id is distinct from public.mi_persona()
       and not exists (select 1 from public.asistentes a where a.evento = new.id and a.persona = p.id)
       and public.quiere_aviso(p.id, 'eventos');
    get diagnostics n = row_count;
    if n > 0 then perform public.despertar_avisos(); end if;
  exception when others then
    raise warning 'Puente no pudo preparar los avisos del evento nuevo %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

create trigger avisar_evento_nuevo
after insert on public.eventos
for each row execute function public.avisar_evento_nuevo();

-- Cambio o cancelación de un evento al que vas. Si ya había un aviso de cambio esperando su salida, se junta con ese:
-- guarda cómo era el evento antes del primer cambio, así "Deshacer" lo deja sin nada que avisar.
create function public.avisar_cambio_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if public.avisos_en_pausa() or old.cancelado_en is not null or new.fin <= now() then return null; end if;
    -- Quien hace el cambio ya ve cómo quedó: si tenía un aviso de un cambio anterior esperando, sobra
    delete from public.avisos v
     where v.tipo = 'cambios' and v.evento = new.id and v.persona = public.mi_persona()
       and v.enviado_en is null and v.descartado is null and v.intentos = 0;
    with destinatarios as (
      select a.persona from public.asistentes a
       where a.evento = new.id and a.estado = 'va'
         and a.persona is distinct from public.mi_persona()
         and public.quiere_aviso(a.persona, 'cambios')
    ),
    juntados as (
      update public.avisos v set sale_en = now() + interval '10 seconds'
        from destinatarios d
       where v.persona = d.persona and v.tipo = 'cambios' and v.evento = new.id
         and v.enviado_en is null and v.descartado is null and v.intentos = 0
      returning v.persona
    )
    insert into public.avisos (persona, tipo, evento, datos)
    select d.persona, 'cambios', new.id,
           jsonb_build_object('antes', jsonb_build_object(
             'titulo', old.titulo, 'lugar', old.lugar, 'direccion', old.direccion, 'inicio', old.inicio, 'fin', old.fin))
      from destinatarios d
     where not exists (select 1 from juntados j where j.persona = d.persona);
    -- También si solo se juntó con uno que esperaba: su salida se corrió
    if exists (
      select 1 from public.avisos v
       where v.tipo = 'cambios' and v.evento = new.id and v.enviado_en is null and v.descartado is null and v.intentos = 0
    ) then
      perform public.despertar_avisos();
    end if;
  exception when others then
    raise warning 'Puente no pudo preparar los avisos del cambio en el evento %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

create trigger avisar_cambio_evento
after update of titulo, lugar, direccion, inicio, fin, cancelado_en on public.eventos
for each row
when (
  old.titulo is distinct from new.titulo or old.lugar is distinct from new.lugar or old.direccion is distinct from new.direccion
  or old.inicio is distinct from new.inicio or old.fin is distinct from new.fin
  or (old.cancelado_en is null and new.cancelado_en is not null)
)
execute function public.avisar_cambio_evento();

-- Saliste de la lista de espera (por ejemplo, porque alguien soltó su cupo y llenar_cupos te hizo entrar)
create function public.avisar_salida_de_espera()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if public.avisos_en_pausa() then return null; end if;
    if exists (select 1 from public.eventos e where e.id = new.evento and e.cancelado_en is null and e.inicio > now()) then
      perform public.encolar_aviso(new.persona, 'espera', evento => new.evento);
    end if;
  exception when others then
    raise warning 'Puente no pudo preparar el aviso de la lista de espera del evento %: %', new.evento, sqlerrm;
  end;
  return null;
end;
$$;

create trigger avisar_salida_de_espera
after update of estado on public.asistentes
for each row
when (old.estado = 'espera' and new.estado = 'va')
execute function public.avisar_salida_de_espera();

-- Te asignaron un contacto, salvo que te lo asignaras tú. Un aviso de contacto que espera su salida queda obsoleto
-- si el contacto cambia otra vez; si vuelve a quien lo tenía antes, fue "Deshacer" y no se avisa nada.
create function public.avisar_contacto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pendientes int := 0;
  revierte boolean;
  previo uuid;
begin
  begin
    if public.avisos_en_pausa() then return null; end if;
    if tg_op = 'UPDATE' then
      if new.responsable is not distinct from old.responsable then return null; end if;
      with borrados as (
        delete from public.avisos v
         where v.tipo = 'contacto' and v.contacto = new.id
           and v.enviado_en is null and v.descartado is null and v.intentos = 0
        returning (v.datos ->> 'antes')::uuid as antes
      )
      select count(*), coalesce(bool_or(b.antes = new.responsable), false), (array_agg(b.antes))[1]
        into pendientes, revierte, previo
        from borrados b;
      if revierte then return null; end if;
      if pendientes = 0 then previo := old.responsable; end if;
    elsif new.responsable = new.creado_por then
      return null;
    end if;
    perform public.encolar_aviso(new.responsable, 'contacto', contacto => new.id, datos => jsonb_build_object('antes', previo));
  exception when others then
    raise warning 'Puente no pudo preparar el aviso del contacto %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

create trigger avisar_contacto
after insert or update of responsable on public.contactos
for each row execute function public.avisar_contacto();

-- Alguien marcó que te pagó
create function public.avisar_pago()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if public.avisos_en_pausa() then return null; end if;
    perform public.encolar_aviso(new.a, 'pago', pago => new.id);
  exception when others then
    raise warning 'Puente no pudo preparar el aviso del pago %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

create trigger avisar_pago
after insert on public.pagos
for each row execute function public.avisar_pago();

-- El reloj, cada 5 minutos: encola el recordatorio de los eventos que empiezan dentro de la próxima hora (una vez por
-- evento y persona), borra los avisos de hace más de 30 días y, si queda algo por mandar (o por reintentar),
-- despierta a la función.
create function public.reloj_de_avisos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.avisos (persona, tipo, evento, sale_en)
  select a.persona, 'recordatorio', e.id, now()
    from public.eventos e
    join public.asistentes a on a.evento = e.id and a.estado = 'va'
   where e.cancelado_en is null
     and e.inicio > now() and e.inicio <= now() + interval '1 hour'
     and public.quiere_aviso(a.persona, 'recordatorio')
  on conflict (evento, persona) where tipo = 'recordatorio' do nothing;

  delete from public.avisos v where v.creado_en < now() - interval '30 days';

  -- Cinco intentos como máximo, igual que en la función
  if exists (select 1 from public.avisos v where v.enviado_en is null and v.descartado is null and v.intentos < 5) then
    perform public.despertar_avisos();
  end if;
end;
$$;

revoke all on function public.avisos_en_pausa(), public.quiere_aviso(uuid, text), public.despertar_avisos(),
  public.encolar_aviso(uuid, text, uuid, uuid, uuid, jsonb), public.avisar_evento_nuevo(), public.avisar_cambio_evento(),
  public.avisar_salida_de_espera(), public.avisar_contacto(), public.avisar_pago(), public.reloj_de_avisos()
  from public, anon, authenticated;

-- El reloj. Con el mismo nombre, volver a programarlo reemplaza el anterior.
-- pg_cron y pg_net ya están instalados (20261104030000_calendario.sql). No se vuelven a crear: "create extension
-- pg_cron" dispara un ajuste de permisos de Supabase que falla ("dependent privileges exist") por los permisos que
-- esa migración le dio a postgres sobre las tablas de cron.
select cron.schedule('avisos', '*/5 * * * *', $$select public.reloj_de_avisos()$$);
