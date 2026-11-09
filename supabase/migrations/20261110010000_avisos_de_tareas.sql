-- Avisos de tareas. Dos tipos nuevos, que se apagan con un solo interruptor ('tareas' en personas.avisos; si falta la
-- clave, cuenta como encendido):
-- - 'tarea' ("Diego te asignó una tarea"): cuando otra persona te pone en una tarea, al crearla o al cambiarla.
--   No si te pusiste tú, ni con "Me la tomo" (tomada = true), ni en una personal. Espera sus 10 segundos para que
--   "Deshacer" lo anule: si en ese rato te sacan de la tarea o la borran, el aviso pendiente se borra; y al mandarlo,
--   la función revisa que la tarea no esté borrada y que sigas en ella.
-- - 'vence' ("Mañana vence una tarea tuya"): el día antes de "para", desde las 10:00 de California, lo encola el reloj
--   de cada 5 minutos (encolar_recordatorios_de_tareas). A cada asignado que sigue en Puente y no la tiene hecha (en
--   "cada uno", su fila sin hecha_en; si basta con uno, nadie la marcó), si la tarea no está borrada. Una vez por
--   tarea, persona y fecha: si la fecha cambia, la nueva puede avisar otra vez. Al mandarlo, la función revisa que
--   siga venciendo mañana, que no esté borrada y que siga sin hacer.
--
-- Para publicarlo, en este orden (la función nueva entiende los tipos 'tarea' y 'vence' y la columna tarea; la de antes
-- los descartaría como "El evento ya no está."):
-- 1. npx supabase functions deploy avisos --no-verify-jwt --use-api
-- 2. Aplicar 20261110000000_tareas.sql (si no se aplicó antes).
-- 3. Aplicar esta migración.

-- ---------- La tabla de avisos ----------

-- Si se borra la tarea de verdad, sus avisos se van con ella
alter table public.avisos add column tarea uuid references public.tareas (id) on delete cascade;
create index avisos_tarea on public.avisos (tarea) where tarea is not null;

-- Los tipos nuevos (el check se cambió por última vez en 20261107010000_aviso_te_sumaron.sql)
alter table public.avisos drop constraint avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check
  check (tipo in ('eventos', 'cambios', 'espera', 'recordatorio', 'contacto', 'pago', 'sumado', 'tarea', 'vence'));

-- Los de tareas llevan la tarea, no un evento
alter table public.avisos drop constraint con_lo_avisado;
alter table public.avisos add constraint con_lo_avisado check (
  case tipo
    when 'contacto' then contacto is not null
    when 'pago' then pago is not null
    when 'tarea' then tarea is not null
    when 'vence' then tarea is not null
    else evento is not null
  end
);

-- Nunca dos "vence mañana" de la misma tarea, para la misma persona y la misma fecha (datos = {"para": fecha})
create unique index avisos_un_vence on public.avisos (tarea, persona, (datos ->> 'para')) where tipo = 'vence';

-- Quien entra a Puente desde ahora tiene la clave escrita (a quien le falta, cuenta como encendido igual)
alter table public.personas alter column avisos
  set default '{"eventos": true, "cambios": true, "espera": true, "recordatorio": true, "contacto": true, "pago": true, "tareas": true}'::jsonb;

-- ---------- Preferencias y encolar ----------

-- Igual que antes, salvo que 'tarea' y 'vence' usan la preferencia de 'tareas'
create or replace function public.quiere_aviso(persona uuid, tipo text)
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
       and (p.avisos -> case
                          when quiere_aviso.tipo = 'sumado' then 'cambios'
                          when quiere_aviso.tipo in ('tarea', 'vence') then 'tareas'
                          else quiere_aviso.tipo
                        end) is distinct from 'false'::jsonb
       and exists (select 1 from public.suscripciones s where s.persona = p.id)
  )
$$;

-- encolar_aviso recibe la tarea. Cambia la firma, así que se borra la anterior y se crea de nuevo (la tarea va al
-- final: quien la llamaba con los parámetros de antes, por nombre o por posición, sigue funcionando). Los triggers
-- que la llaman (avisar_salida_de_espera, avisar_contacto, avisar_pago, avisar_sumado) la buscan por nombre al
-- correr, con parámetros que la nueva también tiene. Sin dejar la anterior al lado: dos versiones harían ambiguas
-- esas llamadas.
drop function public.encolar_aviso(uuid, text, uuid, uuid, uuid, jsonb);

create function public.encolar_aviso(persona uuid, tipo text, evento uuid default null, contacto uuid default null,
  pago uuid default null, datos jsonb default null, tarea uuid default null)
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
  insert into public.avisos (persona, tipo, evento, contacto, pago, datos, tarea)
  values (encolar_aviso.persona, encolar_aviso.tipo, encolar_aviso.evento, encolar_aviso.contacto, encolar_aviso.pago,
          encolar_aviso.datos, encolar_aviso.tarea);
  perform public.despertar_avisos();
  return true;
end;
$$;

-- ---------- "Te asignaron una tarea" ----------

-- Otra persona te puso en una tarea. En datos queda quién fue ({"quien": persona}), para escribir su nombre.
-- Si ya había un aviso igual esperando su salida (te puso, lo deshizo y te volvió a poner), queda uno solo.
create function public.avisar_tarea_asignada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tareas;
begin
  begin
    if public.avisos_en_pausa() or new.persona is not distinct from public.mi_persona() then return null; end if;
    select * into t from public.tareas x where x.id = new.tarea;
    if not found or t.personal or t.borrada_en is not null then return null; end if;
    delete from public.avisos v
     where v.tipo = 'tarea' and v.tarea = new.tarea and v.persona = new.persona
       and v.enviado_en is null and v.descartado is null and v.intentos = 0;
    perform public.encolar_aviso(new.persona, 'tarea', tarea => new.tarea,
      datos => jsonb_build_object('quien', public.mi_persona()));
  exception when others then
    raise warning 'Puente no pudo preparar el aviso de la tarea % para %: %', new.tarea, new.persona, sqlerrm;
  end;
  return null;
end;
$$;

-- "Me la tomo" (tomada = true) no avisa: lo hizo la misma persona
create trigger avisar_tarea_asignada
after insert on public.asignados
for each row
when (not new.tomada)
execute function public.avisar_tarea_asignada();

-- Te sacaron de una tarea (o la soltaste): lo que tenías esperando de ella ya no va
create function public.quitar_avisos_de_asignado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    delete from public.avisos v
     where v.tarea = old.tarea and v.persona = old.persona and v.tipo in ('tarea', 'vence')
       and v.enviado_en is null and v.descartado is null and v.intentos = 0;
  exception when others then
    raise warning 'Puente no pudo quitar los avisos de la tarea % para %: %', old.tarea, old.persona, sqlerrm;
  end;
  return null;
end;
$$;

create trigger quitar_avisos_de_asignado
after delete on public.asignados
for each row execute function public.quitar_avisos_de_asignado();

-- Se borró la tarea (se puede deshacer, pero lo que esperaba salir ya no va; el recordatorio, si toca, lo vuelve a
-- encolar el reloj)
create function public.quitar_avisos_de_tarea()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    delete from public.avisos v
     where v.tarea = new.id and v.tipo in ('tarea', 'vence')
       and v.enviado_en is null and v.descartado is null and v.intentos = 0;
  exception when others then
    raise warning 'Puente no pudo quitar los avisos de la tarea borrada %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

create trigger quitar_avisos_de_tarea
after update of borrada_en on public.tareas
for each row
when (old.borrada_en is null and new.borrada_en is not null)
execute function public.quitar_avisos_de_tarea();

-- ---------- "Mañana vence una tarea tuya" ----------

-- Encola los recordatorios de las tareas que vencen mañana (en California), desde las 10:00 de hoy. Recibe la hora
-- ("ahora") para poder probarla con cualquier momento; el reloj la llama con now(). Devuelve cuántos encoló.
create function public.encolar_recordatorios_de_tareas(ahora timestamptz)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  en_california timestamp := encolar_recordatorios_de_tareas.ahora at time zone 'America/Los_Angeles';
  manana date := en_california::date + 1;
  n int;
begin
  if en_california::time < time '10:00' then
    return 0;
  end if;
  insert into public.avisos (persona, tipo, tarea, datos, sale_en)
  select a.persona, 'vence', t.id, jsonb_build_object('para', t.para), now()
    from public.tareas t
    join public.asignados a on a.tarea = t.id
   where t.para = manana
     and t.borrada_en is null
     and case
           when t.cada_uno then a.hecha_en is null
           else not exists (select 1 from public.asignados b where b.tarea = t.id and b.hecha_en is not null)
         end
     and public.quiere_aviso(a.persona, 'vence')
  on conflict (tarea, persona, (datos ->> 'para')) where tipo = 'vence' do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- El reloj de 20261106000000_avisos.sql, ahora también con los recordatorios de tareas. Si esos fallan, los demás
-- siguen.
create or replace function public.reloj_de_avisos()
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

  begin
    perform public.encolar_recordatorios_de_tareas(now());
  exception when others then
    raise warning 'Puente no pudo preparar los recordatorios de tareas: %', sqlerrm;
  end;

  delete from public.avisos v where v.creado_en < now() - interval '30 days';

  -- Cinco intentos como máximo, igual que en la función
  if exists (select 1 from public.avisos v where v.enviado_en is null and v.descartado is null and v.intentos < 5) then
    perform public.despertar_avisos();
  end if;
end;
$$;

-- Sin permisos para la app: solo la base y la función. El reloj ya está programado (cron 'avisos'); no se vuelve a
-- programar ni se crea pg_cron.
revoke all on function public.quiere_aviso(uuid, text), public.encolar_aviso(uuid, text, uuid, uuid, uuid, jsonb, uuid),
  public.avisar_tarea_asignada(), public.quitar_avisos_de_asignado(), public.quitar_avisos_de_tarea(),
  public.encolar_recordatorios_de_tareas(timestamptz), public.reloj_de_avisos()
  from public, anon, authenticated;
