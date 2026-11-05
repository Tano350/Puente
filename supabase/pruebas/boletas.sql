-- Prueba de quién pone la foto de la boleta: quien tiene una parte la pone cuando falta y cambia solo la suya;
-- quien anotó o pagó cambia cualquiera; quien no tiene parte, un gasto "solo" ajeno o uno eliminado, nada. Lo mismo
-- con los archivos, y cada uno borra lo que subió y no quedó como foto.
-- Corre en una sola transacción que termina con un error a propósito: si todo está bien, el mensaje es
-- "PRUEBAS-OK" y no queda nada guardado. Si algo falla, el mensaje dice qué.
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres, con la
-- migración 20261109000000_boleta_por_parte.sql ya aplicada.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  ud uuid := gen_random_uuid();
  ue uuid := gen_random_uuid();
  a uuid;
  b uuid;
  d uuid;
  e uuid;
  g1 public.gastos;
  g2 public.gastos;
  g3 public.gastos;
  x public.gastos;
  n int;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  -- Supabase solo deja borrar archivos con SQL si se pide a propósito; aquí se prueban las reglas de borrar
  perform set_config('storage.allow_delete_query', 'true', true);

  -- A anota y paga; B y D tienen una parte; E está en el grupo pero no en el gasto
  insert into public.personas (correo) values ('prueba.a@example.com') returning id into a;
  insert into public.personas (correo) values ('prueba.b@example.com') returning id into b;
  insert into public.personas (correo) values ('prueba.d@example.com') returning id into d;
  insert into public.personas (correo) values ('prueba.e@example.com') returning id into e;
  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba.a@example.com', 'authenticated', 'authenticated'),
    (ub, 'prueba.b@example.com', 'authenticated', 'authenticated'),
    (ud, 'prueba.d@example.com', 'authenticated', 'authenticated'),
    (ue, 'prueba.e@example.com', 'authenticated', 'authenticated');

  -- A anota un gasto entre A, B y D; uno entre A y B que después elimina; y uno solo suyo
  execute como_usuario using ua;
  execute 'set local role authenticated';
  g1 := public.anotar_gasto('Uber de prueba', 'auto', 3000, '2030-01-10', a, 'iguales',
    jsonb_build_array(jsonb_build_object('persona', a, 'monto', 1000), jsonb_build_object('persona', b, 'monto', 1000),
                      jsonb_build_object('persona', d, 'monto', 1000)));
  g2 := public.anotar_gasto('Cena eliminada', 'comida', 1000, '2030-01-10', a, 'iguales',
    jsonb_build_array(jsonb_build_object('persona', a, 'monto', 500), jsonb_build_object('persona', b, 'monto', 500)));
  perform public.borrar_gasto(g2.id);
  g3 := public.anotar_gasto('Café solo de A', 'cafe', 450, '2030-01-10', a, 'solo', null);
  if g1.boleta_por is not null then raise exception 'Un gasto nuevo ya tiene quién puso la foto'; end if;

  -- Un gasto "solo" no tiene partes ajenas; se fuerza una para probar que aun así no sirve
  execute 'reset role';
  insert into public.partes (gasto, persona, monto) values (g3.id, b, 0);

  -- E no tiene parte: no pone foto aunque falte
  execute como_usuario using ue;
  execute 'set local role authenticated';
  if public.cambio_boleta(g1.id) then raise exception 'cambio_boleta deja a E, que no tiene parte'; end if;
  begin
    perform public.poner_boleta(gasto => g1.id, ruta => g1.id || '/de-e.jpg');
    raise exception 'E puso la foto de un gasto en el que no tiene parte';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('boletas', g1.id || '/de-e.jpg', ue::text);
    raise exception 'E subió una boleta a un gasto en el que no tiene parte';
  exception when insufficient_privilege then null;
  end;

  -- D sube su foto mientras falta, pero B la pone primero
  execute 'reset role';
  execute como_usuario using ud;
  execute 'set local role authenticated';
  insert into storage.objects (bucket_id, name, owner_id) values ('boletas', g1.id || '/de-d.jpg', ud::text);

  -- B pone la foto que faltaba; no en otra carpeta, ni en el gasto eliminado ni en el "solo" de A
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  if not public.cambio_boleta(g1.id) then raise exception 'cambio_boleta no deja a B poner la foto que falta'; end if;
  insert into storage.objects (bucket_id, name, owner_id) values ('boletas', g1.id || '/de-b.jpg', ub::text);
  begin
    perform public.poner_boleta(gasto => g1.id, ruta => gen_random_uuid() || '/de-b.jpg');
    raise exception 'B puso una boleta de otra carpeta';
  exception when invalid_parameter_value then null;
  end;
  perform public.poner_boleta(gasto => g1.id, ruta => g1.id || '/de-b.jpg');
  select * into x from public.gastos where id = g1.id;
  if x.boleta is distinct from g1.id || '/de-b.jpg' or x.boleta_por is distinct from b then
    raise exception 'La foto de B no quedó a su nombre';
  end if;
  begin
    perform public.poner_boleta(gasto => g2.id, ruta => g2.id || '/de-b.jpg');
    raise exception 'B puso la foto de un gasto eliminado';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('boletas', g2.id || '/de-b.jpg', ub::text);
    raise exception 'B subió una boleta a un gasto eliminado';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.poner_boleta(gasto => g3.id, ruta => g3.id || '/de-b.jpg');
    raise exception 'B puso la foto de un gasto solo de A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('boletas', g3.id || '/de-b.jpg', ub::text);
    raise exception 'B subió una boleta a un gasto solo de A';
  exception when insufficient_privilege then null;
  end;

  -- D llegó tarde: no pisa ni quita la foto de B, ni sube otra; sí borra lo que subió y no quedó
  execute 'reset role';
  execute como_usuario using ud;
  execute 'set local role authenticated';
  if public.cambio_boleta(g1.id) then raise exception 'cambio_boleta deja a D cambiar la foto de B'; end if;
  begin
    perform public.poner_boleta(gasto => g1.id, ruta => g1.id || '/de-d.jpg');
    raise exception 'D reemplazó la foto que puso B';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.poner_boleta(gasto => g1.id);
    raise exception 'D quitó la foto que puso B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('boletas', g1.id || '/otra-de-d.jpg', ud::text);
    raise exception 'D subió una boleta a un gasto que ya tiene la foto de B';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where bucket_id = 'boletas' and name = g1.id || '/de-b.jpg';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'D borró el archivo de la foto que puso B'; end if;
  delete from storage.objects where bucket_id = 'boletas' and name = g1.id || '/de-d.jpg';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'D no pudo borrar su subida que no quedó como foto'; end if;
  select * into x from public.gastos where id = g1.id;
  if x.boleta is distinct from g1.id || '/de-b.jpg' or x.boleta_por is distinct from b then
    raise exception 'Los intentos de D cambiaron la foto de B';
  end if;

  -- B cambia su foto, borra la vieja, la quita y la vuelve a poner (deshacer)
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  insert into storage.objects (bucket_id, name, owner_id) values ('boletas', g1.id || '/de-b-2.jpg', ub::text);
  perform public.poner_boleta(gasto => g1.id, ruta => g1.id || '/de-b-2.jpg');
  delete from storage.objects where bucket_id = 'boletas' and name = g1.id || '/de-b.jpg';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'B no pudo borrar el archivo de su foto anterior'; end if;
  perform public.poner_boleta(gasto => g1.id);
  select * into x from public.gastos where id = g1.id;
  if x.boleta is not null or x.boleta_por is not null then raise exception 'Al quitar la foto no quedó vacía con boleta_por'; end if;
  perform public.poner_boleta(gasto => g1.id, ruta => g1.id || '/de-b-2.jpg');
  select * into x from public.gastos where id = g1.id;
  if x.boleta is distinct from g1.id || '/de-b-2.jpg' or x.boleta_por is distinct from b then
    raise exception 'Deshacer el quitar no devolvió la foto a nombre de B';
  end if;

  -- A, que anotó y pagó, reemplaza la foto de B: queda a su nombre
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into storage.objects (bucket_id, name, owner_id) values ('boletas', g1.id || '/de-a.jpg', ua::text);
  perform public.poner_boleta(gasto => g1.id, ruta => g1.id || '/de-a.jpg');
  select * into x from public.gastos where id = g1.id;
  if x.boleta is distinct from g1.id || '/de-a.jpg' or x.boleta_por is distinct from a then
    raise exception 'La foto que puso A no quedó a su nombre';
  end if;

  -- Ahora B no la toca, ni sube otra; sí borra su archivo viejo que ya no es la foto, no el de A
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  if public.cambio_boleta(g1.id) then raise exception 'cambio_boleta deja a B cambiar la foto de A'; end if;
  begin
    perform public.poner_boleta(gasto => g1.id, ruta => g1.id || '/de-b-2.jpg');
    raise exception 'B reemplazó la foto que puso A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner_id) values ('boletas', g1.id || '/de-b-3.jpg', ub::text);
    raise exception 'B subió una boleta a un gasto con la foto de A';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where bucket_id = 'boletas' and name = g1.id || '/de-a.jpg';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B borró el archivo de la foto que puso A'; end if;
  delete from storage.objects where bucket_id = 'boletas' and name = g1.id || '/de-b-2.jpg';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'B no pudo borrar su archivo que ya no es la foto'; end if;

  -- Una foto puesta antes de esta migración no tiene dueño: quien solo tiene una parte no la toca
  execute 'reset role';
  update public.gastos set boleta = g1.id || '/vieja.jpg', boleta_por = null where id = g1.id;
  execute como_usuario using ub;
  execute 'set local role authenticated';
  begin
    perform public.poner_boleta(gasto => g1.id);
    raise exception 'B quitó una foto puesta antes de saber quién la puso';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  raise exception 'PRUEBAS-OK';
end
$$;
