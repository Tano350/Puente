-- Prueba de permisos de Intereses: temas (crear con el id del dispositivo, nombres vacíos o repetidos, quién cambia,
-- borra y devuelve), «Me interesa» y «Ya no me interesa», eventos que van primero a los de un tema (quién se suma por
-- su cuenta, las reglas de revisar_primero_para, borrar y devolver un tema), libres() con un tema y la copia diaria
-- de las dos tablas nuevas.
-- Corre en una sola transacción que termina con un error a propósito: si todo está bien, el mensaje es
-- "PRUEBAS-OK" y no queda nada guardado. Si algo falla, el mensaje dice qué.
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres, después de
-- aplicar 20261124000000_intereses.sql.
-- Las fechas son de 2030 para no cruzarse con las estadías de verdad.
do $$
declare
  u_diego uuid := gen_random_uuid();
  u_sofia uuid := gen_random_uuid();
  u_josefa uuid := gen_random_uuid();
  u_martina uuid := gen_random_uuid();
  u_andres uuid := gen_random_uuid();
  diego uuid;
  sofia uuid;
  josefa uuid;
  martina uuid;
  andres uuid;
  fintech public.temas;
  ia public.temas;
  clima public.temas;
  otro public.temas;
  tid uuid := gen_random_uuid();
  ev0 uuid;
  ev1 uuid;
  ev2 uuid;
  ev4 uuid;
  ev5 uuid;
  em uuid;
  evp uuid;
  evc uuid;
  n int;
  base int;
  h text;
  cuando timestamptz;
  hay record;
  dia constant date := '2099-01-01';
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  -- Todos están allá en enero de 2030. Josefa administra. Ninguno está en un tema todavía. Los temas se llaman
  -- «Prueba …» para no chocar con los nombres de temas de verdad.
  select count(*) into base from public.personas p where p.sacada_en is null and public.esta_alla(p.id, '2030-01-10 18:00Z');
  insert into public.personas (correo, nombre, llega, vuelve) values ('prueba.diego@example.com', 'Diego', '2030-01-05', '2030-01-30') returning id into diego;
  insert into public.personas (correo, nombre, llega, vuelve) values ('prueba.sofia@example.com', 'Sofía', '2030-01-05', '2030-01-30') returning id into sofia;
  insert into public.personas (correo, nombre, administra, llega, vuelve) values ('prueba.josefa@example.com', 'Josefa', true, '2030-01-05', '2030-01-30') returning id into josefa;
  insert into public.personas (correo, nombre, llega, vuelve) values ('prueba.martina@example.com', 'Martina', '2030-01-05', '2030-01-30') returning id into martina;
  insert into public.personas (correo, nombre, llega, vuelve) values ('prueba.andres@example.com', 'Andrés', '2030-01-05', '2030-01-30') returning id into andres;
  insert into auth.users (id, email, aud, role) values
    (u_diego, 'prueba.diego@example.com', 'authenticated', 'authenticated'),
    (u_sofia, 'prueba.sofia@example.com', 'authenticated', 'authenticated'),
    (u_josefa, 'prueba.josefa@example.com', 'authenticated', 'authenticated'),
    (u_martina, 'prueba.martina@example.com', 'authenticated', 'authenticated'),
    (u_andres, 'prueba.andres@example.com', 'authenticated', 'authenticated');

  -- ---------- Diego crea temas ----------
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  fintech := public.crear_tema('  Prueba Fintech ', ' Pagos y bancos ', tid);
  if fintech.id <> tid or fintech.nombre <> 'Prueba Fintech' or fintech.de_que_trata <> 'Pagos y bancos' or fintech.creado_por <> diego
     or fintech.borrado_en is not null then
    raise exception 'crear_tema no guardó bien el tema: %', to_jsonb(fintech);
  end if;
  -- Quien lo crea queda dentro
  select count(*) into n from public.interesados where tema = tid and persona = diego;
  if n <> 1 then raise exception 'Diego no quedó en el tema que creó'; end if;
  -- Con el id del dispositivo: repetir devuelve el mismo, sin cambiarlo ni duplicarlo
  otro := public.crear_tema('Otro nombre', null, tid);
  if otro.id <> tid or otro.nombre <> 'Prueba Fintech' then raise exception 'Repetir crear_tema cambió el tema'; end if;
  select count(*) into n from public.temas where id = tid;
  if n <> 1 then raise exception 'Repetir crear_tema lo duplicó'; end if;
  select count(*) into n from public.interesados where tema = tid;
  if n <> 1 then raise exception 'Repetir crear_tema dejó % interesados (esperaba 1)', n; end if;
  -- Sin nombre no se crea
  begin
    perform public.crear_tema('   ');
    raise exception 'Se creó un tema sin nombre';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'nombre' then raise exception 'Sin nombre dio el motivo "%"', h; end if;
  end;
  begin
    perform public.crear_tema(null);
    raise exception 'Se creó un tema con el nombre vacío';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'nombre' then raise exception 'Con el nombre vacío dio el motivo "%"', h; end if;
  end;
  -- El mismo nombre, con otras mayúsculas y espacios, está repetido
  begin
    perform public.crear_tema(' PRUEBA fintech  ');
    raise exception 'Se crearon dos temas con el mismo nombre';
  exception when unique_violation then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'repetido' then raise exception 'Un nombre repetido dio el motivo "%"', h; end if;
  end;
  ia := public.crear_tema('Prueba IA');
  clima := public.crear_tema('Prueba Clima');
  -- Las tablas no se escriben directo
  begin
    insert into public.temas (nombre) values ('Directo');
    raise exception 'Diego escribió directo en temas';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.temas set nombre = 'Directo' where id = tid;
    raise exception 'Diego cambió directo un tema';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.temas where id = tid;
    raise exception 'Diego borró directo un tema';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.interesados (tema, persona) values (ia.id, sofia);
    raise exception 'Diego escribió directo en interesados';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.interesados set desde = now() where tema = tid;
    raise exception 'Diego cambió directo interesados';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.interesados where tema = tid;
    raise exception 'Diego borró directo de interesados';
  exception when insufficient_privilege then null;
  end;
  -- Las funciones internas no son para la app
  begin
    perform public.le_interesa(tid, diego);
    raise exception 'La app pudo llamar a le_interesa';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cambio_tema(tid);
    raise exception 'La app pudo llamar a cambio_tema';
  exception when insufficient_privilege then null;
  end;

  -- Sin sesión no se ve nada
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform 1 from public.temas;
    raise exception 'Alguien sin sesión leyó los temas';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.interesados;
    raise exception 'Alguien sin sesión leyó los interesados';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.crear_tema('Sin sesión');
    raise exception 'Alguien sin sesión creó un tema';
  exception when insufficient_privilege then null;
  end;

  -- ---------- Sofía: ve todo, se suma y sale; no cambia lo que no creó ----------
  execute 'reset role';
  execute como_usuario using u_sofia;
  execute 'set local role authenticated';
  select count(*) into n from public.temas where id in (tid, ia.id, clima.id);
  if n <> 3 then raise exception 'Sofía ve % temas (esperaba 3)', n; end if;
  select count(*) into n from public.interesados where tema = tid;
  if n <> 1 then raise exception 'Sofía ve % interesados en Fintech (esperaba 1)', n; end if;
  -- «Me interesa» dos veces deja una fila
  perform public.me_interesa(tid);
  perform public.me_interesa(tid);
  select count(*) into n from public.interesados where tema = tid and persona = sofia;
  if n <> 1 then raise exception 'Sofía quedó % veces en Fintech (esperaba 1)', n; end if;
  -- «Ya no me interesa» sin estar, y dos veces, no falla
  perform public.ya_no_me_interesa(ia.id);
  perform public.me_interesa(ia.id);
  perform public.ya_no_me_interesa(ia.id);
  perform public.ya_no_me_interesa(ia.id);
  select count(*) into n from public.interesados where tema = ia.id and persona = sofia;
  if n <> 0 then raise exception 'Sofía sigue en IA después de salir'; end if;
  -- Con el id de un tema de Diego no se queda con él
  begin
    perform public.crear_tema('Robo de id', null, tid);
    raise exception 'Sofía reusó el id de un tema de Diego';
  exception when unique_violation then null;
  end;
  begin
    perform public.cambiar_tema(tid, 'Cambiado por Sofía');
    raise exception 'Sofía cambió un tema que no creó';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.borrar_tema(tid);
    raise exception 'Sofía borró un tema que no creó';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.devolver_tema(tid);
    raise exception 'Sofía devolvió un tema que no creó';
  exception when insufficient_privilege then null;
  end;
  if not exists (select 1 from public.temas where id = tid and nombre = 'Prueba Fintech' and borrado_en is null) then
    raise exception 'Fintech cambió después de lo que intentó Sofía';
  end if;

  -- ---------- Josefa administra: cambia el tema de otro ----------
  execute 'reset role';
  execute como_usuario using u_josefa;
  execute 'set local role authenticated';
  otro := public.cambiar_tema(tid, ' Prueba Finanzas ', ' De todo un poco ');
  if otro.nombre <> 'Prueba Finanzas' or otro.de_que_trata <> 'De todo un poco' then raise exception 'Quien administra no pudo cambiar el tema'; end if;
  begin
    perform public.cambiar_tema(tid, ' prueba ia ');
    raise exception 'Se le puso a un tema el nombre de otro';
  exception when unique_violation then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'repetido' then raise exception 'Cambiar a un nombre repetido dio el motivo "%"', h; end if;
  end;
  begin
    perform public.cambiar_tema(tid, '  ');
    raise exception 'Se le borró el nombre a un tema';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'nombre' then raise exception 'Cambiar a un nombre vacío dio el motivo "%"', h; end if;
  end;

  -- ---------- Diego lo creó: lo cambia de vuelta y borra Clima ----------
  execute 'reset role';
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  otro := public.cambiar_tema(tid, 'Prueba Fintech', 'Pagos y bancos');
  if otro.nombre <> 'Prueba Fintech' then raise exception 'Quien creó el tema no lo pudo cambiar'; end if;
  n := public.borrar_tema(clima.id);
  if n <> 0 then raise exception 'Borrar Clima (sin eventos) abrió % eventos', n; end if;
  if not exists (select 1 from public.temas where id = clima.id and borrado_en is not null) then
    raise exception 'Clima no quedó borrado';
  end if;
  n := public.borrar_tema(clima.id);
  if n <> 0 then raise exception 'Borrar Clima otra vez devolvió %', n; end if;
  -- Un tema borrado deja libre su nombre
  otro := public.crear_tema('prueba clima');
  if otro.id = clima.id then raise exception 'Crear un tema con el nombre de uno borrado devolvió el borrado'; end if;

  -- A un tema borrado no se suma nadie
  execute 'reset role';
  execute como_usuario using u_sofia;
  execute 'set local role authenticated';
  begin
    perform public.me_interesa(clima.id);
    raise exception 'Sofía se sumó a un tema borrado';
  exception when no_data_found then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'no_esta' then raise exception '«Me interesa» en un tema borrado dio el motivo "%"', h; end if;
  end;
  -- Andrés se suma a Fintech
  execute 'reset role';
  execute como_usuario using u_andres;
  execute 'set local role authenticated';
  perform public.me_interesa(tid);

  -- ---------- Eventos primero para Fintech ----------
  execute 'reset role';
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  insert into public.eventos (titulo, tipo, inicio, fin, modo, cupos, organizador, tema)
  values ('Visita a Stripe', 'visita', '2030-01-10 18:00Z', '2030-01-10 20:00Z', 'con_cupo', 5, diego, tid) returning id into ev1;
  insert into public.eventos (titulo, inicio, fin, organizador, tema)
  values ('Charla de pagos', '2030-01-11 18:00Z', '2030-01-11 19:00Z', diego, tid) returning id into ev2;
  insert into public.eventos (titulo, inicio, fin, organizador)
  values ('Asado', '2030-01-12 18:00Z', '2030-01-12 19:00Z', diego) returning id into ev0;
  insert into public.eventos (titulo, inicio, fin, organizador, tema)
  values ('Pasado de Fintech', '2020-01-10 18:00Z', '2020-01-10 19:00Z', diego, tid) returning id into evp;
  insert into public.eventos (titulo, inicio, fin, organizador, tema)
  values ('Cancelado de Fintech', '2030-01-14 18:00Z', '2030-01-14 19:00Z', diego, tid) returning id into evc;
  update public.eventos set cancelado_en = now() where id = evc;
  insert into public.eventos (titulo, inicio, fin, organizador, tema)
  values ('Charla de IA', '2030-01-15 18:00Z', '2030-01-15 19:00Z', diego, ia.id) returning id into ev4;
  insert into public.eventos (titulo, inicio, fin, organizador, tema)
  values ('Para cerrar', '2030-01-16 18:00Z', '2030-01-16 19:00Z', diego, tid) returning id into ev5;
  -- Un tema borrado no se elige
  begin
    insert into public.eventos (titulo, inicio, fin, organizador, tema)
    values ('De un tema borrado', '2030-01-16 18:00Z', '2030-01-16 19:00Z', diego, clima.id);
    raise exception 'Se creó un evento para un tema borrado';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'tema' then raise exception 'Un evento de un tema borrado dio el motivo "%"', h; end if;
  end;
  -- Un evento cerrado no lleva tema
  begin
    insert into public.eventos (titulo, inicio, fin, modo, organizador, tema)
    values ('Cerrado con tema', '2030-01-16 18:00Z', '2030-01-16 19:00Z', 'cerrado', diego, tid);
    raise exception 'Se creó un evento cerrado con tema';
  exception when check_violation then null;
  end;

  -- Martina no está en Fintech: lo ve, pero no se suma por su cuenta. Sí al que ella organiza.
  execute 'reset role';
  execute como_usuario using u_martina;
  execute 'set local role authenticated';
  select count(*) into n from public.eventos where id in (ev1, ev2) and tema = tid and abierto_en is null;
  if n <> 2 then raise exception 'Martina ve % eventos de Fintech (esperaba 2)', n; end if;
  begin
    perform public.ir(ev1);
    raise exception 'Martina se sumó a un evento que todavía es solo para Fintech';
  exception when insufficient_privilege then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'solo_tema' then raise exception 'ir() sin estar en el tema dio "%"', h; end if;
  end;
  begin
    perform public.esperar(ev1);
    raise exception 'Martina se anotó en la lista de un evento que todavía es solo para Fintech';
  exception when insufficient_privilege then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'solo_tema' then raise exception 'esperar() sin estar en el tema dio "%"', h; end if;
  end;
  insert into public.eventos (titulo, inicio, fin, modo, cupos, organizador, tema)
  values ('Demo day', '2030-01-13 18:00Z', '2030-01-13 19:00Z', 'con_cupo', 1, martina, tid) returning id into em;
  perform public.no_ir(em);
  if public.esperar(em) <> 1 then raise exception 'Quien organiza no se pudo anotar en la lista de su evento de Fintech'; end if;
  if public.ir(em) <> 'va' then raise exception 'Quien organiza no pudo ir a su evento de Fintech'; end if;

  -- Sofía está en Fintech: se suma. No lo abre (no lo organiza).
  execute 'reset role';
  execute como_usuario using u_sofia;
  execute 'set local role authenticated';
  if public.ir(ev1) <> 'va' then raise exception 'Sofía no pudo ir a un evento de su tema'; end if;
  update public.eventos set abierto_en = now() where id = ev1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Sofía abrió un evento que no organiza'; end if;

  -- Josefa administra pero no está en Fintech: tampoco se suma por su cuenta
  execute 'reset role';
  execute como_usuario using u_josefa;
  execute 'set local role authenticated';
  begin
    perform public.ir(ev1);
    raise exception 'Quien administra se sumó a un evento que todavía es solo para Fintech';
  exception when insufficient_privilege then
    get stacked diagnostics h = pg_exception_hint;
    if h is distinct from 'solo_tema' then raise exception 'ir() de quien administra dio "%"', h; end if;
  end;

  -- Quien organiza suma a mano a quien quiera
  execute 'reset role';
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  perform public.sumar_a_evento(ev1, martina);
  select count(*) into n from public.asistentes where evento = ev1 and persona = martina and estado = 'va';
  if n <> 1 then raise exception 'Quien organiza no pudo sumar a alguien que no está en el tema'; end if;
  perform public.sacar_de_evento(ev1, martina);

  -- ---------- libres() con un tema ----------
  -- En la visita van Diego y Sofía; Andrés, también de Fintech, está libre. Josefa y Martina no cuentan con el tema.
  select * into hay from public.libres('2030-01-10 18:00Z', '2030-01-10 20:00Z', tid);
  if hay.alla <> 3 or hay.libres <> 1 then raise exception 'libres() con Fintech dio % de % (esperaba 1 de 3)', hay.libres, hay.alla; end if;
  select * into hay from public.libres('2030-01-10 18:00Z', '2030-01-10 20:00Z');
  if hay.alla <> base + 5 then raise exception 'libres() sin tema cuenta a % allá (esperaba %)', hay.alla, base + 5; end if;

  -- ---------- Reglas de revisar_primero_para (Diego organiza) ----------
  -- El tema se elige al crear el evento
  begin
    update public.eventos set tema = tid where id = ev0;
    raise exception 'Se le puso tema a un evento creado sin tema';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'tema' then raise exception 'Ponerle tema después dio el motivo "%"', h; end if;
  end;
  -- Cerrado y con tema, no
  begin
    update public.eventos set modo = 'cerrado', cupos = null where id = ev1;
    raise exception 'Un evento con tema quedó cerrado';
  exception when check_violation then null;
  end;
  -- Para que sea de todos se abre: sacarle el tema no sirve
  begin
    update public.eventos set tema = null where id = ev2;
    raise exception 'Se le sacó el tema a un evento sin abrirlo';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'tema' then raise exception 'Sacarle el tema dio el motivo "%"', h; end if;
  end;
  -- Pasarlo a cerrado sí le saca el tema
  update public.eventos set modo = 'cerrado', tema = null where id = ev5;
  if not exists (select 1 from public.eventos where id = ev5 and modo = 'cerrado' and tema is null) then
    raise exception 'No se pudo pasar a cerrado un evento con tema';
  end if;
  -- Mientras siga cerrado, el tema se cambia (no a uno borrado)
  update public.eventos set tema = ia.id where id = ev2;
  if not exists (select 1 from public.eventos where id = ev2 and tema = ia.id) then raise exception 'No se pudo cambiar el tema'; end if;
  update public.eventos set tema = tid where id = ev2;
  begin
    update public.eventos set tema = clima.id where id = ev2;
    raise exception 'Se cambió el tema a uno borrado';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'tema' then raise exception 'Cambiar a un tema borrado dio el motivo "%"', h; end if;
  end;
  -- Abrir: la base pone su hora, no la que manda la app
  update public.eventos set abierto_en = '2000-01-01 00:00Z' where id = ev2;
  select abierto_en into cuando from public.eventos where id = ev2;
  if cuando is distinct from now() then raise exception 'Abrir guardó la hora % (esperaba la de la base, %)', cuando, now(); end if;
  -- Abierto, ya no se cambia el tema
  begin
    update public.eventos set tema = ia.id where id = ev2;
    raise exception 'Se cambió el tema de un evento abierto';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'abierto' then raise exception 'Cambiar el tema de uno abierto dio el motivo "%"', h; end if;
  end;
  -- "Deshacer" dentro del minuto lo vuelve a cerrar
  update public.eventos set abierto_en = null where id = ev2;
  if not exists (select 1 from public.eventos where id = ev2 and abierto_en is null) then raise exception '"Deshacer" no volvió a cerrar el evento'; end if;
  execute 'reset role';
  execute como_usuario using u_martina;
  execute 'set local role authenticated';
  begin
    perform public.ir(ev2);
    raise exception 'Martina se sumó a un evento que se volvió a cerrar';
  exception when insufficient_privilege then null;
  end;
  -- Abierto otra vez: Martina se suma
  execute 'reset role';
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  update public.eventos set abierto_en = now() where id = ev2;
  execute 'reset role';
  execute como_usuario using u_martina;
  execute 'set local role authenticated';
  if public.ir(ev2) <> 'va' then raise exception 'Martina no pudo ir a un evento abierto a todos'; end if;
  -- Abierto hace más de un minuto ya no se cierra (de una hora a otra sí se puede cambiar)
  execute 'reset role';
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  update public.eventos set abierto_en = now() - interval '2 minutes' where id = ev2;
  if not exists (select 1 from public.eventos where id = ev2 and abierto_en = now() - interval '2 minutes') then
    raise exception 'No se pudo cambiar la hora de apertura';
  end if;
  begin
    update public.eventos set abierto_en = null where id = ev2;
    raise exception 'Se volvió a cerrar un evento abierto hace dos minutos';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'abierto' then raise exception 'Cerrar uno abierto hace rato dio el motivo "%"', h; end if;
  end;

  -- ---------- Borrar y devolver un tema ----------
  -- Josefa (administra) borra Fintech: se abren la visita y Demo day. No la charla (ya abierta), el pasado, el
  -- cancelado ni el de IA.
  execute 'reset role';
  execute como_usuario using u_josefa;
  execute 'set local role authenticated';
  n := public.borrar_tema(tid);
  if n <> 2 then raise exception 'Borrar Fintech abrió % eventos (esperaba 2)', n; end if;
  select borrado_en into cuando from public.temas where id = tid;
  if cuando is null then raise exception 'Fintech no quedó borrado'; end if;
  select count(*) into n from public.eventos where id in (ev1, em) and abierto_en = cuando;
  if n <> 2 then raise exception 'Borrar Fintech no abrió la visita y Demo day con la hora del borrado'; end if;
  select count(*) into n from public.eventos where id in (evp, evc, ev4) and abierto_en is not null;
  if n <> 0 then raise exception 'Borrar Fintech abrió % eventos pasados, cancelados o de otro tema', n; end if;
  if not exists (select 1 from public.eventos where id = ev2 and abierto_en = now() - interval '2 minutes') then
    raise exception 'Borrar Fintech le cambió la hora a un evento ya abierto';
  end if;
  -- Devolverlo dentro del minuto los vuelve a cerrar
  perform public.devolver_tema(tid);
  if not exists (select 1 from public.temas where id = tid and borrado_en is null) then raise exception 'Fintech no volvió'; end if;
  select count(*) into n from public.eventos where id in (ev1, em) and abierto_en is null;
  if n <> 2 then raise exception 'Devolver Fintech dejó abiertos % de los eventos que abrió', 2 - n; end if;
  if not exists (select 1 from public.eventos where id = ev2 and abierto_en is not null) then
    raise exception 'Devolver Fintech cerró un evento que ya estaba abierto';
  end if;

  -- ---------- Copia diaria ----------
  execute 'reset role';
  if not ('temas' = any (respaldo.tablas()) and 'interesados' = any (respaldo.tablas())) then
    raise exception 'La copia diaria no incluye temas e interesados: %', respaldo.tablas();
  end if;
  if not (array_position(respaldo.tablas(), 'personas') < array_position(respaldo.tablas(), 'temas')
          and array_position(respaldo.tablas(), 'temas') < array_position(respaldo.tablas(), 'interesados')
          and array_position(respaldo.tablas(), 'temas') < array_position(respaldo.tablas(), 'eventos')) then
    raise exception 'temas e interesados no van en el orden de sus claves foráneas: %', respaldo.tablas();
  end if;
  -- Una copia de mentira, de un día lejano: la charla de IA todavía cerrada, IA y Clima con sus interesados
  insert into respaldo.copias (dia, tabla, filas, cantidad)
  select dia, 'eventos', jsonb_agg(to_jsonb(e)), count(*) from public.eventos e where e.id = ev4;
  insert into respaldo.copias (dia, tabla, filas, cantidad)
  select dia, 'temas', jsonb_agg(to_jsonb(t)), count(*) from public.temas t where t.id in (ia.id, clima.id);
  insert into respaldo.copias (dia, tabla, filas, cantidad)
  select dia, 'interesados', jsonb_agg(to_jsonb(i)), count(*) from public.interesados i where i.tema in (ia.id, clima.id);
  -- Diego borra IA (abre su charla) y después borra la charla de verdad
  execute como_usuario using u_diego;
  execute 'set local role authenticated';
  n := public.borrar_tema(ia.id);
  if n <> 1 then raise exception 'Borrar IA abrió % eventos (esperaba 1)', n; end if;
  delete from public.eventos where id = ev4;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Diego no pudo borrar la charla de IA'; end if;
  execute 'reset role';
  -- Como en el editor SQL: sin la sesión de nadie
  perform set_config('request.jwt.claims', '', true);
  -- La charla vuelve tal como estaba en la copia, aunque su tema ya esté borrado
  n := respaldo.recuperar('eventos', dia, array[ev4]);
  if n <> 1 then raise exception 'Recuperar un evento de un tema borrado devolvió % (esperaba 1)', n; end if;
  if not exists (select 1 from public.eventos where id = ev4 and tema = ia.id and abierto_en is null) then
    raise exception 'La charla de IA no volvió como estaba';
  end if;
  -- Un tema borrado de verdad vuelve con sus interesados (estos se recuperan por el id del tema)
  delete from public.temas where id = clima.id;
  select count(*) into n from public.interesados where tema = clima.id;
  if n <> 0 then raise exception 'Borrar el tema no se llevó a sus interesados'; end if;
  n := respaldo.recuperar('temas', dia, array[clima.id]);
  if n <> 1 then raise exception 'Recuperar Clima devolvió % (esperaba 1)', n; end if;
  n := respaldo.recuperar('interesados', dia, array[clima.id]);
  if n <> 1 then raise exception 'Recuperar los interesados de Clima devolvió % (esperaba 1)', n; end if;
  if not exists (select 1 from public.interesados where tema = clima.id and persona = diego) then
    raise exception 'Diego no volvió a Clima';
  end if;
  if respaldo.recuperar('temas', dia, array[clima.id]) <> 0 or respaldo.recuperar('interesados', dia, array[clima.id]) <> 0 then
    raise exception 'Recuperar Clima dos veces volvió a insertar filas';
  end if;

  raise exception 'PRUEBAS-OK';
end
$$;
