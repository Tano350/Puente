-- Intereses: temas de interés (por ejemplo «Fintech» o «IA») a los que se suma quien quiera, y eventos que van
-- primero a los de un tema.
--
-- TEMAS: cualquiera crea uno y queda dentro. Cada uno se suma («Me interesa») o sale («Ya no me interesa») cuando
-- quiere, y puede estar en varios; nadie suma a otra persona. Cambian y borran el tema quien lo creó y quien
-- administra. Borrar deja la marca borrado_en y se puede deshacer (devolver_tema); la app esconde los borrados.
--
-- EVENTOS PRIMERO PARA UN TEMA: un evento "para todos" o "con cupo" puede llevar un tema. Mientras abierto_en esté
-- vacío, solo los de ese tema pueden sumarse por su cuenta (ir, esperar); los demás lo ven. Quien organiza (o quien
-- administra) lo abre a todos llenando abierto_en (la base pone su propia hora), y desde ahí es un evento normal. Quien organiza va siempre y suma
-- a quien quiera a mano, como en cualquier evento. El tema se elige al crear el evento; mientras siga cerrado se puede
-- cambiar por otro, y una vez abierto no se vuelve a cerrar (salvo "Deshacer", dentro del primer minuto).
-- Borrar un tema abre a todos sus eventos sin abrir, con la misma hora del borrado: así devolver_tema reconoce cuáles
-- abrió y los vuelve a cerrar si todavía no pasa un minuto.
--
-- Todos los invitados ven todo. Los temas y los interesados se escriben solo con estas funciones; el tema y la
-- apertura de un evento se cambian como el resto del evento (quien organiza o quien administra), con las reglas de
-- revisar_primero_para. Los avisos van en su propia migración (20261124010000_avisos_de_intereses.sql).

create table public.temas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> '' and char_length(nombre) <= 40),
  -- De qué se trata, en una línea (opcional)
  de_que_trata text check (de_que_trata is null or char_length(de_que_trata) <= 160),
  creado_por uuid not null default public.mi_persona() references public.personas (id),
  creado_en timestamptz not null default now(),
  -- Borrado; se puede deshacer
  borrado_en timestamptz
);

-- Dos temas vigentes no se llaman igual, sin importar mayúsculas ni espacios de más
create unique index temas_nombre on public.temas (lower(btrim(nombre))) where borrado_en is null;

create table public.interesados (
  tema uuid not null references public.temas (id) on delete cascade,
  persona uuid not null references public.personas (id),
  desde timestamptz not null default now(),
  primary key (tema, persona)
);

create index interesados_persona on public.interesados (persona);

alter table public.eventos
  add column tema uuid references public.temas (id),
  -- Cuándo se abrió a todos. Con tema y sin esta hora, el evento es solo para los de ese tema.
  add column abierto_en timestamptz,
  add constraint tema_sin_cerrado check (tema is null or modo <> 'cerrado');

create index eventos_tema on public.eventos (tema) where tema is not null;

-- ¿Es todavía solo para los de su tema? (recibe columnas sueltas y no la fila: una función que recibe la fila de un
-- evento se vería en la API como una columna más)
create function public.solo_para_tema(tema uuid, abierto_en timestamptz, modo public.modo_evento)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select solo_para_tema.tema is not null and solo_para_tema.abierto_en is null and solo_para_tema.modo <> 'cerrado'
$$;

-- ¿Le interesa ese tema a esa persona?
create function public.le_interesa(tema uuid, persona uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.interesados i where i.tema = le_interesa.tema and i.persona = le_interesa.persona)
$$;

-- Reglas del tema y de la apertura de un evento (lo demás del evento lo revisan sus políticas)
create function public.revisar_primero_para()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Lo que entra sin persona (respaldo.recuperar, el editor SQL) no se revisa: un evento de la copia diaria puede ser
    -- de un tema que se borró después, y eso no debe impedir recuperarlo (ni hacer fallar la recuperación entera)
    if new.tema is not null and public.mi_persona() is not null
       and not exists (select 1 from public.temas t where t.id = new.tema and t.borrado_en is null) then
      raise exception 'Ese tema ya no está.' using errcode = '22023', hint = 'tema';
    end if;
    return new;
  end if;

  -- Se abre con la hora de la base, no con la del teléfono (que puede estar adelantada o atrasada, o mandar tarde lo
  -- que se hizo sin señal): así el minuto de "Deshacer" se mide con un solo reloj. borrar_tema usa esta misma hora.
  if old.abierto_en is null and new.abierto_en is not null then
    new.abierto_en := now();
  end if;

  if new.tema is distinct from old.tema then
    if new.tema is null then
      -- Sacar el tema solo sirve al pasarlo a cerrado; para que sea de todos se abre (y así se avisa a los demás)
      if new.modo <> 'cerrado' and old.abierto_en is null and old.tema is not null then
        raise exception 'Para que sea para todos, ábrelo a todos.' using errcode = '22023', hint = 'tema';
      end if;
    elsif old.tema is null then
      raise exception 'El tema se elige al crear el evento.' using errcode = '22023', hint = 'tema';
    elsif old.abierto_en is not null then
      raise exception 'Ese evento ya es para todos.' using errcode = '22023', hint = 'abierto';
    elsif not exists (select 1 from public.temas t where t.id = new.tema and t.borrado_en is null) then
      raise exception 'Ese tema ya no está.' using errcode = '22023', hint = 'tema';
    end if;
  end if;

  -- Una vez abierto no se vuelve a cerrar, salvo "Deshacer" dentro del primer minuto
  if old.abierto_en is not null and new.abierto_en is null and old.abierto_en < now() - interval '1 minute' then
    raise exception 'Ese evento ya es para todos.' using errcode = '22023', hint = 'abierto';
  end if;
  return new;
end;
$$;

create trigger revisar_primero_para
before insert or update of tema, abierto_en, modo on public.eventos
for each row execute function public.revisar_primero_para();

-- Ir a un evento (como en 20261104000000_eventos.sql) y, si todavía es solo para los de un tema, solo si te interesa
-- o lo organizas
create or replace function public.ir(evento uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  e public.eventos;
  ocupados_ya int;
begin
  if yo is null then raise exception 'No estás en Puente.' using errcode = '42501'; end if;
  select * into e from public.eventos where id = evento for update;
  if not found or e.cancelado_en is not null then raise exception 'Ese evento ya no está.' using errcode = 'P0002'; end if;
  if e.fin < now() then raise exception 'Ese evento ya pasó.' using errcode = '22023', hint = 'paso'; end if;
  if not public.esta_alla(yo, e.inicio) then raise exception 'Ese día no estás allá.' using errcode = '22023', hint = 'no_estas'; end if;
  if e.modo = 'cerrado' then raise exception 'Solo van los que suma quien organiza.' using errcode = '42501', hint = 'cerrado'; end if;
  -- Quien ya va (por ejemplo, porque quien organiza lo sumó a mano) sigue yendo, aunque no esté en el tema
  if exists (select 1 from public.asistentes a where a.evento = e.id and a.persona = yo and a.estado = 'va') then return 'va'; end if;
  if public.solo_para_tema(e.tema, e.abierto_en, e.modo) and e.organizador is distinct from yo and not public.le_interesa(e.tema, yo) then
    raise exception 'Por ahora es solo para los de %.', (select t.nombre from public.temas t where t.id = e.tema)
      using errcode = '42501', hint = 'solo_tema';
  end if;
  if e.modo = 'con_cupo' then
    select count(*) into ocupados_ya from public.asistentes a where a.evento = e.id and a.estado = 'va';
    if ocupados_ya >= e.cupos then raise exception 'Ya no quedan cupos.' using errcode = '22023', hint = 'lleno'; end if;
  end if;
  insert into public.asistentes (evento, persona, estado) values (e.id, yo, 'va')
  on conflict on constraint asistentes_pkey do update set estado = 'va', desde = clock_timestamp();
  return 'va';
end;
$$;

-- Anotarse en la lista de espera (como en 20261104000000_eventos.sql), con la misma regla del tema
create or replace function public.esperar(evento uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  e public.eventos;
  puesto int;
begin
  if yo is null then raise exception 'No estás en Puente.' using errcode = '42501'; end if;
  select * into e from public.eventos where id = evento for update;
  if not found or e.cancelado_en is not null then raise exception 'Ese evento ya no está.' using errcode = 'P0002'; end if;
  if e.modo <> 'con_cupo' then raise exception 'Este evento no tiene lista de espera.' using errcode = '22023'; end if;
  if not public.esta_alla(yo, e.inicio) then raise exception 'Ese día no estás allá.' using errcode = '22023', hint = 'no_estas'; end if;
  if public.solo_para_tema(e.tema, e.abierto_en, e.modo) and e.organizador is distinct from yo and not public.le_interesa(e.tema, yo)
     and not exists (select 1 from public.asistentes a where a.evento = e.id and a.persona = yo) then
    raise exception 'Por ahora es solo para los de %.', (select t.nombre from public.temas t where t.id = e.tema)
      using errcode = '42501', hint = 'solo_tema';
  end if;
  insert into public.asistentes (evento, persona, estado) values (e.id, yo, 'espera') on conflict do nothing;
  select count(*) into puesto from public.asistentes a
   where a.evento = e.id and a.estado = 'espera'
     and a.desde <= (select propio.desde from public.asistentes propio where propio.evento = e.id and propio.persona = yo);
  return puesto;
end;
$$;

-- Disponibilidad para Crear evento (como en 20261104030000_calendario.sql). Con un tema, cuenta solo a los de ese
-- tema: «3 de los 4 de Fintech que están allá tienen libre esa hora». Cambia la firma: se borra la anterior.
drop function public.libres(timestamptz, timestamptz);

create function public.libres(desde timestamptz, hasta timestamptz, tema uuid default null)
returns table (alla int, libres int)
language sql
stable
security definer
set search_path = ''
as $$
  with presentes as (
    select p.id from public.personas p
     where p.sacada_en is null and public.esta_alla(p.id, libres.desde)
       and (libres.tema is null or public.le_interesa(libres.tema, p.id))
  )
  select
    (select count(*) from presentes)::int,
    (select count(*) from presentes
      where not exists (
        select 1 from public.asistentes a join public.eventos e on e.id = a.evento
         where a.persona = presentes.id and a.estado = 'va' and e.cancelado_en is null
           and e.inicio < libres.hasta and e.fin > libres.desde
      )
      and not exists (
        select 1 from public.ocupados o where o.persona = presentes.id and o.inicio < libres.hasta and o.fin > libres.desde
      )
      and not exists (
        select 1 from public.ocupados_google g where g.persona = presentes.id and g.inicio < libres.hasta and g.fin > libres.desde
      ))::int
$$;

-- ---------- Temas ----------

-- ¿Lo puedo cambiar o borrar? Quien lo creó o quien administra
create function public.cambio_tema(tema uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.temas t
     where t.id = cambio_tema.tema and (t.creado_por = public.mi_persona() or public.administro())
  )
$$;

-- Crear un tema: quien lo crea queda dentro. Lleva un id armado en la app: si se reintenta y ya está, lo devuelve.
create function public.crear_tema(nombre text, de_que_trata text default null, id uuid default null)
returns public.temas
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  nuevo public.temas;
begin
  if yo is null then
    raise exception 'No estás invitado a Puente.' using errcode = '42501';
  end if;
  if crear_tema.id is not null then
    select * into nuevo from public.temas t where t.id = crear_tema.id;
    if found then
      if nuevo.creado_por = yo then
        return nuevo;
      end if;
      raise exception 'Ese tema ya existe.' using errcode = '23505';
    end if;
  end if;
  if btrim(coalesce(crear_tema.nombre, '')) = '' then
    raise exception 'Ponle un nombre al tema.' using errcode = '22023', hint = 'nombre';
  end if;
  if exists (select 1 from public.temas t where t.borrado_en is null and lower(btrim(t.nombre)) = lower(btrim(crear_tema.nombre))) then
    raise exception 'Ya hay un tema que se llama %.', btrim(crear_tema.nombre) using errcode = '23505', hint = 'repetido';
  end if;

  insert into public.temas (id, nombre, de_que_trata, creado_por)
  values (
    coalesce(crear_tema.id, gen_random_uuid()),
    btrim(crear_tema.nombre),
    nullif(btrim(coalesce(crear_tema.de_que_trata, '')), ''),
    yo
  )
  returning * into nuevo;

  insert into public.interesados (tema, persona) values (nuevo.id, yo);
  return nuevo;
end;
$$;

-- Cambiar el nombre o de qué se trata: quien lo creó o quien administra
create function public.cambiar_tema(tema uuid, nombre text, de_que_trata text default null)
returns public.temas
language plpgsql
security definer
set search_path = ''
as $$
declare
  cambiado public.temas;
begin
  if not public.cambio_tema(cambiar_tema.tema) then
    raise exception 'Solo quien lo creó o quien administra puede cambiar este tema.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.temas t where t.id = cambiar_tema.tema and t.borrado_en is null) then
    raise exception 'Ese tema ya no está.' using errcode = 'P0002', hint = 'no_esta';
  end if;
  if btrim(coalesce(cambiar_tema.nombre, '')) = '' then
    raise exception 'Ponle un nombre al tema.' using errcode = '22023', hint = 'nombre';
  end if;
  if exists (
    select 1 from public.temas t
     where t.borrado_en is null and t.id <> cambiar_tema.tema and lower(btrim(t.nombre)) = lower(btrim(cambiar_tema.nombre))
  ) then
    raise exception 'Ya hay un tema que se llama %.', btrim(cambiar_tema.nombre) using errcode = '23505', hint = 'repetido';
  end if;

  update public.temas t
     set nombre = btrim(cambiar_tema.nombre), de_que_trata = nullif(btrim(coalesce(cambiar_tema.de_que_trata, '')), '')
   where t.id = cambiar_tema.tema
  returning * into cambiado;
  return cambiado;
end;
$$;

-- Borrar: los eventos que todavía eran solo para este tema (y no han terminado) se abren a todos, con la misma hora
-- del borrado. Devuelve cuántos se abrieron.
create function public.borrar_tema(tema uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  cuando timestamptz := now();
  n int;
begin
  if not public.cambio_tema(borrar_tema.tema) then
    raise exception 'Solo quien lo creó o quien administra puede borrar este tema.' using errcode = '42501';
  end if;
  update public.temas t set borrado_en = cuando where t.id = borrar_tema.tema and t.borrado_en is null;
  if not found then
    return 0;
  end if;
  update public.eventos e set abierto_en = cuando
   where e.tema = borrar_tema.tema and e.abierto_en is null and e.modo <> 'cerrado'
     and e.cancelado_en is null and e.fin > cuando;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Deshacer el borrado. Los eventos que abrió el borrado vuelven a ser solo para el tema si todavía no pasa un minuto
-- (después ya pudo sumarse gente y llegar los avisos: quedan abiertos).
create function public.devolver_tema(tema uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.temas;
begin
  if not public.cambio_tema(devolver_tema.tema) then
    raise exception 'Solo quien lo creó o quien administra puede devolver este tema.' using errcode = '42501';
  end if;
  select * into t from public.temas x where x.id = devolver_tema.tema for update;
  if t.borrado_en is null then
    return;
  end if;
  if exists (select 1 from public.temas x where x.borrado_en is null and x.id <> t.id and lower(btrim(x.nombre)) = lower(btrim(t.nombre))) then
    raise exception 'Ya hay un tema que se llama %.', t.nombre using errcode = '23505', hint = 'repetido';
  end if;
  update public.temas x set borrado_en = null where x.id = t.id;
  update public.eventos e set abierto_en = null
   where e.tema = t.id and e.abierto_en = t.borrado_en and e.abierto_en > now() - interval '1 minute';
end;
$$;

-- «Me interesa»: cualquiera se suma a un tema vigente. Repetirlo no hace nada.
create function public.me_interesa(tema uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
begin
  if yo is null then
    raise exception 'No estás invitado a Puente.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.temas t where t.id = me_interesa.tema and t.borrado_en is null) then
    raise exception 'Ese tema ya no está.' using errcode = 'P0002', hint = 'no_esta';
  end if;
  insert into public.interesados (tema, persona) values (me_interesa.tema, yo) on conflict do nothing;
end;
$$;

-- «Ya no me interesa»: cada uno sale cuando quiere; los eventos a los que ya va no cambian
create function public.ya_no_me_interesa(tema uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.interesados i where i.tema = ya_no_me_interesa.tema and i.persona = public.mi_persona();
end;
$$;

alter table public.temas enable row level security;
alter table public.interesados enable row level security;

create policy "Los invitados ven los temas" on public.temas
for select to authenticated using (public.mi_persona() is not null);

create policy "Los invitados ven a quiénes les interesa cada tema" on public.interesados
for select to authenticated using (public.mi_persona() is not null);

revoke all on public.temas, public.interesados from anon, authenticated;
grant select on public.temas, public.interesados to authenticated;

-- El tema y la apertura se cambian como el resto del evento (quien organiza o quien administra)
grant update (tema, abierto_en) on public.eventos to authenticated;

revoke all on function public.solo_para_tema(uuid, timestamptz, public.modo_evento), public.le_interesa(uuid, uuid), public.revisar_primero_para(),
  public.libres(timestamptz, timestamptz, uuid), public.cambio_tema(uuid), public.crear_tema(text, text, uuid),
  public.cambiar_tema(uuid, text, text), public.borrar_tema(uuid), public.devolver_tema(uuid), public.me_interesa(uuid),
  public.ya_no_me_interesa(uuid) from public, anon;
revoke all on function public.le_interesa(uuid, uuid), public.revisar_primero_para(), public.cambio_tema(uuid) from authenticated;
grant execute on function public.libres(timestamptz, timestamptz, uuid), public.crear_tema(text, text, uuid),
  public.cambiar_tema(uuid, text, text), public.borrar_tema(uuid), public.devolver_tema(uuid), public.me_interesa(uuid),
  public.ya_no_me_interesa(uuid) to authenticated;

-- ---------- Copia diaria: suma temas e interesados ----------
-- Van después de personas y antes de eventos, que ahora apuntan a un tema. Un tema se recupera por su id; sus
-- interesados, por el id del tema: respaldo.recuperar('temas', '<día>', array['<id>']::uuid[]) y después
-- respaldo.recuperar('interesados', '<día>', array['<id>']::uuid[]).
create or replace function respaldo.tablas()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['personas', 'temas', 'interesados', 'contactos', 'notas', 'eventos', 'asistentes', 'ocupados',
               'notas_reunion', 'calendarios', 'gastos', 'partes', 'pagos', 'rendiciones', 'tareas', 'asignados']
$$;

-- Recuperar acepta ids también para temas (por su id) e interesados (por el id del tema); el resto es igual
create or replace function respaldo.recuperar(tabla text, dia date, ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  copia jsonb;
  clave text;
  columnas text;
  sentencia text;
  antes uuid[] := '{}';
  pausa text := coalesce(current_setting('puente.sin_avisos', true), '');
  n int;
begin
  if recuperar.tabla is null or recuperar.tabla <> all (respaldo.tablas()) then
    raise exception 'La tabla "%" no está entre las que se copian (%).', recuperar.tabla, array_to_string(respaldo.tablas(), ', ')
      using errcode = '22023';
  end if;
  if to_regclass(format('public.%I', recuperar.tabla)) is null then
    raise exception 'La tabla "%" ya no existe.', recuperar.tabla using errcode = '22023';
  end if;
  -- Por qué columna filtran los ids (nada de armar SQL con texto que venga de fuera: todo sale de esta lista)
  clave := case recuperar.tabla
    when 'personas' then 'id' when 'contactos' then 'id' when 'notas' then 'id' when 'eventos' then 'id'
    when 'ocupados' then 'id' when 'gastos' then 'id' when 'pagos' then 'id'
    when 'asistentes' then 'evento' when 'notas_reunion' then 'evento'
    when 'partes' then 'gasto' when 'rendiciones' then 'gasto'
    when 'tareas' then 'id' when 'asignados' then 'tarea'
    when 'temas' then 'id' when 'interesados' then 'tema'
  end;
  if recuperar.ids is not null and clave is null then
    raise exception 'La tabla "%" no se filtra por ids: se recupera entera.', recuperar.tabla using errcode = '22023';
  end if;

  select c.filas into copia from respaldo.copias c where c.dia = recuperar.dia and c.tabla = recuperar.tabla;
  if not found then
    raise exception 'No hay copia de "%" del día %.', recuperar.tabla, recuperar.dia using errcode = 'P0002';
  end if;
  if jsonb_array_length(copia) = 0 then
    return 0;
  end if;

  -- Solo las columnas que la copia trae y que la tabla todavía tiene (sin las generadas)
  select string_agg(format('%I', a.attname), ', ' order by a.attnum) into columnas
    from pg_catalog.pg_attribute a
   where a.attrelid = format('public.%I', recuperar.tabla)::regclass
     and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
     and jsonb_exists(copia -> 0, a.attname::text);
  if columnas is null then
    raise exception 'La copia de "%" no tiene ninguna columna que la tabla conozca.', recuperar.tabla using errcode = '22023';
  end if;

  -- Volver un evento o un contacto dispara triggers que ponen cosas propias: se anota qué había antes para deshacerlo
  if recuperar.tabla = 'eventos' then
    antes := array(select e.id from public.eventos e where e.id in (select (x ->> 'id')::uuid from jsonb_array_elements(copia) x));
  elsif recuperar.tabla = 'contactos' then
    antes := array(select k.id from public.contactos k where k.id in (select (x ->> 'id')::uuid from jsonb_array_elements(copia) x));
  end if;

  -- Sin avisos push mientras se recupera
  perform set_config('puente.sin_avisos', 'si', true);

  sentencia := format(
    'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1) r %3$s on conflict do nothing',
    recuperar.tabla, columnas,
    case when recuperar.ids is not null then format('where r.%I = any($2)', clave) else '' end);
  if recuperar.ids is null then
    execute sentencia using copia;
  else
    execute sentencia using copia, recuperar.ids;
  end if;
  get diagnostics n = row_count;

  if recuperar.tabla = 'eventos' then
    -- al_crear_evento sumó al organizador con la hora de hoy; los asistentes verdaderos vuelven con recuperar('asistentes')
    delete from public.asistentes a
     where a.evento in (select (x ->> 'id')::uuid from jsonb_array_elements(copia) x)
       and a.evento <> all (antes);
  elsif recuperar.tabla = 'contactos' then
    -- al_cambiar_contacto puso asignado_por y etapa_en de nuevo; los de la copia (este update no cambia responsable ni etapa)
    update public.contactos k set asignado_por = x.asignado_por, etapa_en = x.etapa_en
      from jsonb_populate_recordset(null::public.contactos, copia) x
     where k.id = x.id and k.id <> all (antes);
  end if;

  perform set_config('puente.sin_avisos', pausa, true);
  return n;
end;
$$;
