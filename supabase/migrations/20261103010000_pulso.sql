-- Pulso diario: Supabase gratis pausa la base si pasa una semana con poca actividad.
-- Una tarea de GitHub llama a esta función varias veces al día con la llave pública de la app.
-- Solo devuelve la hora: no muestra ningún dato.
create function public.pulso()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now()
$$;

revoke all on function public.pulso() from public;
grant execute on function public.pulso() to anon, authenticated;
