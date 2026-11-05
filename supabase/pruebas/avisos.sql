-- Prueba de los avisos push: qué queda encolado en public.avisos en cada caso (evento nuevo, cambio y cancelación,
-- lista de espera, recordatorio, contacto, pago y "te sumó") y a quién nunca le llega (quien hace la acción, quien apagó ese
-- tipo, quien no tiene dispositivos, quien fue sacado del grupo).
-- Corre en una sola transacción que termina con un error a propósito: si todo está bien, el mensaje es
-- "PRUEBAS-OK" y no queda nada guardado (tampoco sale ningún pedido a la función: pg_net solo manda lo que se guarda).
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres.
-- Las estadías son de 2030 para no cruzarse con las de verdad.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  uc uuid := gen_random_uuid();
  uh uuid := gen_random_uuid();
  a uuid;
  b uuid;
  c uuid;
  d uuid;
  e uuid;
  f uuid;
  g uuid;
  h uuid;
  i uuid;
  e1 uuid;
  e2 uuid;
  e3 uuid;
  e4 uuid;
  e5 uuid;
  e6 uuid;
  e7 uuid;
  e8 uuid;
  e9 uuid;
  e10 uuid;
  e11 uuid;
  k1 uuid;
  k2 uuid;
  k3 uuid;
  k4 uuid;
  p1 public.pagos;
  n int;
  quienes uuid[];
  esperados uuid[];
  aviso public.avisos;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  -- A, B y H son miembros y están allá; C administra y está allá; D llega después; E fue sacada; F apagó los avisos
  -- de eventos nuevos; G no activó los avisos en ningún dispositivo. H apagó los de pagos (los demás tipos le faltan:
  -- cuentan como encendidos). D apagó los recordatorios. I apagó los cambios (también apaga "te sumó") y llega
  -- después, como D, para no cruzarse con los avisos de eventos nuevos.
  insert into public.personas (correo, llega, vuelve) values ('prueba.a@example.com', '2030-01-05', '2030-01-30') returning id into a;
  insert into public.personas (correo, llega, vuelve) values ('prueba.b@example.com', '2030-01-05', '2030-01-30') returning id into b;
  insert into public.personas (correo, administra, llega, vuelve) values ('prueba.c@example.com', true, '2030-01-05', '2030-01-30') returning id into c;
  insert into public.personas (correo, llega, vuelve, avisos) values ('prueba.d@example.com', '2030-02-01', '2030-02-20', '{"recordatorio": false}') returning id into d;
  insert into public.personas (correo, llega, vuelve, sacada_en) values ('prueba.e@example.com', '2030-01-05', '2030-01-30', now()) returning id into e;
  insert into public.personas (correo, llega, vuelve, avisos) values ('prueba.f@example.com', '2030-01-05', '2030-01-30', '{"eventos": false, "cambios": true}') returning id into f;
  insert into public.personas (correo, llega, vuelve) values ('prueba.g@example.com', '2030-01-05', '2030-01-30') returning id into g;
  insert into public.personas (correo, llega, vuelve, avisos) values ('prueba.h@example.com', '2030-01-05', '2030-01-30', '{"pago": false}') returning id into h;
  insert into public.personas (correo, llega, vuelve, avisos) values ('prueba.i@example.com', '2030-02-01', '2030-02-20', '{"cambios": false}') returning id into i;
  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba.a@example.com', 'authenticated', 'authenticated'),
    (ub, 'prueba.b@example.com', 'authenticated', 'authenticated'),
    (uc, 'prueba.c@example.com', 'authenticated', 'authenticated'),
    (uh, 'prueba.h@example.com', 'authenticated', 'authenticated');
  -- Todos menos G tienen un dispositivo con los avisos activados
  insert into public.suscripciones (endpoint, persona, p256dh, auth)
  select 'https://push.example.com/' || x.id, x.id, 'llave-de-prueba', 'secreto-de-prueba'
    from unnest(array[a, b, c, d, e, f, h, i]) as x(id);

  -- Evento nuevo con cupos: les llega a B, C y H. No a A (lo creó), D (no está allá), E (sacada), F (los apagó) ni G.
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.eventos (titulo, tipo, inicio, fin, modo, cupos, organizador)
  values ('Visita de prueba', 'visita', '2030-01-10 18:00Z', '2030-01-10 20:00Z', 'con_cupo', 2, a) returning id into e1;
  -- Un evento cerrado y uno que ya pasó no se anuncian
  insert into public.eventos (titulo, inicio, fin, modo, organizador)
  values ('Cerrado de prueba', '2030-01-12 18:00Z', '2030-01-12 19:00Z', 'cerrado', a) returning id into e2;
  insert into public.eventos (titulo, inicio, fin, organizador)
  values ('Pasado de prueba', '2020-01-10 18:00Z', '2020-01-10 19:00Z', a) returning id into e3;
  -- Con los avisos en pausa (cargas en bloque) no se encola nada
  perform set_config('puente.sin_avisos', 'si', true);
  insert into public.eventos (titulo, inicio, fin, organizador)
  values ('En pausa', '2030-01-11 18:00Z', '2030-01-11 19:00Z', a) returning id into e4;
  perform set_config('puente.sin_avisos', '', true);
  -- La app no ve los avisos
  begin
    perform count(*) from public.avisos;
    raise exception 'Alguien de Puente pudo leer la tabla de avisos';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.encolar_aviso(b, 'pago');
    raise exception 'Alguien de Puente pudo encolar un aviso a mano';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.evento = e1 and v.tipo = 'eventos';
  select array_agg(x order by x) into esperados from unnest(array[b, c, h]) as x;
  if quienes is distinct from esperados then raise exception 'El evento nuevo se anunció a % (esperaba B, C y H)', quienes; end if;
  select count(*) into n from public.avisos v where v.evento in (e2, e3, e4);
  if n <> 0 then raise exception 'Se anunciaron % avisos de un evento cerrado, pasado o creado en pausa', n; end if;
  select * into aviso from public.avisos v where v.evento = e1 and v.persona = b;
  if aviso.sale_en <= aviso.creado_en or aviso.enviado_en is not null or aviso.intentos <> 0 then
    raise exception 'El aviso nuevo no quedó esperando sus segundos para "Deshacer"';
  end if;

  -- B toma el último cupo; C se anota en la lista. Cuando B suelta su cupo, entra C y le llega "Tienes cupo".
  execute como_usuario using ub;
  execute 'set local role authenticated';
  perform public.ir(e1);
  execute 'reset role';
  execute como_usuario using uc;
  execute 'set local role authenticated';
  perform public.esperar(e1);
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  perform public.no_ir(e1);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = e1 and v.tipo = 'espera' and v.persona = c;
  if n <> 1 then raise exception 'C recibió % avisos de salir de la lista (esperaba 1)', n; end if;
  -- H espera y entra cuando A agranda los cupos (llenar_cupos)
  execute como_usuario using uh;
  execute 'set local role authenticated';
  perform public.esperar(e1);
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  update public.eventos set cupos = 3 where id = e1;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = e1 and v.tipo = 'espera' and v.persona = h;
  if n <> 1 then raise exception 'H recibió % avisos de salir de la lista (esperaba 1)', n; end if;
  -- Agrandar los cupos no es un cambio que se avise
  select count(*) into n from public.avisos v where v.evento = e1 and v.tipo = 'cambios';
  if n <> 0 then raise exception 'Agrandar los cupos se avisó como cambio'; end if;

  -- A cambia el lugar y después el nombre: les llega a C y H (van) un solo aviso, que recuerda cómo era antes
  execute como_usuario using ua;
  execute 'set local role authenticated';
  update public.eventos set lugar = 'Lugar nuevo' where id = e1;
  update public.eventos set titulo = 'Visita cambiada' where id = e1;
  -- Cambiar las notas no se avisa
  update public.eventos set notas = 'Llevar el pasaporte' where id = e1;
  execute 'reset role';
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.evento = e1 and v.tipo = 'cambios';
  select array_agg(x order by x) into esperados from unnest(array[c, h]) as x;
  if quienes is distinct from esperados then raise exception 'El cambio se avisó a % (esperaba C y H, una vez cada uno)', quienes; end if;
  select * into aviso from public.avisos v where v.evento = e1 and v.tipo = 'cambios' and v.persona = c;
  if aviso.datos -> 'antes' ->> 'titulo' <> 'Visita de prueba' or aviso.datos -> 'antes' -> 'lugar' <> 'null'::jsonb then
    raise exception 'El aviso de cambio no guardó cómo era el evento antes del primer cambio: %', aviso.datos;
  end if;
  -- C (administra) lo cancela: ahora también le llega a A. A C no: lo hizo, y su aviso del cambio anterior sobra.
  -- El de H se junta con el que esperaba y sigue recordando cómo era antes del primer cambio.
  execute como_usuario using uc;
  execute 'set local role authenticated';
  update public.eventos set cancelado_en = now() where id = e1;
  execute 'reset role';
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.evento = e1 and v.tipo = 'cambios';
  select array_agg(x order by x) into esperados from unnest(array[a, h]) as x;
  if quienes is distinct from esperados then raise exception 'La cancelación se avisó a % (esperaba A y H, una vez cada uno)', quienes; end if;
  select count(*) into n from public.avisos v where v.evento = e1 and v.tipo = 'cambios' and v.persona = h and v.datos -> 'antes' ->> 'titulo' = 'Visita de prueba';
  if n <> 1 then raise exception 'El aviso pendiente de H no se juntó con la cancelación'; end if;
  select count(*) into n from public.avisos v where v.evento = e1 and v.tipo = 'cambios' and v.persona = a and v.datos -> 'antes' ->> 'titulo' = 'Visita cambiada';
  if n <> 1 then raise exception 'El aviso de cancelación de A no guardó cómo estaba el evento al cancelarlo'; end if;

  -- Contactos: el propio no se avisa; asignado a B, sí; si pasa a C antes de salir, el de B se borra y le llega a C
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.contactos (nombre, responsable) values ('Contacto de A', a) returning id into k1;
  insert into public.contactos (nombre, responsable) values ('Contacto para B', b) returning id into k2;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.contacto = k1;
  if n <> 0 then raise exception 'Se avisó un contacto que A se asignó a sí misma'; end if;
  select count(*) into n from public.avisos v where v.contacto = k2 and v.persona = b;
  if n <> 1 then raise exception 'B recibió % avisos del contacto asignado (esperaba 1)', n; end if;
  execute como_usuario using ua;
  execute 'set local role authenticated';
  update public.contactos set responsable = c where id = k2;
  execute 'reset role';
  select array_agg(v.persona) into quienes from public.avisos v where v.contacto = k2;
  if quienes is distinct from array[c] then raise exception 'Tras reasignarlo, el aviso del contacto quedó para % (esperaba solo C)', quienes; end if;
  -- "Deshacer": A pasa a H un contacto que ya era de B (su aviso ya salió) y lo devuelve; a B no le llega otro
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.contactos (nombre, responsable) values ('Contacto que vuelve', b) returning id into k3;
  execute 'reset role';
  update public.avisos v set enviado_en = now(), intentos = 1 where v.contacto = k3;
  execute como_usuario using ua;
  execute 'set local role authenticated';
  update public.contactos set responsable = h where id = k3;
  update public.contactos set responsable = b where id = k3;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.contacto = k3;
  if n <> 1 then raise exception 'Deshacer la asignación dejó % avisos (esperaba solo el que ya había salido)', n; end if;
  -- C (administra) toma para sí un contacto de B: a C no le llega nada
  execute como_usuario using ub;
  execute 'set local role authenticated';
  insert into public.contactos (nombre, responsable) values ('Contacto de B', b) returning id into k4;
  execute 'reset role';
  execute como_usuario using uc;
  execute 'set local role authenticated';
  update public.contactos set responsable = c where id = k4;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.contacto = k4;
  if n <> 0 then raise exception 'Se avisó un contacto que C se asignó a sí mismo'; end if;

  -- Pagos: B le paga a A y a A le llega; A le paga a H, que apagó los avisos de pagos
  execute como_usuario using ub;
  execute 'set local role authenticated';
  p1 := public.marcar_pagado(a, 1000);
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.marcar_pagado(h, 500);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.pago = p1.id and v.persona = a and v.tipo = 'pago';
  if n <> 1 then raise exception 'A recibió % avisos del pago de B (esperaba 1)', n; end if;
  select count(*) into n from public.avisos v where v.tipo = 'pago' and v.persona in (b, h);
  if n <> 0 then raise exception 'Se avisó un pago a quien lo hizo o a quien apagó esos avisos'; end if;

  -- Recordatorio: A organiza algo que empieza en media hora y suma a B, D, E, F y G. Le llega a A, B y F;
  -- no a D (los apagó), E (sacada) ni G (sin dispositivos). Ni del que empieza en dos horas ni del cancelado.
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.eventos (titulo, inicio, fin, organizador)
  values ('Pronto', now() + interval '30 minutes', now() + interval '90 minutes', a) returning id into e5;
  perform public.sumar_a_evento(e5, x) from unnest(array[b, d, e, f, g]) as x;
  insert into public.eventos (titulo, inicio, fin, organizador)
  values ('Más tarde', now() + interval '2 hours', now() + interval '3 hours', a) returning id into e6;
  insert into public.eventos (titulo, inicio, fin, organizador)
  values ('Cancelado pronto', now() + interval '30 minutes', now() + interval '1 hour', a) returning id into e7;
  update public.eventos set cancelado_en = now() where id = e7;
  execute 'reset role';
  perform public.reloj_de_avisos();
  perform public.reloj_de_avisos();
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.evento = e5 and v.tipo = 'recordatorio';
  select array_agg(x order by x) into esperados from unnest(array[a, b, f]) as x;
  if quienes is distinct from esperados then raise exception 'El recordatorio llegó a % (esperaba A, B y F, una vez cada uno)', quienes; end if;
  select count(*) into n from public.avisos v where v.evento in (e6, e7) and v.tipo = 'recordatorio';
  if n <> 0 then raise exception 'Se recordó un evento que empieza en más de una hora o que se canceló'; end if;
  select count(*) into n from public.avisos v where v.evento = e5 and v.tipo = 'recordatorio' and v.sale_en > now();
  if n <> 0 then raise exception 'El recordatorio quedó esperando en vez de salir de inmediato'; end if;
  -- Aunque ya haya salido, la vuelta siguiente del reloj no lo repite
  update public.avisos v set enviado_en = now(), intentos = 1 where v.evento = e5 and v.tipo = 'recordatorio';
  perform public.reloj_de_avisos();
  select count(*) into n from public.avisos v where v.evento = e5 and v.tipo = 'recordatorio';
  if n <> 3 then raise exception 'El reloj repitió recordatorios: hay % (esperaba 3)', n; end if;
  -- Sumar gente a un evento no la saca de ninguna lista: no es un aviso de lista de espera. Sí les avisa que A los
  -- sumó: a B, D y F; no a E (sacada) ni a G (sin dispositivos).
  select count(*) into n from public.avisos v where v.evento = e5 and v.tipo not in ('recordatorio', 'sumado') and v.persona in (a, b, c, d, e, f, g, h);
  if n <> 0 then raise exception 'Sumar gente a un evento dejó % avisos que no son recordatorios ni de "te sumó"', n; end if;
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.evento = e5 and v.tipo = 'sumado';
  select array_agg(x order by x) into esperados from unnest(array[b, d, f]) as x;
  if quienes is distinct from esperados then raise exception 'El "te sumó" del evento pronto llegó a % (esperaba B, D y F)', quienes; end if;

  -- "Te sumó": A crea un evento cerrado (quedar en su propio evento no le avisa nada) y suma a B y a I. A B le llega
  -- un aviso que dice que fue A; a I no (apagó los cambios).
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.eventos (titulo, inicio, fin, modo, organizador)
  values ('Cerrado con gente', '2030-01-15 18:00Z', '2030-01-15 19:00Z', 'cerrado', a) returning id into e8;
  perform public.sumar_a_evento(e8, b);
  perform public.sumar_a_evento(e8, i);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = e8 and v.persona = a;
  if n <> 0 then raise exception 'Al crear su evento, A recibió % avisos', n; end if;
  select count(*) into n from public.avisos v where v.evento = e8 and v.persona = b and v.tipo = 'sumado' and v.datos ->> 'quien' = a::text;
  if n <> 1 then raise exception 'B recibió % avisos de que A lo sumó (esperaba 1, con A en datos)', n; end if;
  select * into aviso from public.avisos v where v.evento = e8 and v.persona = b and v.tipo = 'sumado';
  if aviso.sale_en <= aviso.creado_en or aviso.enviado_en is not null then
    raise exception 'El aviso de "te sumó" no quedó esperando sus segundos para "Deshacer"';
  end if;
  select count(*) into n from public.avisos v where v.evento = e8 and v.persona = i;
  if n <> 0 then raise exception 'I apagó los cambios y recibió % avisos de que la sumaron', n; end if;
  -- Sumarlo otra vez no repite; sacarlo ("Deshacer") y volver a sumarlo antes de que salga deja uno solo
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.sumar_a_evento(e8, b);
  perform public.sacar_de_evento(e8, b);
  perform public.sumar_a_evento(e8, b);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = e8 and v.persona = b and v.tipo = 'sumado';
  if n <> 1 then raise exception 'Sumar a B de nuevo dejó % avisos de "te sumó" (esperaba 1)', n; end if;
  -- B se suma solo a un evento para todos: no le llega nada
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.eventos (titulo, inicio, fin, organizador)
  values ('Abierto para sumarse', '2030-01-16 18:00Z', '2030-01-16 19:00Z', a) returning id into e9;
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  perform public.ir(e9);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = e9 and v.tipo = 'sumado';
  if n <> 0 then raise exception 'Sumarse solo dejó % avisos de "te sumó"', n; end if;
  -- A un evento cancelado no se avisa
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.eventos (titulo, inicio, fin, modo, organizador)
  values ('Cerrado cancelado', '2030-01-17 18:00Z', '2030-01-17 19:00Z', 'cerrado', a) returning id into e10;
  update public.eventos set cancelado_en = now() where id = e10;
  perform public.sumar_a_evento(e10, b);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = e10 and v.tipo = 'sumado';
  if n <> 0 then raise exception 'Se avisó que sumaron a alguien a un evento cancelado'; end if;

  -- "Deshacer" después de sacar a alguien lo devuelve sin avisarle; sumar sin ese parámetro (o con true) sí avisa
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.eventos (titulo, inicio, fin, modo, organizador)
  values ('Cerrado con deshacer', '2030-01-18 18:00Z', '2030-01-18 19:00Z', 'cerrado', a) returning id into e11;
  perform public.sumar_a_evento(e11, b);
  execute 'reset role';
  update public.avisos set enviado_en = now() where evento = e11 and persona = b and tipo = 'sumado';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.sacar_de_evento(e11, b);
  perform public.sumar_a_evento(e11, b, avisar => false);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = e11 and v.persona = b and v.tipo = 'sumado';
  if n <> 1 then raise exception 'Deshacer sacar a B le dejó % avisos de "te sumó" (esperaba solo el primero, ya enviado)', n; end if;
  if not exists (select 1 from public.asistentes s where s.evento = e11 and s.persona = b and s.estado = 'va') then
    raise exception 'Deshacer sacar a B no lo devolvió al evento';
  end if;
  -- La pausa fue solo de esa llamada: sumarlo de nuevo sin el parámetro avisa, y con true también
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.sacar_de_evento(e11, b);
  perform public.sumar_a_evento(e11, b);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = e11 and v.persona = b and v.tipo = 'sumado';
  if n <> 2 then raise exception 'Sumar a B sin el parámetro dejó % avisos de "te sumó" (esperaba 2)', n; end if;
  update public.avisos set enviado_en = now() where evento = e11 and persona = b and tipo = 'sumado';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.sacar_de_evento(e11, b);
  perform public.sumar_a_evento(e11, b, true);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = e11 and v.persona = b and v.tipo = 'sumado';
  if n <> 3 then raise exception 'Sumar a B con avisar => true dejó % avisos de "te sumó" (esperaba 3)', n; end if;

  -- Nunca a quien fue sacada ni a quien no tiene dispositivos
  select count(*) into n from public.avisos v where v.persona in (e, g);
  if n <> 0 then raise exception 'Hay % avisos para alguien sacado del grupo o sin dispositivos', n; end if;
  -- Deshacer un evento recién creado borra sus avisos pendientes
  execute como_usuario using ua;
  execute 'set local role authenticated';
  delete from public.eventos where id = e5;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.evento = e5;
  if n <> 0 then raise exception 'Borrar un evento dejó % avisos', n; end if;

  execute 'reset role';
  raise exception 'PRUEBAS-OK';
end
$$;
