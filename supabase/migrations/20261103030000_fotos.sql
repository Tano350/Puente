-- Fotos de perfil propias: además de la de Google, cada uno puede poner la suya o ninguna.
-- "foto" es la que se muestra; "foto_google" guarda la de Google para poder volver a ella.
alter table public.personas add column foto_google text;
update public.personas set foto_google = foto where foto is not null;

create or replace function public.enlazar_persona()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  google text := coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture');
begin
  update public.personas
     set usuario = new.id,
         entro_en = coalesce(entro_en, now()),
         nombre = coalesce(nombre, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
         foto = coalesce(google, foto),
         foto_google = coalesce(google, foto_google)
   where correo = lower(new.email) and usuario is null;
  return new;
end;
$$;

-- La foto que se muestra es la de Google, una subida a tu propia carpeta o ninguna
create function public.revisar_foto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.foto is not null
     and new.foto is distinct from new.foto_google
     and new.foto !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/fotos/' || new.id::text || '/[^/]+$') then
    raise exception 'Esa foto no se puede usar.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger revisar_foto
before update of foto on public.personas
for each row when (new.foto is distinct from old.foto)
execute function public.revisar_foto();

grant update (foto) on public.personas to authenticated;

-- Las fotos se ven con su dirección, como las de Google; los nombres son al azar.
-- Cada uno sube, ve y borra solo lo de su carpeta (la carpeta es su id de persona).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg']);

create policy "Cada uno sube fotos a su carpeta" on storage.objects
for insert to authenticated
with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = public.mi_persona()::text);

create policy "Cada uno ve su carpeta de fotos" on storage.objects
for select to authenticated
using (bucket_id = 'fotos' and (storage.foldername(name))[1] = public.mi_persona()::text);

create policy "Cada uno borra fotos de su carpeta" on storage.objects
for delete to authenticated
using (bucket_id = 'fotos' and (storage.foldername(name))[1] = public.mi_persona()::text);
