-- Prueba de la reunión cancelada: si se cancela una reunión que salió de un contacto, el contacto vuelve a "Respondió";
-- "Deshacer" lo deja como estaba. Corre en una sola transacción que termina con un error a propósito:
-- si todo está bien, el mensaje es "PRUEBAS-OK" y no queda nada guardado. Si algo falla, el mensaje dice qué.
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres, después de aplicar
-- 20261107000000_reunion_cancelada.sql. Las fechas son de 2030 para no cruzarse con las estadías de verdad.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  a uuid;
  b uuid;
  k1 uuid;
  k2 uuid;
  k3 uuid;
  k4 uuid;
  k5 uuid;
  e1 uuid;
  e2 uuid;
  e3 uuid;
  e4 uuid;
  e5 uuid;
  e6 uuid;
  e7 uuid;
  n int;
  et text;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  -- A y B son miembros (ninguno administra)
  insert into public.personas (correo) values ('prueba.a@example.com') returning id into a;
  insert into public.personas (correo) values ('prueba.b@example.com') returning id into b;
  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba.a@example.com', 'authenticated', 'authenticated'),
    (ub, 'prueba.b@example.com', 'authenticated', 'authenticated');

  -- A tiene cinco contactos suyos y reuniones que salieron de ellos
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.contactos (nombre, responsable) values ('Contacto uno', a) returning id into k1;
  insert into public.contactos (nombre, responsable) values ('Contacto dos', a) returning id into k2;
  insert into public.contactos (nombre, responsable) values ('Contacto tres', a) returning id into k3;
  insert into public.contactos (nombre, responsable) values ('Contacto cuatro', a) returning id into k4;
  insert into public.contactos (nombre, responsable) values ('Contacto cinco', a) returning id into k5;
  update public.contactos set etapa = 'reunion_agendada' where id in (k1, k2, k4, k5);
  update public.contactos set etapa = 'contactado' where id = k3;
  insert into public.eventos (titulo, tipo, inicio, fin, organizador, contacto)
  values ('Reunión uno', 'reunion', '2030-01-10 18:00Z', '2030-01-10 19:00Z', a, k1) returning id into e1;
  insert into public.eventos (titulo, tipo, inicio, fin, organizador, contacto)
  values ('Reunión dos', 'reunion', '2030-01-11 18:00Z', '2030-01-11 19:00Z', a, k2) returning id into e2;
  insert into public.eventos (titulo, tipo, inicio, fin, organizador, contacto)
  values ('Otra reunión dos', 'reunion', '2030-01-12 18:00Z', '2030-01-12 19:00Z', a, k2) returning id into e3;
  insert into public.eventos (titulo, tipo, inicio, fin, organizador, contacto)
  values ('Reunión tres', 'reunion', '2030-01-13 18:00Z', '2030-01-13 19:00Z', a, k3) returning id into e4;
  insert into public.eventos (titulo, tipo, inicio, fin, organizador, contacto)
  values ('Reunión cinco', 'reunion', '2030-01-14 18:00Z', '2030-01-14 19:00Z', a, k5) returning id into e5;
  -- Una reunión de k5 que ya terminó no cuenta como otra vigente
  insert into public.eventos (titulo, tipo, inicio, fin, organizador, contacto)
  values ('Reunión pasada de cinco', 'reunion', '2020-01-10 18:00Z', '2020-01-10 19:00Z', a, k5) returning id into e6;

  -- Cancelar devuelve el contacto a "Respondió"
  update public.eventos set cancelado_en = now() where id = e1;
  select etapa::text into et from public.contactos where id = k1;
  if et <> 'respondio' then raise exception 'Cancelar la reunión dejó el contacto en "%" (esperaba respondio)', et; end if;

  -- Deshacer lo deja como estaba
  update public.eventos set cancelado_en = null where id = e1;
  select etapa::text into et from public.contactos where id = k1;
  if et <> 'reunion_agendada' then raise exception 'Deshacer dejó el contacto en "%" (esperaba reunion_agendada)', et; end if;

  -- Con otra reunión vigente no cambia; al cancelar la última, sí
  update public.eventos set cancelado_en = now() where id = e2;
  select etapa::text into et from public.contactos where id = k2;
  if et <> 'reunion_agendada' then raise exception 'Con otra reunión vigente, el contacto pasó a "%"', et; end if;
  update public.eventos set cancelado_en = now() where id = e3;
  select etapa::text into et from public.contactos where id = k2;
  if et <> 'respondio' then raise exception 'Al cancelar la última reunión, el contacto quedó en "%"', et; end if;
  -- Deshacer una de las dos lo devuelve; deshacer la otra no lo mueve de nuevo
  update public.eventos set cancelado_en = null where id = e3;
  select etapa::text into et from public.contactos where id = k2;
  if et <> 'reunion_agendada' then raise exception 'Deshacer la última cancelación dejó el contacto en "%"', et; end if;
  update public.eventos set cancelado_en = null where id = e2;
  select etapa::text into et from public.contactos where id = k2;
  if et <> 'reunion_agendada' then raise exception 'Deshacer la otra cancelación movió el contacto a "%"', et; end if;

  -- Un contacto en otra etapa no cambia, ni al cancelar ni al deshacer
  update public.eventos set cancelado_en = now() where id = e4;
  select etapa::text into et from public.contactos where id = k3;
  if et <> 'contactado' then raise exception 'Cancelar movió un contacto que estaba en contactado a "%"', et; end if;
  update public.eventos set cancelado_en = null where id = e4;
  select etapa::text into et from public.contactos where id = k3;
  if et <> 'contactado' then raise exception 'Deshacer movió un contacto que estaba en contactado a "%"', et; end if;

  -- Una reunión pasada del mismo contacto no cuenta como vigente
  update public.eventos set cancelado_en = now() where id = e5;
  select etapa::text into et from public.contactos where id = k5;
  if et <> 'respondio' then raise exception 'Con solo una reunión pasada, el contacto quedó en "%"', et; end if;

  -- Un contacto que alguien movió a mano a otra etapa no vuelve a "Reunión agendada" al deshacer
  update public.contactos set etapa = 'contactado' where id = k5;
  update public.eventos set cancelado_en = null where id = e5;
  select etapa::text into et from public.contactos where id = k5;
  if et <> 'contactado' then raise exception 'Deshacer movió un contacto que ya estaba en otra etapa a "%"', et; end if;

  -- B no puede cambiar el contacto de A, pero cancelar su propia reunión con ese contacto sí lo devuelve a "Respondió"
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  update public.contactos set etapa = 'contactado' where id = k4;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B pudo cambiar un contacto que no es suyo'; end if;
  insert into public.eventos (titulo, tipo, inicio, fin, organizador, contacto)
  values ('Reunión de B con el contacto de A', 'reunion', '2030-01-15 18:00Z', '2030-01-15 19:00Z', b, k4) returning id into e7;
  update public.eventos set cancelado_en = now() where id = e7;
  select etapa::text into et from public.contactos where id = k4;
  if et <> 'respondio' then raise exception 'B cancelando no devolvió el contacto a respondio (quedó en "%")', et; end if;
  update public.eventos set cancelado_en = null where id = e7;
  select etapa::text into et from public.contactos where id = k4;
  if et <> 'reunion_agendada' then raise exception 'B deshaciendo no devolvió el contacto a reunion_agendada (quedó en "%")', et; end if;

  -- Cancelar o deshacer no cambia quién tiene el contacto ni a quién se le avisa
  execute 'reset role';
  select count(*) into n from public.contactos where id in (k1, k2, k3, k4, k5) and responsable = a and asignado_por is null;
  if n <> 5 then raise exception 'Cancelar y deshacer cambiaron el responsable o quién asignó (% de 5 siguen igual)', n; end if;
  select count(*) into n from public.avisos where contacto in (k1, k2, k3, k4, k5) and tipo = 'contacto';
  if n <> 0 then raise exception 'Cancelar y deshacer avisaron de un contacto asignado (% avisos)', n; end if;

  raise exception 'PRUEBAS-OK';
end
$$;
