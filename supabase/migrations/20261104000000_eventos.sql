-- Agenda: eventos, quiénes van, ratos ocupados y notas de reunión.
-- Todos los invitados ven todos los eventos. Los crea cualquiera; los cambia quien organiza o quien administra.
-- Ir o dejar de ir pasa por funciones de la base, en un solo paso: si dos toman el último cupo, uno lo consigue.

create type public.tipo_evento as enum ('visita', 'reunion', 'comida', 'otro');
-- para_todos: sin cupo, cada uno confirma. con_cupo: por orden de llegada, con lista de espera.
-- cerrado: solo los que suma quien organiza; los demás lo ven.
create type public.modo_evento as enum ('para_todos', 'con_cupo', 'cerrado');

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (btrim(titulo) <> ''),
  tipo public.tipo_evento not null default 'otro',
  lugar text,
  direccion text,
  inicio timestamptz not null,
  fin timestamptz not null,
  modo public.modo_evento not null default 'para_todos',
  cupos int check (cupos between 1 and 99),
  organizador uuid references public.personas (id),
  notas text,
  -- Una reunión que salió de un contacto
  contacto uuid references public.contactos (id) on delete set null,
  -- Lo creado directo en el calendario de Google llega sin cupos ni organizador
  google_id text unique,
  desde_google boolean not null default false,
  creado_por uuid default public.mi_persona() references public.personas (id),
  creado_en timestamptz not null default now(),
  cambiado_en timestamptz not null default now(),
  cancelado_en timestamptz,
  constraint termina_despues check (fin > inicio),
  constraint cupos_solo_con_cupo check ((modo = 'con_cupo') = (cupos is not null))
);

create index eventos_inicio on public.eventos (inicio);

create table public.asistentes (
  evento uuid not null references public.eventos (id) on delete cascade,
  persona uuid not null references public.personas (id),
  -- va: tiene su lugar. espera: en la lista de espera, por orden de llegada
  estado text not null check (estado in ('va', 'espera')),
  desde timestamptz not null default clock_timestamp(),
  primary key (evento, persona)
);

create index asistentes_persona on public.asistentes (persona);

-- Ratos ocupados: solo en Puente, cada uno ve los suyos (los demás solo cuentan para la disponibilidad)
create table public.ocupados (
  id uuid primary key default gen_random_uuid(),
  persona uuid not null default public.mi_persona() references public.personas (id),
  titulo text not null check (btrim(titulo) <> ''),
  inicio timestamptz not null,
  fin timestamptz not null,
  constraint termina_despues check (fin > inicio)
);

-- Notas de reunión: cada uno escribe las suyas; quedan en el evento y en el contacto, si salió de uno
create table public.notas_reunion (
  evento uuid not null references public.eventos (id) on delete cascade,
  autor uuid not null default public.mi_persona() references public.personas (id),
  aprendi text,
  sigue text,
  escrita_en timestamptz not null default now(),
  primary key (evento, autor)
);

-- Quien crea el evento va (y organiza); "cambiado_en" ayuda a sincronizar con el calendario
create function public.al_crear_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organizador is not null then
    insert into public.asistentes (evento, persona, estado) values (new.id, new.organizador, 'va') on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger al_crear_evento
after insert on public.eventos
for each row execute function public.al_crear_evento();

create function public.al_cambiar_evento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.cambiado_en := now();
  return new;
end;
$$;

create trigger al_cambiar_evento
before update on public.eventos
for each row execute function public.al_cambiar_evento();

-- Si quien organiza agranda los cupos (o lo abre para todos), entran los de la lista de espera por orden de llegada.
-- Si lo cierra, la lista de espera se borra: ahí solo van los que suma.
create function public.al_cambiar_cupos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quedan int;
begin
  if new.modo = 'para_todos' then
    update public.asistentes a set estado = 'va', desde = clock_timestamp() where a.evento = new.id and a.estado = 'espera';
  elsif new.modo = 'con_cupo' then
    select new.cupos - count(*) into quedan from public.asistentes a where a.evento = new.id and a.estado = 'va';
    if quedan > 0 then
      update public.asistentes set estado = 'va', desde = clock_timestamp()
       where (asistentes.evento, asistentes.persona) in (
         select a.evento, a.persona from public.asistentes a
          where a.evento = new.id and a.estado = 'espera'
          order by a.desde limit quedan
       );
    end if;
  else
    delete from public.asistentes a where a.evento = new.id and a.estado = 'espera';
  end if;
  return null;
end;
$$;

create trigger al_cambiar_cupos
after update of modo, cupos on public.eventos
for each row execute function public.al_cambiar_cupos();

-- ¿Está allá ese día? (el día del evento en California, dentro de su estadía)
create function public.esta_alla(persona uuid, momento timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.personas p
     where p.id = persona
       and p.llega is not null and p.vuelve is not null
       and (momento at time zone 'America/Los_Angeles')::date between p.llega and p.vuelve
  )
$$;

-- Ir a un evento: "para todos" confirma; "con cupo" toma un lugar si queda; "cerrado" no se puede por cuenta propia
create function public.ir(evento uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  e public.eventos;
  ocupados_ya int;
begin
  if yo is null then raise exception 'No estás en Puente.' using errcode = '42501'; end if;
  select * into e from public.eventos where id = evento for update;
  if not found or e.cancelado_en is not null then raise exception 'Ese evento ya no está.' using errcode = 'P0002'; end if;
  if e.fin < now() then raise exception 'Ese evento ya pasó.' using errcode = '22023', hint = 'paso'; end if;
  if not public.esta_alla(yo, e.inicio) then raise exception 'Ese día no estás allá.' using errcode = '22023', hint = 'no_estas'; end if;
  if e.modo = 'cerrado' then raise exception 'Solo van los que suma quien organiza.' using errcode = '42501', hint = 'cerrado'; end if;
  if exists (select 1 from public.asistentes a where a.evento = e.id and a.persona = yo and a.estado = 'va') then return 'va'; end if;
  if e.modo = 'con_cupo' then
    select count(*) into ocupados_ya from public.asistentes a where a.evento = e.id and a.estado = 'va';
    if ocupados_ya >= e.cupos then raise exception 'Ya no quedan cupos.' using errcode = '22023', hint = 'lleno'; end if;
  end if;
  insert into public.asistentes (evento, persona, estado) values (e.id, yo, 'va')
  on conflict on constraint asistentes_pkey do update set estado = 'va', desde = clock_timestamp();
  return 'va';
end;
$$;

-- Anotarse en la lista de espera de un evento lleno
create function public.esperar(evento uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  e public.eventos;
  puesto int;
begin
  if yo is null then raise exception 'No estás en Puente.' using errcode = '42501'; end if;
  select * into e from public.eventos where id = evento for update;
  if not found or e.cancelado_en is not null then raise exception 'Ese evento ya no está.' using errcode = 'P0002'; end if;
  if e.modo <> 'con_cupo' then raise exception 'Este evento no tiene lista de espera.' using errcode = '22023'; end if;
  if not public.esta_alla(yo, e.inicio) then raise exception 'Ese día no estás allá.' using errcode = '22023', hint = 'no_estas'; end if;
  insert into public.asistentes (evento, persona, estado) values (e.id, yo, 'espera') on conflict do nothing;
  select count(*) into puesto from public.asistentes a
   where a.evento = e.id and a.estado = 'espera'
     and a.desde <= (select propio.desde from public.asistentes propio where propio.evento = e.id and propio.persona = yo);
  return puesto;
end;
$$;

-- Dejar de ir (o salir de la lista de espera). Si se suelta un cupo, entra el primero de la lista.
create function public.no_ir(evento uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  yo uuid := public.mi_persona();
  e public.eventos;
  estaba text;
begin
  if yo is null then raise exception 'No estás en Puente.' using errcode = '42501'; end if;
  select * into e from public.eventos where id = evento for update;
  if not found then return; end if;
  delete from public.asistentes a where a.evento = e.id and a.persona = yo returning a.estado into estaba;
  if estaba = 'va' and e.modo = 'con_cupo' then
    update public.asistentes set estado = 'va', desde = clock_timestamp()
     where (asistentes.evento, asistentes.persona) = (
       select a.evento, a.persona from public.asistentes a
        where a.evento = e.id and a.estado = 'espera'
        order by a.desde limit 1
     );
  end if;
end;
$$;

-- Quien organiza (o administra) suma o saca gente a mano
create function public.sumar_a_evento(evento uuid, persona uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.eventos;
begin
  select * into e from public.eventos where id = evento for update;
  if not found then raise exception 'Ese evento ya no está.' using errcode = 'P0002'; end if;
  if e.organizador is distinct from public.mi_persona() and not public.administro() then
    raise exception 'Solo quien organiza puede sumar gente.' using errcode = '42501';
  end if;
  insert into public.asistentes (evento, persona, estado) values (e.id, sumar_a_evento.persona, 'va')
  on conflict on constraint asistentes_pkey do update set estado = 'va';
end;
$$;

create function public.sacar_de_evento(evento uuid, persona uuid)
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
end;
$$;

-- Disponibilidad para Crear evento: cuántos están allá ese día y cuántos de ellos tienen libre esa hora.
-- Puente no sugiere horarios: solo informa.
create function public.libres(desde timestamptz, hasta timestamptz)
returns table (alla int, libres int)
language sql
stable
security definer
set search_path = ''
as $$
  with presentes as (
    select p.id from public.personas p
     where p.sacada_en is null and public.esta_alla(p.id, libres.desde)
  )
  select
    (select count(*) from presentes)::int,
    (select count(*) from presentes
      where not exists (
        select 1 from public.asistentes a join public.eventos e on e.id = a.evento
         where a.persona = presentes.id and a.estado = 'va' and e.cancelado_en is null
           and e.inicio < libres.hasta and e.fin > libres.desde
      )
      and not exists (
        select 1 from public.ocupados o where o.persona = presentes.id and o.inicio < libres.hasta and o.fin > libres.desde
      ))::int
$$;

alter table public.eventos enable row level security;
alter table public.asistentes enable row level security;
alter table public.ocupados enable row level security;
alter table public.notas_reunion enable row level security;

create policy "Los invitados ven los eventos" on public.eventos
for select to authenticated using (public.mi_persona() is not null);

create policy "Cada uno crea eventos que organiza" on public.eventos
for insert to authenticated
with check (organizador = public.mi_persona() and creado_por = public.mi_persona() and not desde_google and google_id is null);

create policy "Cambian el evento quien organiza y quien administra" on public.eventos
for update to authenticated
using (organizador = public.mi_persona() or public.administro())
with check (organizador = public.mi_persona() or public.administro());

-- Borrar solo sirve para deshacer un evento recién creado; lo demás se cancela
create policy "Quien lo creó lo puede borrar" on public.eventos
for delete to authenticated using (creado_por = public.mi_persona());

create policy "Los invitados ven quiénes van" on public.asistentes
for select to authenticated using (public.mi_persona() is not null);

create policy "Cada uno ve sus ratos ocupados" on public.ocupados
for select to authenticated using (persona = public.mi_persona());
create policy "Cada uno marca sus ratos ocupados" on public.ocupados
for insert to authenticated with check (persona = public.mi_persona());
create policy "Cada uno cambia sus ratos ocupados" on public.ocupados
for update to authenticated using (persona = public.mi_persona()) with check (persona = public.mi_persona());
create policy "Cada uno borra sus ratos ocupados" on public.ocupados
for delete to authenticated using (persona = public.mi_persona());

create policy "Los invitados ven las notas de reunión" on public.notas_reunion
for select to authenticated using (public.mi_persona() is not null);
create policy "Cada uno escribe sus notas de reunión" on public.notas_reunion
for insert to authenticated with check (autor = public.mi_persona());
create policy "Cada uno cambia sus notas de reunión" on public.notas_reunion
for update to authenticated using (autor = public.mi_persona()) with check (autor = public.mi_persona());
create policy "Cada uno borra sus notas de reunión" on public.notas_reunion
for delete to authenticated using (autor = public.mi_persona());

revoke all on public.eventos, public.asistentes, public.ocupados, public.notas_reunion from anon, authenticated;
grant select, insert, delete on public.eventos to authenticated;
grant update (titulo, tipo, lugar, direccion, inicio, fin, modo, cupos, organizador, notas, contacto, cancelado_en) on public.eventos to authenticated;
grant select on public.asistentes to authenticated;
grant select, insert, update, delete on public.ocupados to authenticated;
grant select, insert, delete on public.notas_reunion to authenticated;
grant update (aprendi, sigue, escrita_en) on public.notas_reunion to authenticated;

revoke all on function public.esta_alla(uuid, timestamptz), public.ir(uuid), public.esperar(uuid), public.no_ir(uuid),
  public.sumar_a_evento(uuid, uuid), public.sacar_de_evento(uuid, uuid), public.libres(timestamptz, timestamptz),
  public.al_crear_evento(), public.al_cambiar_evento(), public.al_cambiar_cupos() from public, anon;
grant execute on function public.ir(uuid), public.esperar(uuid), public.no_ir(uuid), public.sumar_a_evento(uuid, uuid),
  public.sacar_de_evento(uuid, uuid), public.libres(timestamptz, timestamptz) to authenticated;
