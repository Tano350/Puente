-- Primera vez: cuándo la persona terminó la lista de tareas y fue a Hoy.
-- Avisos: qué tipos quiere recibir cada uno y en qué dispositivos.

alter table public.personas
  add column bienvenida_en timestamptz,
  add column avisos jsonb not null default '{"eventos": true, "cambios": true, "espera": true, "recordatorio": true, "contacto": true, "pago": true}'::jsonb;

grant update (bienvenida_en, avisos) on public.personas to authenticated;

-- Un dispositivo con los avisos activados (Web Push)
create table public.suscripciones (
  endpoint text primary key,
  persona uuid not null references public.personas (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  creada_en timestamptz not null default now()
);

alter table public.suscripciones enable row level security;

create policy "Cada uno ve sus dispositivos"
on public.suscripciones for select
to authenticated
using (persona = public.mi_persona());

create policy "Cada uno agrega sus dispositivos"
on public.suscripciones for insert
to authenticated
with check (persona = public.mi_persona());

create policy "Cada uno actualiza sus dispositivos"
on public.suscripciones for update
to authenticated
using (persona = public.mi_persona())
with check (persona = public.mi_persona());

create policy "Cada uno quita sus dispositivos"
on public.suscripciones for delete
to authenticated
using (persona = public.mi_persona());

revoke all on public.suscripciones from anon, authenticated;
grant select, insert, update, delete on public.suscripciones to authenticated;
