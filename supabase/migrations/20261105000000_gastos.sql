-- Gastos del viaje (reemplaza a Tricount). Todo en dólares, guardado en centavos: si la boleta está en pesos,
-- convierte quien anota. Un gasto tiene qué fue, cuánto, quién pagó, entre quiénes se divide (partes iguales o
-- montos exactos), fecha y foto de la boleta (opcional, en un espacio privado). Un gasto "solo" es de una persona:
-- no se divide y solo ella lo ve, ni siquiera quien administra.
-- Cambian un gasto quien lo anotó, quien pagó y quien administra. Anotar y cambiar pasan por funciones de la base,
-- que revisan en un solo paso que las partes sumen el total. Para saldar, cada uno marca lo que transfirió.
-- Qué gastos rinde cada uno es personal.

create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (btrim(titulo) <> ''),
  categoria text not null default 'otro' check (categoria in ('auto', 'tren', 'bici', 'comida', 'cafe', 'super', 'entrada', 'otro')),
  -- En centavos de dólar
  monto int not null check (monto > 0),
  -- El día del gasto, en California
  fecha date not null,
  pagado_por uuid not null references public.personas (id),
  division text not null check (division in ('iguales', 'exactos', 'solo')),
  -- Ruta de la foto en el espacio privado "boletas": <id del gasto>/<nombre>
  boleta text,
  creado_por uuid not null default public.mi_persona() references public.personas (id),
  creado_en timestamptz not null default now(),
  cambiado_en timestamptz not null default now(),
  -- Eliminado; se puede deshacer
  borrado_en timestamptz,
  constraint solo_es_de_quien_pago check (division <> 'solo' or pagado_por = creado_por)
);

create index gastos_fecha on public.gastos (fecha desc);

-- La parte de cada uno, en centavos. Suman el monto del gasto.
create table public.partes (
  gasto uuid not null references public.gastos (id) on delete cascade,
  persona uuid not null references public.personas (id),
  monto int not null check (monto >= 0),
  primary key (gasto, persona)
);

create index partes_persona on public.partes (persona);

-- Lo que alguien marcó como transferido a otra persona, para saldar
create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  de uuid not null default public.mi_persona() references public.personas (id),
  a uuid not null references public.personas (id),
  monto int not null check (monto > 0),
  creado_en timestamptz not null default now(),
  borrado_en timestamptz,
  constraint a_otra_persona check (de <> a)
);

-- Qué gastos rinde cada uno
create table public.rendiciones (
  gasto uuid not null references public.gastos (id) on delete cascade,
  persona uuid not null default public.mi_persona() references public.personas (id),
  marcado_en timestamptz not null default now(),
  primary key (gasto, persona)
);

-- ¿Lo veo? Los invitados ven todos los gastos, salvo los "solo" de otra persona
create function public.veo_gasto(gasto uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gastos g
     where g.id = veo_gasto.gasto and public.mi_persona() is not null
       and (g.division <> 'solo' or g.pagado_por = public.mi_persona())
  )
$$;

-- ¿Lo puedo cambiar? Quien lo anotó, quien pagó o quien administra; uno "solo", únicamente su dueño
create function public.cambio_gasto(gasto uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.gastos g
     where g.id = cambio_gasto.gasto and public.mi_persona() is not null
       and case
             when g.division = 'solo' then g.pagado_por = public.mi_persona()
             else g.creado_por = public.mi_persona() or g.pagado_por = public.mi_persona() or public.administro()
           end
  )
$$;

-- La carpeta de cada boleta es el id de su gasto
create function public.gasto_de_ruta(ruta text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when split_part(ruta, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(ruta, '/', 1)::uuid end
$$;

-- Guarda las partes de un gasto: personas del grupo, sin repetir, que sumen el total. En "solo", la única parte es
-- de quien pagó. Solo la usan anotar_gasto y cambiar_gasto.
create function public.guardar_partes(gasto uuid, monto int, division text, pagado_por uuid, partes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  suma int;
begin
  delete from public.partes p where p.gasto = guardar_partes.gasto;
  if guardar_partes.division = 'solo' then
    insert into public.partes (gasto, persona, monto) values (guardar_partes.gasto, guardar_partes.pagado_por, guardar_partes.monto);
    return;
  end if;
  if guardar_partes.partes is null or jsonb_typeof(guardar_partes.partes) <> 'array' or jsonb_array_length(guardar_partes.partes) = 0 then
    raise exception 'Elige al menos una persona.' using errcode = '22023';
  end if;
  insert into public.partes (gasto, persona, monto)
  select guardar_partes.gasto, (x ->> 'persona')::uuid, (x ->> 'monto')::int
    from jsonb_array_elements(guardar_partes.partes) x;
  select coalesce(sum(p.monto), 0) into suma from public.partes p where p.gasto = guardar_partes.gasto;
  if suma <> guardar_partes.monto then
    raise exception 'Las partes suman % centavos y el gasto es de %.', suma, guardar_partes.monto using errcode = '22023';
  end if;
  if exists (
    select 1 from public.partes p join public.personas pe on pe.id = p.persona
     where p.gasto = guardar_partes.gasto and pe.sacada_en is not null
  ) then
    raise exception 'Alguien de la lista ya no está en el grupo.' using errcode = '22023';
  end if;
end;
$$;

-- Anotar un gasto con sus partes, en un solo paso. "partes" es una lista [{persona, monto}] que suma el monto;
-- en "solo" no se usa (el gasto es entero de quien lo anota, que también lo pagó).
create function public.anotar_gasto(titulo text, categoria text, monto int, fecha date, pagado_por uuid, division text, partes jsonb)
returns public.gastos
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  g public.gastos;
begin
  if yo is null then raise exception 'No estás en Puente.' using errcode = '42501'; end if;
  if anotar_gasto.division = 'solo' and anotar_gasto.pagado_por is distinct from yo then
    raise exception 'Un gasto solo tuyo lo pagas tú.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.personas p where p.id = anotar_gasto.pagado_por and p.sacada_en is null) then
    raise exception 'Quien pagó no está en el grupo.' using errcode = '22023';
  end if;
  insert into public.gastos (titulo, categoria, monto, fecha, pagado_por, division, creado_por)
  values (btrim(anotar_gasto.titulo), anotar_gasto.categoria, anotar_gasto.monto, anotar_gasto.fecha, anotar_gasto.pagado_por, anotar_gasto.division, yo)
  returning * into g;
  perform public.guardar_partes(g.id, g.monto, g.division, g.pagado_por, anotar_gasto.partes);
  return g;
end;
$$;

-- Cambiar un gasto (todo junto, con sus partes). Un gasto "solo" tiene que haberlo anotado y pagado quien lo cambia.
create function public.cambiar_gasto(gasto uuid, titulo text, categoria text, monto int, fecha date, pagado_por uuid, division text, partes jsonb)
returns public.gastos
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  antes public.gastos;
  g public.gastos;
begin
  select * into antes from public.gastos x where x.id = cambiar_gasto.gasto for update;
  if not found or antes.borrado_en is not null then raise exception 'Ese gasto ya no está.' using errcode = 'P0002'; end if;
  if not public.cambio_gasto(antes.id) then
    raise exception 'Solo quien lo anotó, quien pagó o quien administra puede cambiar este gasto.' using errcode = '42501';
  end if;
  if cambiar_gasto.division = 'solo' and (cambiar_gasto.pagado_por is distinct from yo or antes.creado_por is distinct from yo) then
    raise exception 'Un gasto solo tuyo lo anotas y lo pagas tú.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.personas p where p.id = cambiar_gasto.pagado_por and p.sacada_en is null) then
    raise exception 'Quien pagó no está en el grupo.' using errcode = '22023';
  end if;
  update public.gastos x
     set titulo = btrim(cambiar_gasto.titulo), categoria = cambiar_gasto.categoria, monto = cambiar_gasto.monto,
         fecha = cambiar_gasto.fecha, pagado_por = cambiar_gasto.pagado_por, division = cambiar_gasto.division,
         cambiado_en = now()
   where x.id = antes.id
  returning * into g;
  perform public.guardar_partes(g.id, g.monto, g.division, g.pagado_por, cambiar_gasto.partes);
  return g;
end;
$$;

-- Poner la foto de la boleta, ya subida a la carpeta del gasto, o quitarla (sin ruta)
create function public.poner_boleta(gasto uuid, ruta text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.cambio_gasto(poner_boleta.gasto) then
    raise exception 'Solo quien lo anotó, quien pagó o quien administra puede cambiar este gasto.' using errcode = '42501';
  end if;
  if poner_boleta.ruta is not null and public.gasto_de_ruta(poner_boleta.ruta) is distinct from poner_boleta.gasto then
    raise exception 'La foto tiene que estar en la carpeta del gasto.' using errcode = '22023';
  end if;
  update public.gastos x set boleta = poner_boleta.ruta, cambiado_en = now() where x.id = poner_boleta.gasto;
end;
$$;

-- Eliminar un gasto y deshacerlo
create function public.borrar_gasto(gasto uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.cambio_gasto(borrar_gasto.gasto) then
    raise exception 'Solo quien lo anotó, quien pagó o quien administra puede eliminar este gasto.' using errcode = '42501';
  end if;
  update public.gastos x set borrado_en = now() where x.id = borrar_gasto.gasto and x.borrado_en is null;
end;
$$;

create function public.devolver_gasto(gasto uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.cambio_gasto(devolver_gasto.gasto) then
    raise exception 'Solo quien lo anotó, quien pagó o quien administra puede devolver este gasto.' using errcode = '42501';
  end if;
  update public.gastos x set borrado_en = null where x.id = devolver_gasto.gasto;
end;
$$;

-- Marcar que le transferiste a alguien (y deshacerlo). Lo marca quien transfiere.
create function public.marcar_pagado(a uuid, monto int)
returns public.pagos
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  p public.pagos;
begin
  if yo is null then raise exception 'No estás en Puente.' using errcode = '42501'; end if;
  if marcar_pagado.a = yo then raise exception 'No te puedes pagar a ti.' using errcode = '22023'; end if;
  if not exists (select 1 from public.personas x where x.id = marcar_pagado.a and x.sacada_en is null) then
    raise exception 'Esa persona no está en el grupo.' using errcode = '22023';
  end if;
  insert into public.pagos (de, a, monto) values (yo, marcar_pagado.a, marcar_pagado.monto) returning * into p;
  return p;
end;
$$;

create function public.deshacer_pago(pago uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.pagos x set borrado_en = now()
   where x.id = deshacer_pago.pago and x.de = public.mi_persona() and x.borrado_en is null;
  if not found then raise exception 'Solo quien marcó el pago lo puede deshacer.' using errcode = '42501'; end if;
end;
$$;

alter table public.gastos enable row level security;
alter table public.partes enable row level security;
alter table public.pagos enable row level security;
alter table public.rendiciones enable row level security;

create policy "Los invitados ven los gastos, salvo los de una sola persona" on public.gastos
for select to authenticated using (public.mi_persona() is not null and (division <> 'solo' or pagado_por = public.mi_persona()));

create policy "Se ven las partes de los gastos que se ven" on public.partes
for select to authenticated using (public.veo_gasto(gasto));

create policy "Los invitados ven los pagos" on public.pagos
for select to authenticated using (public.mi_persona() is not null);

create policy "Cada uno ve lo que rinde" on public.rendiciones
for select to authenticated using (persona = public.mi_persona());
create policy "Cada uno marca lo que rinde" on public.rendiciones
for insert to authenticated with check (persona = public.mi_persona() and public.veo_gasto(gasto));
create policy "Cada uno desmarca lo que rinde" on public.rendiciones
for delete to authenticated using (persona = public.mi_persona());

revoke all on public.gastos, public.partes, public.pagos, public.rendiciones from anon, authenticated;
grant select on public.gastos, public.partes, public.pagos to authenticated;
grant select, insert, delete on public.rendiciones to authenticated;

revoke all on function public.veo_gasto(uuid), public.cambio_gasto(uuid), public.gasto_de_ruta(text),
  public.guardar_partes(uuid, int, text, uuid, jsonb),
  public.anotar_gasto(text, text, int, date, uuid, text, jsonb), public.cambiar_gasto(uuid, text, text, int, date, uuid, text, jsonb),
  public.poner_boleta(uuid, text), public.borrar_gasto(uuid), public.devolver_gasto(uuid),
  public.marcar_pagado(uuid, int), public.deshacer_pago(uuid) from public, anon;
revoke all on function public.guardar_partes(uuid, int, text, uuid, jsonb) from authenticated;
grant execute on function public.veo_gasto(uuid), public.cambio_gasto(uuid), public.gasto_de_ruta(text),
  public.anotar_gasto(text, text, int, date, uuid, text, jsonb), public.cambiar_gasto(uuid, text, text, int, date, uuid, text, jsonb),
  public.poner_boleta(uuid, text), public.borrar_gasto(uuid), public.devolver_gasto(uuid),
  public.marcar_pagado(uuid, int), public.deshacer_pago(uuid) to authenticated;

-- Las boletas: privadas, en JPEG de hasta 5 MB, en la carpeta de su gasto
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('boletas', 'boletas', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "Ven la boleta quienes ven el gasto" on storage.objects
for select to authenticated using (bucket_id = 'boletas' and public.veo_gasto(public.gasto_de_ruta(name)));
create policy "Suben la boleta quienes cambian el gasto" on storage.objects
for insert to authenticated with check (bucket_id = 'boletas' and public.cambio_gasto(public.gasto_de_ruta(name)));
create policy "Borran la boleta quienes cambian el gasto" on storage.objects
for delete to authenticated using (bucket_id = 'boletas' and public.cambio_gasto(public.gasto_de_ruta(name)));
