-- Prueba de los avisos de eventos que van primero a los de un tema: qué avisos de "Evento nuevo" (tipo 'eventos')
-- quedan encolados al crear un evento solo para un tema, al abrirlo a todos (también con "Deshacer" y con
-- borrar_tema), al cambiarle el tema y con los avisos en pausa. Que el aviso sobre, o deje de tener sentido, lo
-- decide la función al mandarlo (mensajes.ts); aquí solo se revisa la cola.
-- Corre en una sola transacción que termina con un error a propósito: si todo está bien, el mensaje es
-- "PRUEBAS-OK" y no queda nada guardado (tampoco sale ningún pedido a la función: pg_net solo manda lo que se guarda).
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres, después de
-- aplicar 20261124000000_intereses.sql y 20261124010000_avisos_de_intereses.sql.
-- Las estadías son de 2030 para no cruzarse con las de verdad.
do $$
declare
  u_diego uuid := gen_random_uuid();
  u_sofia uuid := gen_random_uuid();
  u_josefa uuid := gen_random_uuid();
  u_andres uuid := gen_random_uuid();
  u_vicente uuid := gen_random_uuid();
  u_paula uuid := gen_random_uuid();
  diego uuid;
  sofia uuid;
  josefa uuid;
  martina uuid;
  andres uuid;
  paula uuid;
  tomas uuid;
  vicente uuid;
  fintech uuid;
  ia uuid;
  ev1 uuid;
  ev2 uuid;
  ev3 uuid;
  ev4 uuid;
  ev5 uuid;
  evc uuid;
  n int;
  quienes uuid[];
  esperados uuid[];
  aviso public.avisos;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  -- Diego crea Fintech y organiza todo. Sofía, Andrés y Vicente están en Fintech; Paula, en IA. Josefa (administra),
  -- Martina y Tomás no están en ningún tema. Andrés llega después (no está allá esos días). Vicente apagó los avisos
  -- de eventos nuevos. Todos tienen un dispositivo con los avisos activados. Los temas se llaman «Prueba …» para no
  -- chocar con los de verdad (aquí se nombran Fintech e IA).
  insert into public.personas (correo, nombre, llega, vuelve) values ('prueba.diego@example.com', 'Diego', '2030-01-05', '2030-01-30') returning id into diego;
  insert into public.personas (correo, nombre, llega, vuelve) values ('prueba.sofia@example.com', 'Sofía', '2030-01-05', '2030-01-30') returning id into sofia;
  insert into public.personas (correo, nombre, administra, llega, vuelve) values ('prueba.josefa@example.com', 'Josefa', true, '2030-01-05', '2030-01-30') returning id into josefa;
  insert into public.personas (correo, nombre, llega, vuelve) values ('prueba.martina@example.com', 'Martina', '2030-01-05', '2030-01-30') returning id into martina;
  insert into public.personas (correo, nombre, llega, vuelve) values ('prueba.andres@example.com', 'Andrés', '2030-02-01', '2030-02-20') returning id into andres;
  insert into public.personas (correo, nombre, llega, vuelve) values ('prueba.paula@example.com', 'Paula', '2030-01-05', '2030-01-30') returning id into paula;
  insert into public.personas (correo, nombre, llega, vuelve) values ('prueba.tomas@example.com', 'Tomás', '2030-01-05', '2030-01-30') returning id into tomas;
  insert into public.personas (correo, nombre, llega, vuelve, avisos) values ('prueba.vicente@example.com', 'Vicente', '2030-01-05', '2030-01-30', '{"eventos": false}') returning id into vicente;
  insert into auth.users (id, email, aud, role) values
    (u_diego, 'prueba.diego@example.com', 'authenticated', 'authenticated'),
    (u_sofia, 'prueba.sofia@example.com', 'authenticated', 'authenticated'),
    (u_josefa, 'prueba.josefa@example.com', 'authenticated', 'authenticated'),
    (u_andres, 'prueba.andres@example.com', 'authenticated', 'authenticated'),
    (u_vicente, 'prueba.vicente@example.com', 'authenticated', 'authenticated'),
    (u_paula, 'prueba.paula@example.com', 'authenticated', 'authenticated');
  insert into public.suscripciones (endpoint, persona, p256dh, auth)
  select 'https://push.example.com/' || x.id, x.id, 'llave-de-prueba', 'secreto-de-prueba'
    from unnest(array[diego, sofia, josefa, martina, andres, paula, tomas, vicente]) as x(id);

  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  fintech := (public.crear_tema('Prueba Fintech')).id;
  ia := (public.crear_tema('Prueba IA')).id;
  execute 'reset role';
  execute como_usuario using u_sofia;
  execute 'set local role authenticated';
  perform public.me_interesa(fintech);
  execute 'reset role';
  execute como_usuario using u_andres;
  execute 'set local role authenticated';
  perform public.me_interesa(fintech);
  execute 'reset role';
  execute como_usuario using u_vicente;
  execute 'set local role authenticated';
  perform public.me_interesa(fintech);
  execute 'reset role';
  execute como_usuario using u_paula;
  execute 'set local role authenticated';
  perform public.me_interesa(ia);
  execute 'reset role';
  -- Diego sale de IA, para que IA quede solo con Paula
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  perform public.ya_no_me_interesa(ia);

  -- ---------- Evento nuevo solo para Fintech ----------
  -- Le llega solo a Sofía: no a Diego (lo crea), Andrés (no está allá), Vicente (los apagó) ni a los que no son del tema
  insert into public.eventos (titulo, tipo, inicio, fin, organizador, tema)
  values ('Visita a Stripe', 'visita', '2030-01-10 18:00Z', '2030-01-10 20:00Z', diego, fintech) returning id into ev1;
  -- Tomás va porque Diego lo suma: al abrirlo no le llega "Evento nuevo"
  perform public.sumar_a_evento(ev1, tomas);
  execute 'reset role';
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.evento = ev1 and v.tipo = 'eventos';
  if quienes is distinct from array[sofia] then raise exception 'El evento solo para Fintech se anunció a % (esperaba solo a Sofía)', quienes; end if;
  select * into aviso from public.avisos v where v.evento = ev1 and v.tipo = 'eventos' and v.persona = sofia;
  if aviso.sale_en <= aviso.creado_en or aviso.enviado_en is not null or aviso.intentos <> 0 then
    raise exception 'El aviso del evento de Fintech no quedó esperando sus segundos para "Deshacer"';
  end if;

  -- ---------- Se abre a todos ----------
  -- Les llega a Josefa, Martina y Paula. Sofía ya tiene el suyo; Tomás ya va.
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  update public.eventos set abierto_en = now() where id = ev1;
  execute 'reset role';
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.evento = ev1 and v.tipo = 'eventos';
  select array_agg(x order by x) into esperados from unnest(array[sofia, josefa, martina, paula]) as x;
  if quienes is distinct from esperados then raise exception 'Al abrirlo, los avisos quedaron para % (esperaba Sofía, Josefa, Martina y Paula)', quienes; end if;
  -- "Deshacer" lo vuelve a cerrar: no encola nada (lo que sobra lo descarta la función)
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  update public.eventos set abierto_en = null where id = ev1;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = ev1 and v.tipo = 'eventos';
  if n <> 4 then raise exception 'Volver a cerrarlo dejó % avisos (esperaba los mismos 4)', n; end if;
  -- Mientras estaba cerrado, la función descartó el de Martina y mandó el de Josefa. Al abrirlo otra vez, Martina
  -- recibe uno nuevo (el descartado nunca le llegó); nadie más.
  update public.avisos v set descartado = 'Todavía es solo para los de Fintech.', intentos = 1
   where v.evento = ev1 and v.tipo = 'eventos' and v.persona = martina;
  update public.avisos v set enviado_en = now(), intentos = 1
   where v.evento = ev1 and v.tipo = 'eventos' and v.persona = josefa;
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  update public.eventos set abierto_en = now() where id = ev1;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = ev1 and v.tipo = 'eventos';
  if n <> 5 then raise exception 'Al abrirlo otra vez hay % avisos (esperaba 5: uno nuevo para Martina)', n; end if;
  select count(*) into n from public.avisos v where v.evento = ev1 and v.tipo = 'eventos' and v.persona = martina and v.descartado is null;
  if n <> 1 then raise exception 'Martina tiene % avisos vigentes al abrirlo otra vez (esperaba 1)', n; end if;
  -- Cambiar la hora de apertura no vuelve a avisar
  update public.eventos set abierto_en = now() - interval '30 seconds' where id = ev1;
  select count(*) into n from public.avisos v where v.evento = ev1 and v.tipo = 'eventos';
  if n <> 5 then raise exception 'Cambiar la hora de apertura dejó % avisos (esperaba 5)', n; end if;

  -- ---------- Quien abre no recibe el aviso ----------
  -- Josefa (administra) abre uno de Diego: les llega a Martina, Paula y Tomás (y Sofía ya tenía el suyo)
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  insert into public.eventos (titulo, inicio, fin, modo, cupos, organizador, tema)
  values ('Taller de pagos', '2030-01-11 18:00Z', '2030-01-11 19:00Z', 'con_cupo', 8, diego, fintech) returning id into ev2;
  execute 'reset role';
  execute como_usuario using u_josefa;
  execute 'set local role authenticated';
  update public.eventos set abierto_en = now() where id = ev2;
  execute 'reset role';
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.evento = ev2 and v.tipo = 'eventos';
  select array_agg(x order by x) into esperados from unnest(array[sofia, martina, paula, tomas]) as x;
  if quienes is distinct from esperados then raise exception 'Al abrirlo Josefa, los avisos quedaron para % (esperaba Sofía, Martina, Paula y Tomás)', quienes; end if;

  -- ---------- Cambia el tema mientras sigue cerrado ----------
  -- De Fintech a IA: le llega a Paula; el de Sofía queda (lo descarta la función). De vuelta a Fintech: nada nuevo.
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  insert into public.eventos (titulo, inicio, fin, organizador, tema)
  values ('Charla', '2030-01-12 18:00Z', '2030-01-12 19:00Z', diego, fintech) returning id into ev3;
  update public.eventos set tema = ia where id = ev3;
  execute 'reset role';
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.evento = ev3 and v.tipo = 'eventos';
  select array_agg(x order by x) into esperados from unnest(array[sofia, paula]) as x;
  if quienes is distinct from esperados then raise exception 'Al cambiar a IA, los avisos quedaron para % (esperaba Sofía y Paula)', quienes; end if;
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  update public.eventos set tema = fintech where id = ev3;
  -- Otros cambios del evento no tocan estos avisos
  update public.eventos set lugar = 'Sala grande' where id = ev3;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = ev3 and v.tipo = 'eventos';
  if n <> 2 then raise exception 'Volver a Fintech dejó % avisos (esperaba los mismos 2)', n; end if;

  -- ---------- Con los avisos en pausa no se encola nada ----------
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  perform set_config('puente.sin_avisos', 'si', true);
  insert into public.eventos (titulo, inicio, fin, organizador, tema)
  values ('En pausa', '2030-01-13 18:00Z', '2030-01-13 19:00Z', diego, fintech) returning id into ev4;
  update public.eventos set tema = ia where id = ev4;
  update public.eventos set abierto_en = now() where id = ev4;
  perform set_config('puente.sin_avisos', '', true);
  -- Uno cancelado tampoco avisa al abrirlo
  insert into public.eventos (titulo, inicio, fin, organizador, tema)
  values ('Cancelado', '2030-01-14 18:00Z', '2030-01-14 19:00Z', diego, fintech) returning id into evc;
  update public.eventos set cancelado_en = now() where id = evc;
  execute 'reset role';
  delete from public.avisos v where v.evento = evc;
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  update public.eventos set abierto_en = now() where id = evc;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento in (ev4, evc) and v.tipo = 'eventos';
  if n <> 0 then raise exception 'Se encolaron % avisos en pausa o de un evento cancelado', n; end if;

  -- ---------- Borrar el tema abre sus eventos y avisa ----------
  -- Queda solo para Fintech la charla (ev3) y uno nuevo (ev5). Borrar Fintech los abre: a todos los demás que están
  -- allá y no tienen el aviso (Sofía ya lo tiene; en la charla, Paula también).
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  insert into public.eventos (titulo, inicio, fin, organizador, tema)
  values ('Demo day', '2030-01-15 18:00Z', '2030-01-15 19:00Z', diego, fintech) returning id into ev5;
  n := public.borrar_tema(fintech);
  if n <> 2 then raise exception 'Borrar Fintech abrió % eventos (esperaba 2)', n; end if;
  execute 'reset role';
  select array_agg(x order by x) into esperados from unnest(array[sofia, josefa, martina, paula, tomas]) as x;
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.evento = ev3 and v.tipo = 'eventos';
  if quienes is distinct from esperados then raise exception 'Borrar Fintech dejó los avisos de la charla para % (esperaba Sofía, Josefa, Martina, Paula y Tomás)', quienes; end if;
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.evento = ev5 and v.tipo = 'eventos';
  if quienes is distinct from esperados then raise exception 'Borrar Fintech dejó los avisos de Demo day para % (esperaba Sofía, Josefa, Martina, Paula y Tomás)', quienes; end if;
  -- Devolverlo los vuelve a cerrar sin encolar nada
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  perform public.devolver_tema(fintech);
  execute 'reset role';
  select count(*) into n from public.eventos where id in (ev3, ev5) and abierto_en is null;
  if n <> 2 then raise exception 'Devolver Fintech no volvió a cerrar sus eventos'; end if;
  select count(*) into n from public.avisos v where v.evento in (ev3, ev5) and v.tipo = 'eventos';
  if n <> 10 then raise exception 'Devolver Fintech dejó % avisos (esperaba los mismos 10)', n; end if;

  -- Nunca a quien lo organiza, a quien no está allá ni a quien apagó los avisos de eventos nuevos
  select count(*) into n from public.avisos v where v.persona in (diego, andres, vicente) and v.tipo = 'eventos';
  if n <> 0 then raise exception 'Hay % avisos de eventos nuevos para Diego, Andrés o Vicente', n; end if;

  raise exception 'PRUEBAS-OK';
end
$$;
