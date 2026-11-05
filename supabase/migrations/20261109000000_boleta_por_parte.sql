-- La foto de la boleta también la puede poner quien tiene una parte en el gasto: así nadie espera a que quien pagó
-- se acuerde de subirla. Para que una foto no se pise entre varios, quien solo tiene una parte pone la foto cuando
-- falta, y después cambia, quita o deshace únicamente la que puso él; la de otra persona la ve y nada más.
-- Quien anotó, quien pagó y quien administra siguen pudiendo todo, como antes.

-- Quién puso la foto que está ahora. Las fotos puestas antes de esta migración quedan sin dueño: para quien solo
-- tiene una parte cuentan como ajenas, y siguen en manos de quien las podía cambiar.
alter table public.gastos add column boleta_por uuid references public.personas (id);

-- ¿Puedo poner, cambiar o quitar la foto? Quien cambia el gasto, siempre. Quien tiene una parte, si el gasto se
-- divide y no está eliminado, y la foto falta o la puso él.
create function public.cambio_boleta(gasto uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.cambio_gasto(cambio_boleta.gasto) or exists (
    select 1 from public.gastos g
      join public.partes p on p.gasto = g.id and p.persona = public.mi_persona()
     where g.id = cambio_boleta.gasto and g.division <> 'solo' and g.borrado_en is null
       and (g.boleta is null or g.boleta_por = public.mi_persona())
  )
$$;

-- Poner la foto de la boleta, ya subida a la carpeta del gasto, o quitarla (sin ruta). Se toma el gasto antes de
-- revisar: si dos ponen la foto a la vez, el segundo ya ve la del primero y, si no puede reemplazarla, se le rechaza.
create or replace function public.poner_boleta(gasto uuid, ruta text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.gastos x where x.id = poner_boleta.gasto for update;
  if not public.cambio_boleta(poner_boleta.gasto) then
    raise exception 'No puedes cambiar esta foto: la puso otra persona o no tienes una parte en este gasto.' using errcode = '42501';
  end if;
  if poner_boleta.ruta is not null and public.gasto_de_ruta(poner_boleta.ruta) is distinct from poner_boleta.gasto then
    raise exception 'La foto tiene que estar en la carpeta del gasto.' using errcode = '22023';
  end if;
  update public.gastos x
     set boleta = poner_boleta.ruta,
         boleta_por = case when poner_boleta.ruta is null then null else public.mi_persona() end,
         cambiado_en = now()
   where x.id = poner_boleta.gasto;
end;
$$;

revoke all on function public.cambio_boleta(uuid) from public, anon;
grant execute on function public.cambio_boleta(uuid) to authenticated;

-- Los archivos siguen la misma regla. Además, cada uno puede borrar lo que subió y no quedó como foto del gasto:
-- si otra persona puso la suya primero, la subida rechazada no se queda ocupando espacio.
drop policy "Suben la boleta quienes cambian el gasto" on storage.objects;
drop policy "Borran la boleta quienes cambian el gasto" on storage.objects;

create policy "Suben la boleta quienes pueden ponerla" on storage.objects
for insert to authenticated with check (bucket_id = 'boletas' and public.cambio_boleta(public.gasto_de_ruta(name)));
create policy "Borran la boleta quienes pueden ponerla, o lo suyo que no quedó" on storage.objects
for delete to authenticated using (
  bucket_id = 'boletas' and (
    public.cambio_boleta(public.gasto_de_ruta(name))
    or (owner_id = (select auth.uid())::text
        and objects.name is distinct from (select g.boleta from public.gastos g where g.id = public.gasto_de_ruta(objects.name)))
  )
);
