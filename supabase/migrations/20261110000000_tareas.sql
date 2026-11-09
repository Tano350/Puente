-- Tareas del grupo: título, notas, para cuándo (un día, sin hora) y para quién.
--
-- PARA QUIÉN: una fila en "asignados" por persona.
--   Sin filas               sin asignar: cualquiera se la toma con "Me la tomo" (tomar_tarea).
--   cada_uno = false        basta con que una la haga: está hecha cuando alguna fila tiene hecha_en.
--   cada_uno = true         cada una hace la suya: está hecha cuando todas las filas de quienes siguen en Puente
--                           tienen hecha_en. Solo con dos personas o más.
--   personal = true         solo la ve quien la creó (ni quien administra) y es suya: una sola fila, la de ella.
--
-- QUIÉN HACE QUÉ: todos ven todo, salvo las personales de otro. Cambian y borran quien la creó y quien administra
-- (una personal, solo quien la creó). Marcan y desmarcan los asignados; en "basta con uno", desmarcar la deja por
-- hacer para todos. Se la toma cualquiera si no tiene a nadie (si dos la toman a la vez, una la consigue) y la suelta
-- solo quien se la tomó. Todo cambio pasa por estas funciones; las tablas no se escriben directo.
--
-- Borrar deja la marca borrada_en y se puede deshacer (devolver_tarea), como los gastos. La app esconde las borradas.
-- Los avisos de tareas van en su propia migración (20261110010000_avisos_de_tareas.sql).

create table public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (btrim(titulo) <> ''),
  notas text,
  -- Para cuándo: un día de California, sin hora (opcional)
  para date,
  cada_uno boolean not null default false,
  personal boolean not null default false,
  creada_por uuid not null default public.mi_persona() references public.personas (id),
  creada_en timestamptz not null default now(),
  -- Borrada; se puede deshacer
  borrada_en timestamptz,
  constraint personal_no_es_de_cada_uno check (not (personal and cada_uno))
);

create index tareas_para on public.tareas (para);

create table public.asignados (
  tarea uuid not null references public.tareas (id) on delete cascade,
  persona uuid not null references public.personas (id),
  -- Se la tomó con "Me la tomo": la puede soltar
  tomada boolean not null default false,
  hecha_en timestamptz,
  asignado_en timestamptz not null default now(),
  primary key (tarea, persona)
);

create index asignados_persona on public.asignados (persona);

-- ¿La puedo cambiar o borrar? Quien la creó o quien administra; una personal, solo quien la creó
create function public.cambio_tarea(tarea uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tareas t
     where t.id = cambio_tarea.tarea and public.mi_persona() is not null
       and case
             when t.personal then t.creada_por = public.mi_persona()
             else t.creada_por = public.mi_persona() or public.administro()
           end
  )
$$;

-- Las personas de la lista, sin repetir, revisando que sigan en Puente
create function public.gente_de_tarea(personas uuid[])
returns uuid[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  gente uuid[] := array(select distinct g from unnest(coalesce(gente_de_tarea.personas, '{}'::uuid[])) g where g is not null);
begin
  if exists (
    select 1 from unnest(gente) g
     where not exists (select 1 from public.personas p where p.id = g and p.sacada_en is null)
  ) then
    raise exception 'Una de esas personas ya no está en Puente.' using errcode = '22023', hint = 'persona';
  end if;
  return gente;
end;
$$;

-- Crear una tarea. Lleva el id que arma el dispositivo: si se reintenta y la base ya la tiene, la devuelve.
-- "cada_uno" se ignora con menos de dos personas; una personal es solo de quien la crea.
create function public.crear_tarea(titulo text, cada_uno boolean, personal boolean, personas uuid[],
  notas text default null, para date default null, id uuid default null)
returns public.tareas
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  nueva public.tareas;
  gente uuid[];
begin
  if yo is null then
    raise exception 'No estás invitado a Puente.' using errcode = '42501';
  end if;
  if crear_tarea.id is not null then
    select * into nueva from public.tareas t where t.id = crear_tarea.id;
    if found then
      if nueva.creada_por = yo then
        return nueva;
      end if;
      raise exception 'Esa tarea ya existe.' using errcode = '23505';
    end if;
  end if;
  if btrim(coalesce(crear_tarea.titulo, '')) = '' then
    raise exception 'Ponle un título a la tarea.' using errcode = '22023', hint = 'titulo';
  end if;
  gente := case when coalesce(crear_tarea.personal, false) then array[yo] else public.gente_de_tarea(crear_tarea.personas) end;

  insert into public.tareas (id, titulo, notas, para, cada_uno, personal, creada_por)
  values (
    coalesce(crear_tarea.id, gen_random_uuid()),
    btrim(crear_tarea.titulo),
    nullif(btrim(coalesce(crear_tarea.notas, '')), ''),
    crear_tarea.para,
    coalesce(crear_tarea.cada_uno, false) and not coalesce(crear_tarea.personal, false) and cardinality(gente) >= 2,
    coalesce(crear_tarea.personal, false),
    yo
  )
  returning * into nueva;

  insert into public.asignados (tarea, persona) select nueva.id, g from unnest(gente) g;
  return nueva;
end;
$$;

-- Cambiar una tarea: título, notas, fecha, cómo se hace y para quién. Quien sigue asignado conserva su marca; quien
-- sale, la pierde. Hacerla personal (o dejar de serlo) solo lo puede quien la creó.
create function public.cambiar_tarea(tarea uuid, titulo text, cada_uno boolean, personal boolean, personas uuid[],
  notas text default null, para date default null)
returns public.tareas
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  antes public.tareas;
  despues public.tareas;
  gente uuid[];
begin
  select * into antes from public.tareas t where t.id = cambiar_tarea.tarea and t.borrada_en is null for update;
  if not found or (antes.personal and antes.creada_por is distinct from yo) then
    raise exception 'Esa tarea ya no está.' using errcode = 'P0002', hint = 'no_esta';
  end if;
  if not public.cambio_tarea(antes.id) then
    raise exception 'Solo quien la creó o quien administra puede cambiar esta tarea.' using errcode = '42501';
  end if;
  if coalesce(cambiar_tarea.personal, false) <> antes.personal and antes.creada_por <> yo then
    raise exception 'Solo quien la creó puede hacerla personal o dejar de serlo.' using errcode = '42501';
  end if;
  if btrim(coalesce(cambiar_tarea.titulo, '')) = '' then
    raise exception 'Ponle un título a la tarea.' using errcode = '22023', hint = 'titulo';
  end if;
  gente := case when coalesce(cambiar_tarea.personal, false) then array[antes.creada_por] else public.gente_de_tarea(cambiar_tarea.personas) end;

  update public.tareas t
     set titulo = btrim(cambiar_tarea.titulo),
         notas = nullif(btrim(coalesce(cambiar_tarea.notas, '')), ''),
         para = cambiar_tarea.para,
         cada_uno = coalesce(cambiar_tarea.cada_uno, false) and not coalesce(cambiar_tarea.personal, false) and cardinality(gente) >= 2,
         personal = coalesce(cambiar_tarea.personal, false)
   where t.id = antes.id
  returning * into despues;

  delete from public.asignados a where a.tarea = antes.id and a.persona <> all (gente);
  insert into public.asignados (tarea, persona) select antes.id, g from unnest(gente) g on conflict do nothing;
  return despues;
end;
$$;

-- Borrar una tarea y deshacerlo
create function public.borrar_tarea(tarea uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.cambio_tarea(borrar_tarea.tarea) then
    raise exception 'Solo quien la creó o quien administra puede borrar esta tarea.' using errcode = '42501';
  end if;
  update public.tareas t set borrada_en = now() where t.id = borrar_tarea.tarea and t.borrada_en is null;
end;
$$;

create function public.devolver_tarea(tarea uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.cambio_tarea(devolver_tarea.tarea) then
    raise exception 'Solo quien la creó o quien administra puede devolver esta tarea.' using errcode = '42501';
  end if;
  update public.tareas t set borrada_en = null where t.id = devolver_tarea.tarea;
end;
$$;

-- Marcar o desmarcar. Recibe el estado al que queda (no un "cambiar"), así se puede repetir sin efecto: lo marcado
-- sin señal se manda cuando vuelve la señal, quizás más de una vez.
create function public.marcar_tarea(tarea uuid, hecha boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  t public.tareas;
begin
  select * into t from public.tareas x where x.id = marcar_tarea.tarea and x.borrada_en is null for update;
  if not found or (t.personal and t.creada_por is distinct from yo) then
    raise exception 'Esa tarea ya no está.' using errcode = 'P0002', hint = 'no_esta';
  end if;
  if not exists (select 1 from public.asignados a where a.tarea = t.id and a.persona = yo) then
    raise exception 'Solo quienes tienen la tarea la pueden marcar.' using errcode = '42501', hint = 'no_asignado';
  end if;
  if t.cada_uno then
    update public.asignados a
       set hecha_en = case when marcar_tarea.hecha then coalesce(a.hecha_en, now()) end
     where a.tarea = t.id and a.persona = yo;
  elsif marcar_tarea.hecha then
    -- Basta con uno: si ya la marcó otra persona, queda como está
    update public.asignados a set hecha_en = now()
     where a.tarea = t.id and a.persona = yo
       and not exists (select 1 from public.asignados b where b.tarea = t.id and b.hecha_en is not null);
  else
    -- Desmarcar una de "basta con uno" la deja por hacer para todos
    update public.asignados a set hecha_en = null where a.tarea = t.id and a.hecha_en is not null;
  end if;
end;
$$;

-- "Me la tomo": solo si no la tiene nadie. El bloqueo de la fila hace que, si dos la toman a la vez, una la consiga
-- y la otra reciba "tomada".
create function public.tomar_tarea(tarea uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  t public.tareas;
begin
  if yo is null then
    raise exception 'No estás invitado a Puente.' using errcode = '42501';
  end if;
  select * into t from public.tareas x where x.id = tomar_tarea.tarea and x.borrada_en is null and not x.personal for update;
  if not found then
    raise exception 'Esa tarea ya no está.' using errcode = 'P0002', hint = 'no_esta';
  end if;
  if exists (select 1 from public.asignados a where a.tarea = t.id) then
    raise exception 'Alguien ya se la tomó.' using errcode = '22023', hint = 'tomada';
  end if;
  insert into public.asignados (tarea, persona, tomada) values (t.id, yo, true);
end;
$$;

-- Soltarla: solo quien se la tomó. Si no queda nadie, vuelve a "sin asignar".
create function public.soltar_tarea(tarea uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.asignados a
   where a.tarea = soltar_tarea.tarea and a.persona = public.mi_persona() and a.tomada;
  if not found then
    raise exception 'Solo quien se la tomó la puede soltar.' using errcode = '42501', hint = 'no_tomada';
  end if;
end;
$$;

alter table public.tareas enable row level security;
alter table public.asignados enable row level security;

create policy "Los invitados ven las tareas, salvo las personales de otro" on public.tareas
for select to authenticated using (public.mi_persona() is not null and (not personal or creada_por = public.mi_persona()));

-- La subconsulta pasa por la política de tareas: los asignados de una personal ajena tampoco se ven
create policy "Se ven los asignados de las tareas que se ven" on public.asignados
for select to authenticated using (exists (select 1 from public.tareas t where t.id = tarea));

revoke all on public.tareas, public.asignados from anon, authenticated;
grant select on public.tareas, public.asignados to authenticated;

revoke all on function public.cambio_tarea(uuid), public.gente_de_tarea(uuid[]),
  public.crear_tarea(text, boolean, boolean, uuid[], text, date, uuid),
  public.cambiar_tarea(uuid, text, boolean, boolean, uuid[], text, date),
  public.borrar_tarea(uuid), public.devolver_tarea(uuid), public.marcar_tarea(uuid, boolean),
  public.tomar_tarea(uuid), public.soltar_tarea(uuid) from public, anon;
revoke all on function public.cambio_tarea(uuid), public.gente_de_tarea(uuid[]) from authenticated;
grant execute on function public.crear_tarea(text, boolean, boolean, uuid[], text, date, uuid),
  public.cambiar_tarea(uuid, text, boolean, boolean, uuid[], text, date),
  public.borrar_tarea(uuid), public.devolver_tarea(uuid), public.marcar_tarea(uuid, boolean),
  public.tomar_tarea(uuid), public.soltar_tarea(uuid) to authenticated;

-- ---------- Copia diaria: suma tareas y asignados ----------
-- Van al final de la lista (dependen solo de personas). Una tarea se recupera por su id; sus asignados, por el id de
-- la tarea: respaldo.recuperar('tareas', '<día>', array['<id>']::uuid[]) y después
-- respaldo.recuperar('asignados', '<día>', array['<id>']::uuid[]).
create or replace function respaldo.tablas()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['personas', 'contactos', 'notas', 'eventos', 'asistentes', 'ocupados', 'notas_reunion', 'calendarios',
               'gastos', 'partes', 'pagos', 'rendiciones', 'tareas', 'asignados']
$$;

-- Recuperar acepta ids para las dos tablas nuevas (el resto de la función es la de 20261106020000_copia_diaria.sql)
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
