-- Personas de Puente: los invitados, su perfil y quién administra.
-- Cada fila nace con la invitación (solo el correo) y se completa cuando la persona entra.

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  correo text not null unique check (correo = lower(btrim(correo))),
  usuario uuid unique references auth.users (id) on delete set null,
  nombre text,
  foto text,
  carrera text,
  emprendimiento text,
  emprendimiento_texto text,
  objetivos text,
  linkedin text,
  llega date,
  vuelve date,
  administra boolean not null default false,
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  invitada_por uuid references public.personas (id) on delete set null,
  invitada_en timestamptz not null default now(),
  entro_en timestamptz,
  sacada_en timestamptz,
  constraint fechas_en_orden check (llega is null or vuelve is null or llega <= vuelve)
);

-- Quién soy yo dentro de Puente (null si no estoy invitado o me sacaron)
create function public.mi_persona()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.personas where usuario = (select auth.uid()) and sacada_en is null
$$;

create function public.administro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select administra from public.personas where usuario = (select auth.uid()) and sacada_en is null),
    false
  )
$$;

-- Permisos: los invitados se ven entre sí; cada uno edita solo su perfil.
-- Invitar y sacar pasan por funciones que revisan que quien lo pide administre.
alter table public.personas enable row level security;

create policy "Los invitados se ven entre sí"
on public.personas for select
to authenticated
using (public.mi_persona() is not null and (sacada_en is null or public.administro()));

create policy "Cada uno edita su perfil"
on public.personas for update
to authenticated
using (usuario = (select auth.uid()) and sacada_en is null)
with check (usuario = (select auth.uid()) and sacada_en is null);

revoke all on public.personas from anon, authenticated;
grant select on public.personas to authenticated;
grant update (nombre, carrera, emprendimiento, emprendimiento_texto, objetivos, linkedin, llega, vuelve, idioma)
  on public.personas to authenticated;

create function public.invitar(correo_nuevo text)
returns public.personas
language plpgsql
security definer
set search_path = ''
as $$
declare
  limpio text := lower(btrim(correo_nuevo));
  invitada public.personas;
begin
  if not public.administro() then
    raise exception 'Solo quien administra Puente puede invitar.' using errcode = '42501';
  end if;
  if limpio !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Escribe el correo completo, como nombre@gmail.com.' using errcode = '22023';
  end if;
  -- Si la habían sacado, vuelve con su perfil
  update public.personas set sacada_en = null
   where correo = limpio and sacada_en is not null
  returning * into invitada;
  if found then
    return invitada;
  end if;
  insert into public.personas (correo, invitada_por)
  values (limpio, public.mi_persona())
  returning * into invitada;
  return invitada;
exception
  when unique_violation then
    raise exception 'Ese correo ya está invitado.' using errcode = '23505';
end;
$$;

-- Sacar no borra nada: la persona deja de poder entrar y lo que anotó se queda.
create function public.sacar(persona uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.administro() then
    raise exception 'Solo quien administra Puente puede sacar a alguien.' using errcode = '42501';
  end if;
  if persona = public.mi_persona() then
    raise exception 'No puedes sacarte a ti.' using errcode = '22023';
  end if;
  update public.personas set sacada_en = now() where id = persona and sacada_en is null;
end;
$$;

create function public.devolver(persona uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.administro() then
    raise exception 'Solo quien administra Puente puede deshacer esto.' using errcode = '42501';
  end if;
  update public.personas set sacada_en = null where id = persona;
end;
$$;

revoke execute on function public.mi_persona(), public.administro(), public.invitar(text), public.sacar(uuid), public.devolver(uuid)
  from public, anon;
grant execute on function public.mi_persona(), public.administro(), public.invitar(text), public.sacar(uuid), public.devolver(uuid)
  to authenticated;

-- Al entrar por primera vez, la cuenta de Google se une a su invitación
create function public.enlazar_persona()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.personas
     set usuario = new.id,
         entro_en = coalesce(entro_en, now()),
         nombre = coalesce(nombre, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
         foto = coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', foto)
   where correo = lower(new.email) and usuario is null;
  return new;
end;
$$;

create trigger al_crear_usuario
after insert on auth.users
for each row execute function public.enlazar_persona();

-- Gancho de Supabase Auth: solo se crean cuentas para correos invitados
create function public.antes_de_crear_usuario(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  entrante text := lower(event -> 'user' ->> 'email');
begin
  if exists (select 1 from public.personas p where p.correo = entrante and p.sacada_en is null) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Esta cuenta no está invitada: ' || coalesce(entrante, '')
    )
  );
end;
$$;

revoke execute on function public.antes_de_crear_usuario(jsonb) from public, anon, authenticated;
grant execute on function public.antes_de_crear_usuario(jsonb) to supabase_auth_admin;
