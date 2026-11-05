-- Copia diaria de los datos, dentro de la misma base: lo borrado o cambiado por error se puede recuperar.
--
-- QUÉ SE COPIA: cada día se guarda una copia de estas tablas de public (en este orden, que es el de las claves
-- foráneas): personas, contactos, notas, eventos, asistentes, ocupados, notas_reunion, calendarios, gastos, partes,
-- pagos y rendiciones. Cada tabla queda como una lista de filas en JSON (jsonb_agg(to_jsonb(fila))).
-- QUÉ NO SE COPIA, y por qué:
--   suscripciones     son llaves de los dispositivos con avisos; cada dispositivo las vuelve a crear al activar los avisos.
--   ocupados_google   se recalcula desde Google Calendar en la próxima vuelta de la sincronización.
--   avisos            es una cola de avisos push que se vacía sola (y no se debe reenviar nada viejo).
--   sincronizacion    es una sola fila de ajustes, que siempre existe.
--   Las fotos (Storage: perfiles y boletas) tampoco entran: la copia es solo de las tablas. Si se borra una foto, no
--   se recupera por aquí.
-- Las copias incluyen todo, también lo personal (contactos y gastos "solo", ratos ocupados): por eso viven en el
-- esquema "respaldo", que ni la API ni los usuarios de Puente pueden ver (ningún permiso, tampoco de uso). Solo se
-- abre desde el editor SQL de Supabase o con la Management API, como postgres.
--
-- CUÁNDO: todos los días a las 10:00 UTC (2:00 o 3:00 de la madrugada en California) corre respaldo.copiar().
-- El día de cada copia es el de California. Si corre dos veces el mismo día, la segunda reemplaza a la primera.
-- Las tablas se leen una tras otra, no en un mismo instante: de madrugada nadie escribe, así que no importa.
-- CUÁNTO DURA: 30 días. Cada vez que corre, borra las copias de más de 30 días.
--
-- CÓMO VER LAS COPIAS (editor SQL de Supabase):
--   select dia, tabla, cantidad, creada from respaldo.copias order by dia desc, tabla;
--   -- Qué había el 3 de noviembre en una tabla (cada fila viene en la columna f):
--   select f ->> 'id' as id, f ->> 'nombre' as nombre, f ->> 'organizacion' as organizacion
--     from respaldo.copias c, jsonb_array_elements(c.filas) f
--    where c.dia = '2026-11-03' and c.tabla = 'contactos';
--   -- Copiar ahora mismo (por ejemplo, justo después de aplicar esta migración):
--   select respaldo.copiar();
--
-- CÓMO RECUPERAR: respaldo.recuperar(tabla, dia, ids) vuelve a insertar las filas de esa copia que hoy no existen
-- (on conflict do nothing: lo que sigue ahí no se toca ni se pisa) y devuelve cuántas volvió. Sin ids, todas las que
-- faltan; con ids, solo esas. Se puede repetir sin duplicar nada. Solo para usar a mano desde SQL.
--   -- Un contacto borrado por error, con sus notas (las notas se filtran por su propio id):
--   select respaldo.recuperar('contactos', '2026-11-03', array['<id del contacto>']::uuid[]);
--   select respaldo.recuperar('notas', '2026-11-03', array['<id de la nota>']::uuid[]);
--   -- Un gasto borrado de verdad con sus partes y lo que se rindió (aquí los ids son los del GASTO):
--   select respaldo.recuperar('gastos', '2026-11-03', array['<id del gasto>']::uuid[]);
--   select respaldo.recuperar('partes', '2026-11-03', array['<id del gasto>']::uuid[]);
--   select respaldo.recuperar('rendiciones', '2026-11-03', array['<id del gasto>']::uuid[]);
--   -- Todo lo que falte de una tabla:
--   select respaldo.recuperar('contactos', '2026-11-03');
-- Los ids sirven así: en personas, contactos, notas, eventos, ocupados, gastos y pagos son los ids de esas filas; en
-- asistentes y notas_reunion son ids de EVENTOS; en partes y rendiciones son ids de GASTOS (no tienen id propio, su
-- clave es compuesta). En calendarios no hay filtro (su clave es un texto de Google): se recupera entera o nada.
--
-- ORDEN al recuperar varias tablas (si una fila apunta a otra que ya no está, falla con un error de clave foránea y
-- no cambia nada; se recupera lo de arriba primero): personas, contactos, notas, eventos, asistentes, ocupados,
-- notas_reunion, calendarios, gastos, partes, pagos, rendiciones. En particular, gastos antes que partes y
-- rendiciones, eventos antes que asistentes y notas_reunion, contactos antes que notas.
--
-- QUÉ HACE ADEMÁS AL RECUPERAR:
--   * Pausa los avisos push mientras recupera (puente.sin_avisos, como en las cargas en bloque): volver un evento,
--     un contacto o un pago no avisa a nadie. Al terminar deja la pausa como estaba.
--   * Al volver un evento, el trigger al_crear_evento suma al organizador como asistente con la hora de hoy; se
--     deshace, para que recuperar('asistentes', …) devuelva a cada uno con su estado y hora de llegada de entonces.
--   * Al volver un contacto, el trigger al_cambiar_contacto recalcula asignado_por y etapa_en; se les devuelve el
--     valor que tenían en la copia.
--   * Solo se insertan las columnas que la copia trae; si después se agregó una columna, toma su valor por defecto.
--     Las columnas generadas nunca se insertan.
--   * Riesgo conocido: si se borró una cuenta de acceso (auth.users), recuperar esa persona falla por su clave foránea.

create schema respaldo;
revoke all on schema respaldo from public, anon, authenticated, service_role;

create table respaldo.copias (
  dia date not null,
  tabla text not null,
  filas jsonb not null,
  cantidad int not null check (cantidad = jsonb_array_length(filas)),
  creada timestamptz not null default now(),
  primary key (dia, tabla)
);

-- Sin políticas ni permisos: ni la API ni los usuarios de Puente la ven
alter table respaldo.copias enable row level security;
revoke all on respaldo.copias from public, anon, authenticated, service_role;

-- Las tablas que se copian, en el orden de sus claves foráneas (primero las que no dependen de otras)
create function respaldo.tablas()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['personas', 'contactos', 'notas', 'eventos', 'asistentes', 'ocupados', 'notas_reunion', 'calendarios',
               'gastos', 'partes', 'pagos', 'rendiciones']
$$;

-- Guarda la copia de hoy (día de California) de cada tabla y borra las de más de 30 días. Devuelve cuántas tablas
-- copió. Una tabla que falta o que falla se salta con un aviso en el registro de la base: no rompe la copia de las demás.
create function respaldo.copiar()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  hoy date := (now() at time zone 'America/Los_Angeles')::date;
  nombre text;
  contenido jsonb;
  cuantas int;
  copiadas int := 0;
begin
  foreach nombre in array respaldo.tablas() loop
    begin
      if to_regclass(format('public.%I', nombre)) is null then
        raise warning 'Respaldo: la tabla % no existe, se salta', nombre;
        continue;
      end if;
      execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb), count(*)::int from public.%I x', nombre)
        into contenido, cuantas;
      insert into respaldo.copias (dia, tabla, filas, cantidad, creada)
      values (hoy, nombre, contenido, cuantas, now())
      on conflict (dia, tabla) do update
        set filas = excluded.filas, cantidad = excluded.cantidad, creada = excluded.creada;
      copiadas := copiadas + 1;
    exception when others then
      raise warning 'Respaldo: no se pudo copiar la tabla %: %', nombre, sqlerrm;
    end;
  end loop;
  delete from respaldo.copias c where c.dia < hoy - 30;
  return copiadas;
end;
$$;

-- Vuelve a insertar las filas de la copia de ese día que hoy no existen. Ver el encabezado para el uso y el orden.
create function respaldo.recuperar(tabla text, dia date, ids uuid[] default null)
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

revoke all on function respaldo.tablas(), respaldo.copiar(), respaldo.recuperar(text, date, uuid[])
  from public, anon, authenticated, service_role;

-- El reloj: todos los días a las 10:00 UTC. Si ya estaba programado, se desprograma antes de volver a programarlo.
-- pg_cron ya está instalado (20261104030000_calendario.sql) y no se vuelve a crear: ver 20261106000000_avisos.sql.
select cron.unschedule(j.jobid) from cron.job j where j.jobname = 'copia-diaria';
select cron.schedule('copia-diaria', '0 10 * * *', $$select respaldo.copiar()$$);
