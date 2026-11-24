-- Avisos de los eventos que van primero a los de un tema (20261124000000_intereses.sql). No hay un tipo nuevo: es el
-- mismo aviso de "Evento nuevo" (tipo 'eventos', con su interruptor), que llega a quien corresponde en cada momento:
-- - Evento nuevo que todavía es solo para su tema: solo a los de ese tema (además de los filtros de siempre: está allá
--   ese día, sigue en Puente, no lo creó, no lo organiza, no hizo la acción, no está ya en el evento y quiere el
--   aviso). Un evento sin tema, o que ya nació abierto, avisa como siempre.
-- - Se abrió a todos (abierto_en pasa de vacío a una hora, en un evento con tema que no es cerrado, no está cancelado
--   y no ha empezado): a todos los demás que están allá ese día y no están ya en el evento. Se salta a quien ya tiene
--   un aviso de este evento, pendiente o enviado (así los del tema no lo reciben dos veces); uno descartado no cuenta,
--   porque nunca llegó. También cubre borrar_tema, que abre los eventos del tema.
-- - Se cambió el tema mientras sigue cerrado (de Fintech a IA): a los del tema nuevo que todavía no tienen uno.
-- - "Deshacer" lo vuelve a cerrar (dentro del primer minuto): no se encola nada. Lo que estaba esperando sus 10
--   segundos no se borra: al mandarlo, la función revisa que siga teniendo sentido y descarta el de quien no es del
--   tema ("Todavía es solo para los de Fintech."). Si se vuelve a abrir antes de que salga, ese mismo aviso sirve.
-- Al mandarlo, la función antepone "Primero para los de Fintech." mientras el evento siga siendo solo para su tema.
-- Como los demás triggers de avisos, nunca hace fallar lo que hizo la persona: si algo sale mal, avisa en el registro.
--
-- Para publicarlo, en este orden (la función nueva lee las columnas tema y abierto_en de los eventos; la de antes
-- sigue funcionando con esta migración, solo que sin el "Primero para…" ni el descarte):
-- 1. Aplicar 20261124000000_intereses.sql (si no se aplicó antes) y esta migración.
-- 2. npx supabase functions deploy avisos --no-verify-jwt --use-api
-- 3. Publicar la app.

-- Evento nuevo al que te puedes sumar (como en 20261106000000_avisos.sql). Si todavía es solo para su tema, solo a los
-- de ese tema.
create or replace function public.avisar_evento_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  begin
    if public.avisos_en_pausa() or new.modo = 'cerrado' or new.cancelado_en is not null or new.inicio <= now() then
      return null;
    end if;
    insert into public.avisos (persona, tipo, evento)
    select p.id, 'eventos', new.id
      from public.personas p
     where p.sacada_en is null
       and public.esta_alla(p.id, new.inicio)
       and p.id is distinct from new.creado_por
       and p.id is distinct from new.organizador
       and p.id is distinct from public.mi_persona()
       and not exists (select 1 from public.asistentes a where a.evento = new.id and a.persona = p.id)
       and (not public.solo_para_tema(new.tema, new.abierto_en, new.modo) or public.le_interesa(new.tema, p.id))
       and public.quiere_aviso(p.id, 'eventos');
    get diagnostics n = row_count;
    if n > 0 then perform public.despertar_avisos(); end if;
  exception when others then
    raise warning 'Puente no pudo preparar los avisos del evento nuevo %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

-- Se abrió a todos, o se cambió el tema mientras sigue cerrado: el aviso de "Evento nuevo" a quienes ahora les toca y
-- todavía no lo tienen. Si se abrió, a todos; si solo cambió el tema, a los del tema nuevo.
create function public.avisar_primero_para()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  begin
    if public.avisos_en_pausa() or old.tema is null or new.modo = 'cerrado' or new.cancelado_en is not null
       or new.inicio <= now() then
      return null;
    end if;
    -- Ni se abrió ni cambió el tema estando cerrado (por ejemplo, "Deshacer" lo volvió a cerrar): nada que encolar
    if not ((old.abierto_en is null and new.abierto_en is not null)
            or (new.tema is distinct from old.tema and public.solo_para_tema(new.tema, new.abierto_en, new.modo))) then
      return null;
    end if;
    insert into public.avisos (persona, tipo, evento)
    select p.id, 'eventos', new.id
      from public.personas p
     where p.sacada_en is null
       and public.esta_alla(p.id, new.inicio)
       and p.id is distinct from new.creado_por
       and p.id is distinct from new.organizador
       and p.id is distinct from public.mi_persona()
       and not exists (select 1 from public.asistentes a where a.evento = new.id and a.persona = p.id)
       -- Pendiente o enviado: ya lo tiene. Descartado: nunca le llegó.
       and not exists (
         select 1 from public.avisos v
          where v.evento = new.id and v.persona = p.id and v.tipo = 'eventos' and v.descartado is null
       )
       and (not public.solo_para_tema(new.tema, new.abierto_en, new.modo) or public.le_interesa(new.tema, p.id))
       and public.quiere_aviso(p.id, 'eventos');
    get diagnostics n = row_count;
    if n > 0 then perform public.despertar_avisos(); end if;
  exception when others then
    raise warning 'Puente no pudo preparar los avisos del evento % para su tema: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

create trigger avisar_primero_para
after update of abierto_en, tema on public.eventos
for each row
when (old.abierto_en is distinct from new.abierto_en or old.tema is distinct from new.tema)
execute function public.avisar_primero_para();

-- Sin permisos para la app: solo la base. (avisar_evento_nuevo conserva los suyos al reemplazarla; se repite igual.)
revoke all on function public.avisar_evento_nuevo(), public.avisar_primero_para() from public, anon, authenticated;
