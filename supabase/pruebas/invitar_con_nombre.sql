-- Prueba de invitar con nombre: el nombre provisorio se guarda, solo quien administra invita, y al entrar por primera vez
-- manda el nombre de Google (o, si no trae, el provisorio). Corre en una sola transacción que termina con un error a
-- propósito: si todo está bien, el mensaje es "PRUEBAS-OK" y no queda nada guardado. Si algo falla, el mensaje dice qué.
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres, después de aplicar
-- 20261108010000_invitar_con_nombre.sql.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  a uuid;
  b uuid;
  fila public.personas;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  -- A administra; B es miembro
  insert into public.personas (correo, administra) values ('prueba.a@example.com', true) returning id into a;
  insert into public.personas (correo) values ('prueba.b@example.com') returning id into b;
  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba.a@example.com', 'authenticated', 'authenticated'),
    (ub, 'prueba.b@example.com', 'authenticated', 'authenticated');

  -- A invita con nombre: queda provisorio, sin entrar, y con A como quien invitó
  execute como_usuario using ua;
  execute 'set local role authenticated';
  select * into fila from public.invitar('prueba.nueva1@example.com', '  Martín  ');
  if fila.nombre is distinct from 'Martín' then raise exception 'El nombre provisorio no quedó (o no se limpió): %', fila.nombre; end if;
  if fila.entro_en is not null or fila.usuario is not null then raise exception 'Quien se invita no debería figurar como que ya entró'; end if;
  if fila.invitada_por is distinct from a then raise exception 'invitada_por no es quien invitó'; end if;

  -- Sin nombre, o en blanco, queda vacío (como antes de esta migración)
  select * into fila from public.invitar('prueba.nueva2@example.com');
  if fila.nombre is not null then raise exception 'Sin nombre, el nombre debía quedar vacío: %', fila.nombre; end if;
  select * into fila from public.invitar('prueba.nueva3@example.com', '   ');
  if fila.nombre is not null then raise exception 'Un nombre en blanco debía quedar vacío: %', fila.nombre; end if;
  -- También se puede pasar por nombre, como lo hace la app
  select * into fila from public.invitar(correo_nuevo => 'prueba.nueva4@example.com', nombre => 'Tomás');
  if fila.nombre is distinct from 'Tomás' then raise exception 'Invitar con parámetros con nombre falló: %', fila.nombre; end if;

  -- Un correo repetido sigue fallando con "ya invitado"
  begin
    perform public.invitar('prueba.nueva1@example.com', 'Otro');
    raise exception 'Se pudo invitar dos veces el mismo correo';
  exception when unique_violation then null;
  end;
  -- Un correo incompleto sigue fallando
  begin
    perform public.invitar('sin-arroba', 'Alguien');
    raise exception 'Se pudo invitar con un correo incompleto';
  exception when invalid_parameter_value then null;
  end;

  -- Si la sacan y la vuelven a invitar, vuelve con su nombre (el provisorio solo llena un nombre vacío)
  execute 'reset role';
  update public.personas set sacada_en = now() where correo = 'prueba.nueva1@example.com';
  update public.personas set sacada_en = now() where correo = 'prueba.nueva2@example.com';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  select * into fila from public.invitar('prueba.nueva1@example.com', 'Otro nombre');
  if fila.sacada_en is not null then raise exception 'Al volver a invitar, debía dejar de estar sacada'; end if;
  if fila.nombre is distinct from 'Martín' then raise exception 'Al volver, debía conservar su nombre: %', fila.nombre; end if;
  select * into fila from public.invitar('prueba.nueva2@example.com', 'Ahora sí');
  if fila.nombre is distinct from 'Ahora sí' then raise exception 'Al volver sin nombre, el provisorio debía llenarlo: %', fila.nombre; end if;

  -- Quien no administra no puede invitar
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  begin
    perform public.invitar('prueba.nueva5@example.com', 'Nadie');
    raise exception 'Un miembro pudo invitar';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- Al entrar por primera vez: si Google trae nombre, gana; si no, queda el provisorio
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (gen_random_uuid(), 'prueba.nueva1@example.com', 'authenticated', 'authenticated', '{"full_name": "Martín Ossa Rojas"}'::jsonb);
  select * into fila from public.personas where correo = 'prueba.nueva1@example.com';
  if fila.entro_en is null or fila.usuario is null then raise exception 'Al entrar, la cuenta debía unirse a la invitación'; end if;
  if fila.nombre is distinct from 'Martín Ossa Rojas' then raise exception 'Debía quedar el nombre de Google: %', fila.nombre; end if;

  insert into auth.users (id, email, aud, role)
  values (gen_random_uuid(), 'prueba.nueva4@example.com', 'authenticated', 'authenticated');
  select * into fila from public.personas where correo = 'prueba.nueva4@example.com';
  if fila.nombre is distinct from 'Tomás' then raise exception 'Sin nombre de Google, debía quedar el provisorio: %', fila.nombre; end if;

  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (gen_random_uuid(), 'prueba.nueva3@example.com', 'authenticated', 'authenticated', '{"full_name": "Camila Prueba"}'::jsonb);
  select * into fila from public.personas where correo = 'prueba.nueva3@example.com';
  if fila.nombre is distinct from 'Camila Prueba' then raise exception 'Sin provisorio, debía quedar el de Google: %', fila.nombre; end if;

  raise exception 'PRUEBAS-OK';
end
$$;
