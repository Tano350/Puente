-- Sin señal: un gasto anotado sin conexión lleva un id creado en el dispositivo y sube cuando vuelve la señal.
-- Si se reintenta (la app se cerró, se cortó la señal a medio camino), anotar_gasto con el mismo id devuelve el gasto
-- que ya está, sin cambiarlo ni duplicarlo. Sin id funciona como antes.

drop function public.anotar_gasto(text, text, int, date, uuid, text, jsonb);

create function public.anotar_gasto(titulo text, categoria text, monto int, fecha date, pagado_por uuid, division text, partes jsonb, id uuid default null)
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
  -- Un reintento: si ya lo anotaste, se devuelve tal cual; el id de un gasto de otra persona no se puede usar
  if anotar_gasto.id is not null then
    select * into g from public.gastos x where x.id = anotar_gasto.id;
    if found then
      if g.creado_por is distinct from yo then
        raise exception 'Ese gasto ya existe.' using errcode = '23505';
      end if;
      return g;
    end if;
  end if;
  if anotar_gasto.division = 'solo' and anotar_gasto.pagado_por is distinct from yo then
    raise exception 'Un gasto solo tuyo lo pagas tú.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.personas p where p.id = anotar_gasto.pagado_por and p.sacada_en is null) then
    raise exception 'Quien pagó no está en el grupo.' using errcode = '22023';
  end if;
  insert into public.gastos (id, titulo, categoria, monto, fecha, pagado_por, division, creado_por)
  values (coalesce(anotar_gasto.id, gen_random_uuid()), btrim(anotar_gasto.titulo), anotar_gasto.categoria, anotar_gasto.monto,
          anotar_gasto.fecha, anotar_gasto.pagado_por, anotar_gasto.division, yo)
  returning * into g;
  perform public.guardar_partes(g.id, g.monto, g.division, g.pagado_por, anotar_gasto.partes);
  return g;
end;
$$;

revoke all on function public.anotar_gasto(text, text, int, date, uuid, text, jsonb, uuid) from public, anon;
grant execute on function public.anotar_gasto(text, text, int, date, uuid, text, jsonb, uuid) to authenticated;
