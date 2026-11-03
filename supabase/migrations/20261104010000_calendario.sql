-- Calendario compartido: cada 10 minutos la base llama a la función "calendario", que cruza la Agenda con Google.
-- La dirección de la función y su clave van en Vault (calendario_url y calendario_clave), nunca en el repositorio.
-- Mientras falte alguna de las dos, el reloj corre pero no llama a nadie.
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
