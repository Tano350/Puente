-- Prueba de permisos de la Agenda: eventos, cupos y lista de espera, ratos ocupados y notas de reunión.
-- Corre en una sola transacción que termina con un error a propósito: si todo está bien, el mensaje es
-- "PRUEBAS-OK" y no queda nada guardado. Si algo falla, el mensaje dice qué.
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres.
-- Las fechas son de 2030 para no cruzarse con las estadías de verdad.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  uc uuid := gen_random_uuid();
  ud uuid := gen_random_uuid();
  uf uuid := gen_random_uuid();
  a uuid;
  b uuid;
  c uuid;
  d uuid;
  f uuid;
  e1 uuid;
  e2 uuid;
  e3 uuid;
  n int;
  base int;
  pista text;
  hay record;
  fila public.eventos;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  -- A, B y F son miembros y están allá; C administra y está allá; D llega después
  select count(*) into base from public.personas p where p.sacada_en is null and public.esta_alla(p.id, '2030-01-10 18:00Z');
  insert into public.personas (correo, llega, vuelve) values ('prueba.a@example.com', '2030-01-05', '2030-01-30') returning id into a;
  insert into public.personas (correo, llega, vuelve) values ('prueba.b@example.com', '2030-01-05', '2030-01-30') returning id into b;
  insert into public.personas (correo, administra, llega, vuelve) values ('prueba.c@example.com', true, '2030-01-05', '2030-01-30') returning id into c;
  insert into public.personas (correo, llega, vuelve) values ('prueba.d@example.com', '2030-02-01', '2030-02-20') returning id into d;
  insert into public.personas (correo, llega, vuelve) values ('prueba.f@example.com', '2030-01-05', '2030-01-30') returning id into f;
  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba.a@example.com', 'authenticated', 'authenticated'),
    (ub, 'prueba.b@example.com', 'authenticated', 'authenticated'),
    (uc, 'prueba.c@example.com', 'authenticated', 'authenticated'),
    (ud, 'prueba.d@example.com', 'authenticated', 'authenticated'),
    (uf, 'prueba.f@example.com', 'authenticated', 'authenticated');

  -- A crea una visita con 2 cupos: organiza y va
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.eventos (titulo, tipo, inicio, fin, modo, cupos, organizador)
  values ('Visita de prueba', 'visita', '2030-01-10 18:00Z', '2030-01-10 20:00Z', 'con_cupo', 2, a) returning * into fila;
  e1 := fila.id;
  if fila.creado_por <> a then raise exception 'creado_por no es quien crea el evento'; end if;
  select count(*) into n from public.asistentes where evento = e1 and persona = a and estado = 'va';
  if n <> 1 then raise exception 'Quien organiza no quedó yendo'; end if;
  begin
    insert into public.eventos (titulo, inicio, fin, organizador) values ('A nombre de B', '2030-01-11 18:00Z', '2030-01-11 19:00Z', b);
    raise exception 'A pudo crear un evento que organiza B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.eventos (titulo, inicio, fin, organizador, desde_google) values ('Falso', '2030-01-11 18:00Z', '2030-01-11 19:00Z', a, true);
    raise exception 'A pudo crear un evento como si viniera de Google';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.asistentes (evento, persona, estado) values (e1, b, 'va');
    raise exception 'A pudo sumar gente sin pasar por las funciones';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.eventos set desde_google = true where id = e1;
    raise exception 'A pudo marcar su evento como de Google';
  exception when insufficient_privilege then null;
  end;
  -- Un evento cerrado de A, al que suma a B, y una reunión que ya pasó
  insert into public.eventos (titulo, inicio, fin, modo, organizador)
  values ('Cerrado de prueba', '2030-01-12 18:00Z', '2030-01-12 19:00Z', 'cerrado', a) returning id into e2;
  perform public.sumar_a_evento(e2, b);
  insert into public.eventos (titulo, tipo, inicio, fin, organizador)
  values ('Reunión pasada', 'reunion', '2020-01-10 18:00Z', '2020-01-10 19:00Z', a) returning id into e3;
  insert into public.notas_reunion (evento, aprendi, sigue) values (e3, 'Lo que aprendió A', 'Lo que sigue');

  -- B ve todo, toma el último cupo y no cambia lo que no organiza
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  select count(*) into n from public.eventos where id in (e1, e2, e3);
  if n <> 3 then raise exception 'B ve % eventos (esperaba 3)', n; end if;
  if public.ir(e1) <> 'va' then raise exception 'B no pudo tomar un cupo'; end if;
  update public.eventos set titulo = 'Cambiado por B' where id = e1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B pudo cambiar un evento que no organiza'; end if;
  delete from public.eventos where id = e1;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B pudo borrar un evento que no creó'; end if;
  begin
    perform public.sumar_a_evento(e1, d);
    raise exception 'B pudo sumar gente a un evento que no organiza';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.ir(e3);
    raise exception 'B pudo ir a un evento que ya pasó';
  exception when invalid_parameter_value then
    get stacked diagnostics pista = pg_exception_hint;
    if pista <> 'paso' then raise exception 'ir() en un evento pasado dio "%"', pista; end if;
  end;
  -- Ratos ocupados: los de B solo los ve B
  insert into public.ocupados (titulo, inicio, fin) values ('Clase', '2030-01-10 21:00Z', '2030-01-10 22:00Z');
  begin
    insert into public.ocupados (persona, titulo, inicio, fin) values (a, 'A nombre de A', '2030-01-10 21:00Z', '2030-01-10 22:00Z');
    raise exception 'B pudo marcar un rato ocupado de A';
  exception when insufficient_privilege then null;
  end;
  -- Notas de reunión: B ve la de A, escribe la suya y no toca la de A
  select count(*) into n from public.notas_reunion where evento = e3;
  if n <> 1 then raise exception 'B ve % notas de la reunión (esperaba 1)', n; end if;
  update public.notas_reunion set aprendi = 'Cambiada por B' where evento = e3 and autor = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'B pudo cambiar la nota de A'; end if;
  begin
    insert into public.notas_reunion (evento, autor, aprendi) values (e1, a, 'A nombre de A');
    raise exception 'B pudo escribir una nota a nombre de A';
  exception when insufficient_privilege then null;
  end;
  insert into public.notas_reunion (evento, aprendi) values (e3, 'Lo que aprendió B');

  -- C administra: el evento está lleno y queda primero en la lista; puede cambiar el evento
  execute 'reset role';
  execute como_usuario using uc;
  execute 'set local role authenticated';
  begin
    perform public.ir(e1);
    raise exception 'C pudo tomar un cupo en un evento lleno';
  exception when invalid_parameter_value then
    get stacked diagnostics pista = pg_exception_hint;
    if pista <> 'lleno' then raise exception 'ir() en un evento lleno dio "%"', pista; end if;
  end;
  if public.esperar(e1) <> 1 then raise exception 'C no quedó primero en la lista de espera'; end if;
  begin
    perform public.ir(e2);
    raise exception 'C pudo entrar solo a un evento cerrado';
  exception when insufficient_privilege then
    get stacked diagnostics pista = pg_exception_hint;
    if pista <> 'cerrado' then raise exception 'ir() en un evento cerrado dio "%"', pista; end if;
  end;
  select count(*) into n from public.ocupados;
  if n <> 0 then raise exception 'C ve % ratos ocupados de otros', n; end if;
  update public.eventos set lugar = 'Otro lugar' where id = e1;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Quien administra no pudo cambiar el evento'; end if;
  -- Disponibilidad: A y B van a la visita (C espera, así que está libre, igual que F); a las 21 B tiene clase
  select * into hay from public.libres('2030-01-10 18:00Z', '2030-01-10 20:00Z');
  if hay.alla <> base + 4 or hay.libres <> base + 2 then raise exception 'libres() en la visita dio % de % (esperaba % de %)', hay.libres, hay.alla, base + 2, base + 4; end if;
  select * into hay from public.libres('2030-01-10 21:00Z', '2030-01-10 22:00Z');
  if hay.alla <> base + 4 or hay.libres <> base + 3 then raise exception 'libres() en la clase de B dio % de % (esperaba % de %)', hay.libres, hay.alla, base + 3, base + 4; end if;

  -- D llega después: no puede ir ni anotarse en la lista
  execute 'reset role';
  execute como_usuario using ud;
  execute 'set local role authenticated';
  begin
    perform public.ir(e1);
    raise exception 'D pudo ir un día que no está allá';
  exception when invalid_parameter_value then
    get stacked diagnostics pista = pg_exception_hint;
    if pista <> 'no_estas' then raise exception 'ir() sin estar allá dio "%"', pista; end if;
  end;
  begin
    perform public.esperar(e1);
    raise exception 'D se pudo anotar en la lista un día que no está allá';
  exception when invalid_parameter_value then null;
  end;

  -- B suelta su cupo: entra C, el primero de la lista. B vuelve a la lista y entra cuando A agranda los cupos
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  perform public.no_ir(e1);
  select count(*) into n from public.asistentes where evento = e1 and persona = c and estado = 'va';
  if n <> 1 then raise exception 'Al soltar un cupo no entró el primero de la lista'; end if;
  if public.esperar(e1) <> 1 then raise exception 'B no quedó primero en la lista de espera'; end if;
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  update public.eventos set cupos = 3 where id = e1;
  select count(*) into n from public.asistentes where evento = e1 and persona = b and estado = 'va';
  if n <> 1 then raise exception 'Al agrandar los cupos no entró el primero de la lista'; end if;
  -- F queda en la lista y entra cuando A saca a B
  execute 'reset role';
  execute como_usuario using uf;
  execute 'set local role authenticated';
  if public.esperar(e1) <> 1 then raise exception 'F no quedó primero en la lista de espera'; end if;
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.sacar_de_evento(e1, b);
  select count(*) into n from public.asistentes where evento = e1 and persona = f and estado = 'va';
  if n <> 1 then raise exception 'Al sacar a alguien no entró el primero de la lista'; end if;
  -- A cancela su visita: ya nadie puede ir
  update public.eventos set cancelado_en = now() where id = e1;
  execute 'reset role';
  execute como_usuario using uc;
  execute 'set local role authenticated';
  begin
    perform public.ir(e1);
    raise exception 'C pudo ir a un evento cancelado';
  exception when no_data_found then null;
  end;

  -- Solo quien lo creó lo borra (para deshacer)
  delete from public.eventos where id = e3;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'Quien administra pudo borrar un evento que no creó'; end if;
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  delete from public.eventos where id = e3;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A no pudo borrar el evento que creó'; end if;

  -- A quien sacan del grupo deja de ver la Agenda
  execute 'reset role';
  update public.personas set sacada_en = now() where id = d;
  execute como_usuario using ud;
  execute 'set local role authenticated';
  select count(*) into n from public.eventos where id in (e1, e2);
  if n <> 0 then raise exception 'Alguien sacado del grupo ve % eventos', n; end if;

  execute 'reset role';
  raise exception 'PRUEBAS-OK';
end
$$;
