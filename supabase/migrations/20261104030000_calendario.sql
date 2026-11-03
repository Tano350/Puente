-- Calendarios de Google: cada uno tiene su calendario "The Bridge: <nombre>", compartido con todos.
-- Puente entra como quien administra, con el permiso que él deja guardado en Vault ("google_acceso"): escribe en el
-- calendario de cada uno los eventos a los que va y lee cuándo está ocupado (solo las horas, nunca los títulos).
-- Lo hace la función "calendario", que la base llama cada 10 minutos; su dirección y su clave van en Vault
-- (calendario_url y calendario_clave), nunca en el repositorio. Mientras falte algo, no se escribe nada.

-- De quién es cada calendario. Se llena a mano: nunca se adivina por el nombre.
create table public.calendarios (
  persona uuid primary key references public.personas (id),
  google_id text not null unique
);

-- Cuándo está ocupado cada uno según su calendario: solo las horas, sin títulos ni detalles
create table public.ocupados_google (
  persona uuid not null references public.personas (id),
  inicio timestamptz not null,
  fin timestamptz not null,
  constraint termina_despues check (fin > inicio)
);

create index ocupados_google_persona on public.ocupados_google (persona, inicio);

-- Sin políticas: solo las funciones de la base los leen
alter table public.calendarios enable row level security;
alter table public.ocupados_google enable row level security;
revoke all on public.calendarios, public.ocupados_google from anon, authenticated;

-- Disponibilidad para Crear evento: ahora también cuenta lo ocupado en el calendario de Google de cada uno
create or replace function public.libres(desde timestamptz, hasta timestamptz)
returns table (alla int, libres int)
language sql
stable
security definer
set search_path = ''
as $$
  with presentes as (
    select p.id from public.personas p
     where p.sacada_en is null and public.esta_alla(p.id, libres.desde)
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

-- Quien administra conecta Google Calendar desde Tu perfil: el permiso queda en Vault, nunca en una tabla
create function public.guardar_acceso_google(llave text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  guardado uuid;
begin
  if not public.administro() then
    raise exception 'Solo quien administra Puente puede conectar Google Calendar.' using errcode = '42501';
  end if;
  if llave is null or btrim(llave) = '' then
    raise exception 'Falta el permiso de Google.' using errcode = '22023';
  end if;
  select s.id into guardado from vault.secrets s where s.name = 'google_acceso';
  if guardado is null then
    perform vault.create_secret(llave, 'google_acceso', 'Permiso de Puente para usar Google Calendar');
  else
    perform vault.update_secret(guardado, llave);
  end if;
end;
$$;

-- ¿Ya está conectado? Solo lo sabe quien administra.
create function public.calendario_conectado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.administro() and exists (select 1 from vault.secrets s where s.name = 'google_acceso')
$$;

revoke all on function public.libres(timestamptz, timestamptz), public.guardar_acceso_google(text), public.calendario_conectado()
  from public, anon;
grant execute on function public.libres(timestamptz, timestamptz), public.guardar_acceso_google(text), public.calendario_conectado()
  to authenticated;

-- El reloj: cada 10 minutos llama a la función con su clave. Sin los dos secretos no llama a nadie.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
create extension if not exists pg_net with schema extensions;

-- Con el mismo nombre, volver a programarlo reemplaza el anterior
select cron.schedule(
  'calendario',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := secretos.url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-puente-clave', secretos.clave),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  )
  from (
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'calendario_url') as url,
      (select decrypted_secret from vault.decrypted_secrets where name = 'calendario_clave') as clave
  ) secretos
  where secretos.url is not null and secretos.clave is not null
  $$
);
