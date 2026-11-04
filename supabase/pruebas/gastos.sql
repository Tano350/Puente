-- Prueba de permisos de Gastos: gastos compartidos y "solo", partes que suman, quién cambia, fotos de boletas,
-- pagos y rendiciones.
-- Corre en una sola transacción que termina con un error a propósito: si todo está bien, el mensaje es
-- "PRUEBAS-OK" y no queda nada guardado. Si algo falla, el mensaje dice qué.
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  uc uuid := gen_random_uuid();
  a uuid;
  b uuid;
  c uuid;
  g1 public.gastos;
  g2 public.gastos;
  g3 public.gastos;
  p1 public.pagos;
  n int;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  -- A y B son miembros; C administra
  insert into public.personas (correo) values ('prueba.a@example.com') returning id into a;
  insert into public.personas (correo) values ('prueba.b@example.com') returning id into b;
  insert into public.personas (correo, administra) values ('prueba.c@example.com', true) returning id into c;
  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba.a@example.com', 'authenticated', 'authenticated'),
    (ub, 'prueba.b@example.com', 'authenticated', 'authenticated'),
    (uc, 'prueba.c@example.com', 'authenticated', 'authenticated');

  -- A anota un gasto entre los tres, uno pagado por B y uno solo suyo
  execute como_usuario using ua;
  execute 'set local role authenticated';
  g1 := public.anotar_gasto('Uber de prueba', 'auto', 3000, '2030-01-10', a, 'iguales',
    jsonb_build_array(jsonb_build_object('persona', a, 'monto', 1000), jsonb_build_object('persona', b, 'monto', 1000), jsonb_build_object('persona', c, 'monto', 1000)));
  if g1.creado_por <> a then raise exception 'creado_por no es quien anota'; end if;
  g2 := public.anotar_gasto('Cena de prueba', 'comida', 1001, '2030-01-10', b, 'exactos',
    jsonb_build_array(jsonb_build_object('persona', a, 'monto', 500), jsonb_build_object('persona', b, 'monto', 501)));
  g3 := public.anotar_gasto('Café solo mío', 'cafe', 450, '2030-01-10', a, 'solo', null);
  select count(*) into n from public.partes where gasto = g3.id and persona = a and monto = 450;
  if n <> 1 then raise exception 'El gasto solo no quedó entero de quien pagó'; end if;
  begin
    perform public.anotar_gasto('No cuadra', 'otro', 1000, '2030-01-10', a, 'exactos',
      jsonb_build_array(jsonb_build_object('persona', a, 'monto', 300), jsonb_build_object('persona', b, 'monto', 300)));
    raise exception 'Se anotó un gasto cuyas partes no suman el total';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.anotar_gasto('Solo de otro', 'otro', 1000, '2030-01-10', b, 'solo', null);
    raise exception 'A anotó un gasto solo pagado por B';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.anotar_gasto('Sin nadie', 'otro', 1000, '2030-01-10', a, 'iguales', '[]'::jsonb);
    raise exception 'Se anotó un gasto sin personas';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.gastos (titulo, monto, fecha, pagado_por, division) values ('Directo', 100, '2030-01-10', a, 'iguales');
    raise exception 'A escribió directo en gastos';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.partes (gasto, persona, monto) values (g1.id, a, 1);
    raise exception 'A escribió directo en partes';
  exception when insufficient_privilege then null;
  end;
  -- La boleta va en la carpeta del gasto
  begin
    perform public.poner_boleta(g1.id, gen_random_uuid()::text || '/boleta.jpg');
    raise exception 'Se puso una boleta de otra carpeta';
  exception when invalid_parameter_value then null;
  end;
  perform public.poner_boleta(g1.id, g1.id::text || '/boleta.jpg');
  if public.gasto_de_ruta('no-es-un-gasto/boleta.jpg') is not null then raise exception 'gasto_de_ruta aceptó una carpeta inválida'; end if;
  -- Las fotos: sube quien puede cambiar el gasto, en la carpeta del gasto
  insert into storage.objects (bucket_id, name) values ('boletas', g1.id || '/boleta.jpg'), ('boletas', g3.id || '/boleta.jpg');
  begin
    insert into storage.objects (bucket_id, name) values ('boletas', 'no-es-un-gasto/boleta.jpg');
    raise exception 'A subió una boleta fuera de la carpeta de un gasto';
  exception when insufficient_privilege then null;
  end;
  -- A rinde su café y el Uber
  insert into public.rendiciones (gasto) values (g3.id), (g1.id);

  -- B ve los compartidos, no el café de A ni lo que A rinde; cambia la cena (la pagó), no el Uber
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  select count(*) into n from public.gastos where id in (g1.id, g2.id, g3.id);
  if n <> 2 then raise exception 'B ve % gastos (esperaba 2: el solo de A no)', n; end if;
  select count(*) into n from public.partes where gasto = g3.id;
  if n <> 0 then raise exception 'B ve las partes del gasto solo de A'; end if;
  select count(*) into n from public.rendiciones;
  if n <> 0 then raise exception 'B ve lo que rinde A'; end if;
  if public.veo_gasto(g3.id) then raise exception 'veo_gasto dice que B ve el solo de A'; end if;
  select count(*) into n from storage.objects where bucket_id = 'boletas' and name in (g1.id || '/boleta.jpg', g3.id || '/boleta.jpg');
  if n <> 1 then raise exception 'B ve % boletas (esperaba 1: la del gasto solo de A no)', n; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('boletas', g1.id || '/otra.jpg');
    raise exception 'B subió una boleta a un gasto que no anotó ni pagó';
  exception when insufficient_privilege then null;
  end;
  insert into storage.objects (bucket_id, name) values ('boletas', g2.id || '/boleta.jpg');
  perform public.cambiar_gasto(g2.id, 'Cena cambiada por B', 'comida', 1002, '2030-01-10', b, 'exactos',
    jsonb_build_array(jsonb_build_object('persona', a, 'monto', 501), jsonb_build_object('persona', b, 'monto', 501)));
  begin
    perform public.cambiar_gasto(g1.id, 'Cambiado por B', 'auto', 3000, '2030-01-10', a, 'iguales',
      jsonb_build_array(jsonb_build_object('persona', a, 'monto', 3000)));
    raise exception 'B cambió un gasto que no anotó ni pagó';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.borrar_gasto(g1.id);
    raise exception 'B eliminó un gasto que no anotó ni pagó';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.rendiciones (gasto) values (g3.id);
    raise exception 'B rinde un gasto que no ve';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.rendiciones (gasto, persona) values (g1.id, a);
    raise exception 'B marcó una rendición a nombre de A';
  exception when insufficient_privilege then null;
  end;
  -- B le paga a A; no se puede pagar a sí mismo
  p1 := public.marcar_pagado(a, 1000);
  if p1.de <> b then raise exception 'El pago no quedó a nombre de quien lo marca'; end if;
  begin
    perform public.marcar_pagado(b, 100);
    raise exception 'B se pagó a sí mismo';
  exception when invalid_parameter_value then null;
  end;

  -- C administra: cambia el Uber de A, pero no ve ni cambia su café; no deshace el pago de B
  execute 'reset role';
  execute como_usuario using uc;
  execute 'set local role authenticated';
  select count(*) into n from public.gastos where id = g3.id;
  if n <> 0 then raise exception 'Quien administra ve el gasto solo de A'; end if;
  select count(*) into n from storage.objects where bucket_id = 'boletas' and name = g3.id || '/boleta.jpg';
  if n <> 0 then raise exception 'Quien administra ve la boleta del gasto solo de A'; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('boletas', g3.id || '/otra.jpg');
    raise exception 'Quien administra subió una boleta al gasto solo de A';
  exception when insufficient_privilege then null;
  end;
  insert into storage.objects (bucket_id, name) values ('boletas', g1.id || '/de-quien-administra.jpg');
  select count(*) into n from public.pagos where id = p1.id;
  if n <> 1 then raise exception 'Quien administra no ve el pago'; end if;
  perform public.cambiar_gasto(g1.id, 'Uber cambiado por quien administra', 'auto', 3000, '2030-01-10', a, 'iguales',
    jsonb_build_array(jsonb_build_object('persona', a, 'monto', 1500), jsonb_build_object('persona', c, 'monto', 1500)));
  begin
    perform public.cambiar_gasto(g3.id, 'Café cambiado', 'cafe', 450, '2030-01-10', a, 'solo', null);
    raise exception 'Quien administra cambió el gasto solo de A';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.deshacer_pago(p1.id);
    raise exception 'Quien administra deshizo el pago de B';
  exception when insufficient_privilege then null;
  end;

  -- A elimina su Uber y lo devuelve; B deshace su pago
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.borrar_gasto(g1.id);
  select count(*) into n from public.gastos where id = g1.id and borrado_en is not null;
  if n <> 1 then raise exception 'El gasto no quedó eliminado'; end if;
  perform public.devolver_gasto(g1.id);
  select count(*) into n from public.gastos where id = g1.id and borrado_en is null;
  if n <> 1 then raise exception 'El gasto no volvió'; end if;
  delete from public.rendiciones where gasto = g1.id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A no pudo desmarcar su rendición'; end if;
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  perform public.deshacer_pago(p1.id);
  select count(*) into n from public.pagos where id = p1.id and borrado_en is not null;
  if n <> 1 then raise exception 'B no pudo deshacer su pago'; end if;

  execute 'reset role';
  raise exception 'PRUEBAS-OK';
end
$$;
