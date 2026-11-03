-- Lista de espera: cada vez que se libera un cupo entra el primero de la lista, venga de donde venga.
-- Antes solo pasaba al soltarlo uno mismo o al agrandar los cupos; ahora también cuando quien organiza saca a alguien.
-- Además, si quien organiza había sumado gente de más, soltar un cupo no hace entrar a nadie hasta que haya lugar.

-- Llena los cupos libres con la lista de espera, por orden de llegada. Para todos: entran todos. Cerrado: la lista se borra.
create function public.llenar_cupos(evento uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.eventos;
  quedan int;
begin
  select * into e from public.eventos where id = evento;
  if not found then return; end if;
  if e.modo = 'para_todos' then
    update public.asistentes a set estado = 'va', desde = clock_timestamp() where a.evento = e.id and a.estado = 'espera';
  elsif e.modo = 'con_cupo' then
    select e.cupos - count(*) into quedan from public.asistentes a where a.evento = e.id and a.estado = 'va';
    if quedan > 0 then
      update public.asistentes set estado = 'va', desde = clock_timestamp()
       where (asistentes.evento, asistentes.persona) in (
         select a.evento, a.persona from public.asistentes a
          where a.evento = e.id and a.estado = 'espera'
          order by a.desde limit quedan
       );
    end if;
  else
    delete from public.asistentes a where a.evento = e.id and a.estado = 'espera';
  end if;
end;
$$;

create or replace function public.no_ir(evento uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  e public.eventos;
begin
  if yo is null then raise exception 'No estás en Puente.' using errcode = '42501'; end if;
  select * into e from public.eventos where id = evento for update;
  if not found then return; end if;
  delete from public.asistentes a where a.evento = e.id and a.persona = yo;
  perform public.llenar_cupos(e.id);
end;
$$;

create or replace function public.sacar_de_evento(evento uuid, persona uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.eventos;
begin
  select * into e from public.eventos where id = evento for update;
  if not found then return; end if;
  if e.organizador is distinct from public.mi_persona() and not public.administro() then
    raise exception 'Solo quien organiza puede sacar gente.' using errcode = '42501';
  end if;
  delete from public.asistentes a where a.evento = e.id and a.persona = sacar_de_evento.persona;
  perform public.llenar_cupos(e.id);
end;
$$;

create or replace function public.al_cambiar_cupos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.llenar_cupos(new.id);
  return null;
end;
$$;

revoke all on function public.llenar_cupos(uuid) from public, anon, authenticated;
