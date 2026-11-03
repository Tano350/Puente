-- Prueba de permisos de contactos y notas. Corre en una sola transacción que termina con un error a propósito:
-- si todo está bien, el mensaje es "PRUEBAS-OK" y no queda nada guardado. Si algo falla, el mensaje dice qué.
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  uc uuid := gen_random_uuid();
  a uuid;
  b uuid;
  c uuid;
  c1 uuid;
  c2 uuid;
  c3 uuid;
  n int;
  fila public.contactos;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  -- Tres invitados de prueba: A y B son miembros; C administra
  insert into public.personas (correo) values ('prueba.a@example.com') returning id into a;
  insert into public.personas (correo) values ('prueba.b@example.com') returning id into b;
  insert into public.personas (correo, administra) values ('prueba.c@example.com', true) returning id into c;
  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba.a@example.com', 'authenticated', 'authenticated'),
    (ub, 'prueba.b@example.com', 'authenticated', 'authenticated'),
    (uc, 'prueba.c@example.com', 'authenticated', 'authenticated');

  -- A agrega contactos y notas
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.contactos (nombre, responsable) values ('Contacto de A', a) returning id into c1;
  insert into public.contactos (nombre, responsable, personal) values ('Personal de A', a, true) returning id into c2;
  insert into public.contactos (nombre, responsable) values ('Para B', b) returning * into fila;
  c3 := fila.id;
  if fila.creado_por <> a then raise exception 'creado_por no es quien lo agrega'; end if;
  if fila.asignado_por is distinct from a then raise exception 'asignado_por no quedó en A al asignarle a B'; end if;
  begin
    insert into public.contactos (nombre, responsable, personal) values ('Personal para B', b, true);
    raise exception 'A pudo crear un contacto personal a cargo de B';
  exception when check_violation or insufficient_privilege then null;
  end;
  insert into public.notas (contacto, texto, personal) values (c1, 'Nota personal de A', true);
  insert into public.notas (contacto, texto) values (c1, 'Nota de A');

  -- B ve lo que no es personal y solo cambia lo suyo
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  select count(*) into n from public.contactos where id in (c1, c2, c3);
  if n <> 2 then raise exception 'B ve % contactos (esperaba 2: el personal de A no)', n; end if;
  select count(*) into n from public.notas where contacto = c1;
  if n <> 1 then raise exception 'B ve % notas de c1 (esperaba 1: la personal de A no)', n; end if;
  update public.contactos set etapa = 'contactado' where id = c1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B pudo cambiar un contacto que no es suyo'; end if;
  update public.contactos set etapa = 'contactado' where id = c3;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'B no pudo cambiar un contacto a su cargo'; end if;
  delete from public.contactos where id = c1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B pudo borrar un contacto que no creó'; end if;
  insert into public.notas (contacto, texto) values (c1, 'Nota de B');
  begin
    insert into public.notas (contacto, texto) values (c2, 'Nota en un contacto que no ve');
    raise exception 'B pudo anotar en un contacto personal de A';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.contactos set creado_por = b where id = c3;
    raise exception 'B pudo cambiar quién creó el contacto';
  exception when insufficient_privilege then null;
  end;

  -- C administra: cambia lo que no es suyo, pero tampoco ve lo personal
  execute 'reset role';
  execute como_usuario using uc;
  execute 'set local role authenticated';
  select count(*) into n from public.contactos where id in (c1, c2, c3);
  if n <> 2 then raise exception 'Quien administra ve % contactos (esperaba 2)', n; end if;
  update public.contactos set etapa = 'respondio' where id = c1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Quien administra no pudo cambiar un contacto'; end if;

  -- A le pasa su contacto a B: queda "Te lo asignó A"
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  update public.contactos set responsable = b where id = c1 returning * into fila;
  if fila.asignado_por is distinct from a then raise exception 'Al reasignar, asignado_por no quedó en A'; end if;
  begin
    update public.contactos set personal = true where id = c1;
    raise exception 'A pudo volver personal un contacto a cargo de B';
  exception when check_violation or insufficient_privilege then null;
  end;

  execute 'reset role';
  raise exception 'PRUEBAS-OK';
end
$$;
