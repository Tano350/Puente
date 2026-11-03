-- Contactos del viaje y sus notas.
-- Todos los invitados ven los contactos, salvo los personales, que ve solo quien los creó (ni los administradores).
-- Cambian un contacto quien lo creó, su responsable y quien administra. Las notas tienen autor y pueden ser personales.

create type public.etapa as enum ('por_contactar', 'contactado', 'respondio', 'reunion_agendada', 'reunion_hecha', 'descartado');
create type public.canal as enum ('correo', 'linkedin', 'telefono');

create table public.contactos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  organizacion text,
  canal public.canal,
  -- El correo, el enlace de LinkedIn o el teléfono
  dato text,
  responsable uuid not null references public.personas (id),
  -- Quién le pasó el contacto a su responsable ("Te lo asignó Diego.")
  asignado_por uuid references public.personas (id),
  personal boolean not null default false,
  etapa public.etapa not null default 'por_contactar',
  etapa_en timestamptz not null default now(),
  creado_por uuid not null default public.mi_persona() references public.personas (id),
  creado_en timestamptz not null default now(),
  constraint personal_es_de_quien_lo_crea check (not personal or responsable = creado_por)
);

create index contactos_responsable on public.contactos (responsable);

create table public.notas (
  id uuid primary key default gen_random_uuid(),
  contacto uuid not null references public.contactos (id) on delete cascade,
  autor uuid not null default public.mi_persona() references public.personas (id),
  texto text not null check (btrim(texto) <> ''),
  personal boolean not null default false,
  creada_en timestamptz not null default now()
);

create index notas_contacto on public.notas (contacto);

-- Quién asignó el contacto y desde cuándo está en su etapa los pone la base, no la app
create function public.al_cambiar_contacto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.asignado_por := case when new.responsable <> new.creado_por then new.creado_por end;
    new.etapa_en := now();
  else
    if new.responsable is distinct from old.responsable then
      new.asignado_por := case when new.responsable <> public.mi_persona() then public.mi_persona() end;
    end if;
    -- Deshacer manda la fecha anterior; un cambio normal de etapa toma la hora actual
    if new.etapa is distinct from old.etapa and new.etapa_en = old.etapa_en then
      new.etapa_en := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger al_cambiar_contacto
before insert or update on public.contactos
for each row execute function public.al_cambiar_contacto();

alter table public.contactos enable row level security;
alter table public.notas enable row level security;

create policy "Los invitados ven los contactos" on public.contactos
for select to authenticated
using (public.mi_persona() is not null and (not personal or creado_por = public.mi_persona()));

create policy "Cada uno agrega contactos" on public.contactos
for insert to authenticated
with check (creado_por = public.mi_persona() and (not personal or responsable = public.mi_persona()));

create policy "Cambian el contacto quien lo creó, su responsable y quien administra" on public.contactos
for update to authenticated
using (
  (creado_por = public.mi_persona() or responsable = public.mi_persona() or public.administro())
  and (not personal or creado_por = public.mi_persona())
)
with check (not personal or (creado_por = public.mi_persona() and responsable = public.mi_persona()));

-- Borrar solo sirve para deshacer un contacto recién agregado; lo demás se descarta
create policy "Quien lo creó lo puede borrar" on public.contactos
for delete to authenticated
using (creado_por = public.mi_persona());

create policy "Se ven las notas de los contactos que se ven" on public.notas
for select to authenticated
using ((not personal or autor = public.mi_persona()) and exists (select 1 from public.contactos c where c.id = contacto));

create policy "Cada uno agrega notas" on public.notas
for insert to authenticated
with check (autor = public.mi_persona() and exists (select 1 from public.contactos c where c.id = contacto));

create policy "Cada uno cambia sus notas" on public.notas
for update to authenticated
using (autor = public.mi_persona())
with check (autor = public.mi_persona());

create policy "Cada uno borra sus notas" on public.notas
for delete to authenticated
using (autor = public.mi_persona());

revoke all on public.contactos, public.notas from anon, authenticated;
grant select, insert, delete on public.contactos to authenticated;
grant update (nombre, organizacion, canal, dato, responsable, personal, etapa, etapa_en) on public.contactos to authenticated;
grant select, insert, delete on public.notas to authenticated;
grant update (texto, personal) on public.notas to authenticated;
