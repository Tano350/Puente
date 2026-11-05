-- "Deshacer" después de sacar a alguien de un evento la devuelve sin avisarle: sumar_a_evento recibe un tercer
-- parámetro opcional, avisar (por omisión true). Con false se pausan los avisos solo durante esa llamada, así que a
-- la persona no le llega "te sumó a …" por algo que nunca supo que pasó.
--
-- Cambia la firma, así que se borra la anterior y se crea de nuevo, con el mismo cuerpo y los mismos permisos.
-- Para publicarlo: aplicar esta migración y después desplegar la app (la app solo manda avisar cuando es false,
-- así que también funciona con la app de antes).

drop function public.sumar_a_evento(uuid, uuid);

create function public.sumar_a_evento(evento uuid, persona uuid, avisar boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.eventos;
  pausa text := coalesce(current_setting('puente.sin_avisos', true), '');
begin
  select * into e from public.eventos where id = evento for update;
  if not found then raise exception 'Ese evento ya no está.' using errcode = 'P0002'; end if;
  if e.organizador is distinct from public.mi_persona() and not public.administro() then
    raise exception 'Solo quien organiza puede sumar gente.' using errcode = '42501';
  end if;
  if avisar is false then perform set_config('puente.sin_avisos', 'si', true); end if;
  insert into public.asistentes (evento, persona, estado) values (e.id, sumar_a_evento.persona, 'va')
  on conflict on constraint asistentes_pkey do update set estado = 'va';
  -- Solo para esta llamada: lo que venga después en la misma transacción vuelve a avisar como antes
  if avisar is false then perform set_config('puente.sin_avisos', pausa, true); end if;
end;
$$;

revoke all on function public.sumar_a_evento(uuid, uuid, boolean) from public, anon;
grant execute on function public.sumar_a_evento(uuid, uuid, boolean) to authenticated;
