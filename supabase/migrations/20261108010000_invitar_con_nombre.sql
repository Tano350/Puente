-- Invitar con nombre: quien administra puede escribir el nombre de la persona (por ejemplo "Martín") al invitarla.
-- Queda como nombre provisorio, para que en las listas no se vea el correo hasta que la persona entre y ponga el suyo.
--
-- 1) invitar recibe un segundo parámetro opcional, nombre. Cambia la firma, así que se borra la anterior y se crea de
--    nuevo, con el mismo cuerpo y los mismos permisos. Sin nombre (o en blanco) todo sigue como antes. Si la persona
--    estaba sacada y vuelve, conserva el nombre que ya tenía; el provisorio solo llena un nombre vacío.
-- 2) enlazar_persona (al entrar por primera vez) ahora prefiere el nombre que trae Google; el provisorio queda de
--    respaldo si Google no trae ninguno. Antes el nombre siempre estaba vacío en ese momento, así que para quien se
--    invita sin nombre nada cambia. En Primera vez el nombre sale escrito en el formulario y se puede cambiar.
-- Para publicarlo: aplicar esta migración y después desplegar la app (la app solo manda el nombre cuando lo hay,
-- así que también funciona con la app de antes).

drop function public.invitar(text);

create function public.invitar(correo_nuevo text, nombre text default null)
returns public.personas
language plpgsql
security definer
set search_path = ''
as $$
declare
  limpio text := lower(btrim(correo_nuevo));
  provisorio text := left(nullif(btrim(invitar.nombre), ''), 80);
  invitada public.personas;
begin
  if not public.administro() then
    raise exception 'Solo quien administra Puente puede invitar.' using errcode = '42501';
  end if;
  if limpio !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Escribe el correo completo, como nombre@gmail.com.' using errcode = '22023';
  end if;
  -- Si la habían sacado, vuelve con su perfil
  update public.personas p
     set sacada_en = null,
         nombre = coalesce(p.nombre, provisorio)
   where p.correo = limpio and p.sacada_en is not null
  returning * into invitada;
  if found then
    return invitada;
  end if;
  insert into public.personas (correo, nombre, invitada_por)
  values (limpio, provisorio, public.mi_persona())
  returning * into invitada;
  return invitada;
exception
  when unique_violation then
    raise exception 'Ese correo ya está invitado.' using errcode = '23505';
end;
$$;

revoke execute on function public.invitar(text, text) from public, anon;
grant execute on function public.invitar(text, text) to authenticated;

-- Al entrar por primera vez, la cuenta de Google se une a su invitación
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
         nombre = coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), nombre),
         foto = coalesce(google, foto),
         foto_google = coalesce(google, foto_google)
   where correo = lower(new.email) and usuario is null;
  return new;
end;
$$;
