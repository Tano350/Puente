-- Séptimo aviso: "Diego te sumó a Visita a Stripe", cuando otra persona te suma a un evento (quien organiza uno cerrado
-- te agrega, al crearlo o después). Se apaga con el mismo interruptor que los cambios ('cambios' en personas.avisos).
-- Cubre cada fila nueva de public.asistentes con estado 'va':
-- - sumar_a_evento (quien organiza o administra suma a alguien, también al crear un evento cerrado con gente elegida):
--   se avisa a quien sumaron. Si esa persona ya estaba en la lista de espera, sumar_a_evento la pasa a 'va' con un
--   UPDATE: ese caso ya lo avisa "Tienes cupo" (tipo 'espera'), no este.
-- - al_crear_evento (quien organiza queda en su evento) e ir (te sumas tú): lo hizo la misma persona, no se avisa
--   (encolar_aviso nunca avisa a quien hace la acción).
-- - llenar_cupos pasa gente de la espera a 'va' con UPDATE: lo cubre 'espera'.
-- - respaldo.recuperar pausa los avisos mientras vuelve a insertar.
-- No se avisa si el evento está cancelado o ya empezó. Al mandarlo, la función revisa que sigas en el evento (si quien
-- organiza lo deshizo, no sale), que no se haya cancelado y que no haya empezado.
--
-- Para publicarlo, en este orden (la función nueva entiende el tipo 'sumado'; la de antes lo descartaría):
-- 1. npx supabase functions deploy avisos --no-verify-jwt --use-api
-- 2. Aplicar esta migración.

-- El tipo nuevo. El check se creó en línea en 20261106000000_avisos.sql: Postgres lo llamó avisos_tipo_check.
alter table public.avisos drop constraint avisos_tipo_check;
alter table public.avisos add constraint avisos_tipo_check
  check (tipo in ('eventos', 'cambios', 'espera', 'recordatorio', 'contacto', 'pago', 'sumado'));

-- Igual que antes, salvo que 'sumado' usa la preferencia de 'cambios'
create or replace function public.quiere_aviso(persona uuid, tipo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.personas p
     where p.id = quiere_aviso.persona
       and p.sacada_en is null
       and (p.avisos -> case when quiere_aviso.tipo = 'sumado' then 'cambios' else quiere_aviso.tipo end) is distinct from 'false'::jsonb
       and exists (select 1 from public.suscripciones s where s.persona = p.id)
  )
$$;

-- Otra persona te sumó a un evento. En datos queda quién fue ({"quien": persona}), para escribir su nombre.
-- Si ya había un aviso igual esperando su salida (te sumó, lo deshizo y te volvió a sumar), queda uno solo.
create function public.avisar_sumado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if public.avisos_en_pausa() or new.persona is not distinct from public.mi_persona() then return null; end if;
    if not exists (select 1 from public.eventos e where e.id = new.evento and e.cancelado_en is null and e.inicio > now()) then
      return null;
    end if;
    delete from public.avisos v
     where v.tipo = 'sumado' and v.evento = new.evento and v.persona = new.persona
       and v.enviado_en is null and v.descartado is null and v.intentos = 0;
    perform public.encolar_aviso(new.persona, 'sumado', evento => new.evento,
      datos => jsonb_build_object('quien', public.mi_persona()));
  exception when others then
    raise warning 'Puente no pudo preparar el aviso de sumar a alguien al evento %: %', new.evento, sqlerrm;
  end;
  return null;
end;
$$;

create trigger avisar_sumado
after insert on public.asistentes
for each row
when (new.estado = 'va')
execute function public.avisar_sumado();

revoke all on function public.quiere_aviso(uuid, text), public.avisar_sumado() from public, anon, authenticated;
