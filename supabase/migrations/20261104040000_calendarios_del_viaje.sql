-- Calendarios del viaje: quien administra ve en Puente los calendarios "… The Bridge" de su cuenta de Google, asigna
-- cada uno a su persona y enciende o apaga la sincronización. Mientras esté apagada, Puente no lee ni escribe en el
-- calendario de nadie: solo mira la lista de calendarios de quien administra (nombres y permisos).

-- La tabla anterior se llenaba a mano y quedó vacía: se rehace
drop table public.calendarios;

create table public.calendarios (
  google_id text primary key,
  nombre text not null,
  -- El permiso de quien administra sobre ese calendario, como lo dice Google
  permiso text not null check (permiso in ('owner', 'writer', 'reader', 'freeBusyReader')),
  persona uuid unique references public.personas (id) on delete set null,
  -- La última vez que apareció en la lista de calendarios de quien administra
  visto_en timestamptz not null default now()
);

-- Una sola fila: si la sincronización está encendida, cuándo fue la última vuelta y cuántas cosas fallaron en ella
create table public.sincronizacion (
  unica boolean primary key default true check (unica),
  activa boolean not null default false,
  ultima_vez timestamptz,
  errores int not null default 0
);

insert into public.sincronizacion default values;

-- Sin políticas: la app los ve y los cambia solo por las funciones de abajo
alter table public.calendarios enable row level security;
alter table public.sincronizacion enable row level security;
revoke all on public.calendarios, public.sincronizacion from anon, authenticated;

create function public.calendarios_del_viaje()
returns setof public.calendarios
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.administro() then
    raise exception 'Solo quien administra Puente ve los calendarios del viaje.' using errcode = '42501';
  end if;
  return query select * from public.calendarios c order by c.nombre;
end;
$$;

-- Asigna un calendario a una persona (o lo deja sin dueño con null). Cada persona tiene uno solo: si ya tenía otro,
-- ese queda sin dueño.
create function public.asignar_calendario(google_id text, persona uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.administro() then
    raise exception 'Solo quien administra Puente asigna los calendarios.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.calendarios c where c.google_id = asignar_calendario.google_id) then
    raise exception 'Ese calendario ya no está en la lista.' using errcode = 'P0002';
  end if;
  if asignar_calendario.persona is not null then
    update public.calendarios c set persona = null
     where c.persona = asignar_calendario.persona and c.google_id <> asignar_calendario.google_id;
  end if;
  update public.calendarios c set persona = asignar_calendario.persona where c.google_id = asignar_calendario.google_id;
end;
$$;

create function public.estado_sincronizacion()
returns setof public.sincronizacion
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.administro() then
    raise exception 'Solo quien administra Puente ve la sincronización.' using errcode = '42501';
  end if;
  return query select * from public.sincronizacion;
end;
$$;

create function public.sincronizar_calendarios(activa boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.administro() then
    raise exception 'Solo quien administra Puente enciende o apaga la sincronización.' using errcode = '42501';
  end if;
  if sincronizar_calendarios.activa is null then
    raise exception 'Falta decir si se enciende o se apaga.' using errcode = '22023';
  end if;
  update public.sincronizacion s set activa = sincronizar_calendarios.activa where s.unica;
  -- Apagada, la disponibilidad deja de usar lo leído de los calendarios de cada uno.
  -- (Con "where": la API de Supabase no deja borrar sin where, ni dentro de una función.)
  if not sincronizar_calendarios.activa then
    delete from public.ocupados_google where true;
  end if;
end;
$$;

-- Pide a la función "calendario" una vuelta ahora, igual que el reloj de cada 10 minutos
create function public.buscar_calendarios()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  direccion text;
  clave text;
begin
  if not public.administro() then
    raise exception 'Solo quien administra Puente busca los calendarios.' using errcode = '42501';
  end if;
  select s.decrypted_secret into direccion from vault.decrypted_secrets s where s.name = 'calendario_url';
  select s.decrypted_secret into clave from vault.decrypted_secrets s where s.name = 'calendario_clave';
  if direccion is null or clave is null then
    raise exception 'El reloj del calendario todavía no está encendido.' using errcode = '55000';
  end if;
  perform net.http_post(
    url := direccion,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-puente-clave', clave),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function public.calendarios_del_viaje(), public.asignar_calendario(text, uuid), public.estado_sincronizacion(),
  public.sincronizar_calendarios(boolean), public.buscar_calendarios() from public, anon;
grant execute on function public.calendarios_del_viaje(), public.asignar_calendario(text, uuid), public.estado_sincronizacion(),
  public.sincronizar_calendarios(boolean), public.buscar_calendarios() to authenticated;
