-- Prueba de los avisos de tareas: "Te asignaron una tarea" (a quién le llega, a quién no y cuándo se borra el que
-- esperaba salir) y "Mañana vence una tarea tuya" (encolar_recordatorios_de_tareas con distintas horas). También
-- revisa que la preferencia 'tareas' apague los dos y que los avisos de antes sigan encolándose con la firma nueva de
-- encolar_aviso.
-- Corre en una sola transacción que termina con un error a propósito: si todo está bien, el mensaje es
-- "PRUEBAS-OK" y no queda nada guardado (tampoco sale ningún pedido a la función: pg_net solo manda lo que se guarda).
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres, después de
-- aplicar 20261110000000_tareas.sql y 20261110010000_avisos_de_tareas.sql.
-- Las fechas son de 2030 para no cruzarse con las de verdad.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  uc uuid := gen_random_uuid();
  a uuid;
  b uuid;
  c uuid;
  d uuid;
  e uuid;
  f uuid;
  g uuid;
  t1 uuid;
  t2 uuid;
  t3 uuid;
  t4 uuid;
  tp uuid;
  v1 uuid;
  v2 uuid;
  v3 uuid;
  v4 uuid;
  v5 uuid;
  v6 uuid;
  vp uuid;
  k1 uuid;
  p1 public.pagos;
  n int;
  quienes uuid[];
  esperados uuid[];
  pares text[];
  pares_esperados text[];
  aviso public.avisos;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
  -- Una hora de California como timestamptz
  la constant text := 'America/Los_Angeles';
begin
  -- A, B y E son miembros; C administra. D apagó los avisos de tareas. F apagó los cambios (no apaga los de tareas).
  -- G no activó los avisos en ningún dispositivo. A E la sacan del grupo más adelante.
  insert into public.personas (correo, llega, vuelve) values ('prueba.a@example.com', '2030-01-05', '2030-01-30') returning id into a;
  insert into public.personas (correo, llega, vuelve) values ('prueba.b@example.com', '2030-01-05', '2030-01-30') returning id into b;
  insert into public.personas (correo, administra, llega, vuelve) values ('prueba.c@example.com', true, '2030-01-05', '2030-01-30') returning id into c;
  insert into public.personas (correo, llega, vuelve, avisos) values ('prueba.d@example.com', '2030-01-05', '2030-01-30', '{"tareas": false}') returning id into d;
  insert into public.personas (correo, llega, vuelve) values ('prueba.e@example.com', '2030-01-05', '2030-01-30') returning id into e;
  insert into public.personas (correo, llega, vuelve, avisos) values ('prueba.f@example.com', '2030-01-05', '2030-01-30', '{"cambios": false}') returning id into f;
  insert into public.personas (correo, llega, vuelve) values ('prueba.g@example.com', '2030-01-05', '2030-01-30') returning id into g;
  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba.a@example.com', 'authenticated', 'authenticated'),
    (ub, 'prueba.b@example.com', 'authenticated', 'authenticated'),
    (uc, 'prueba.c@example.com', 'authenticated', 'authenticated');
  -- Todos menos G tienen un dispositivo con los avisos activados
  insert into public.suscripciones (endpoint, persona, p256dh, auth)
  select 'https://push.example.com/' || x.id, x.id, 'llave-de-prueba', 'secreto-de-prueba'
    from unnest(array[a, b, c, d, e, f]) as x(id);

  -- ---------- La preferencia ----------
  if public.quiere_aviso(d, 'tarea') or public.quiere_aviso(d, 'vence') then
    raise exception 'D apagó los avisos de tareas y quiere_aviso dice que los quiere';
  end if;
  if not public.quiere_aviso(d, 'eventos') or not public.quiere_aviso(f, 'tarea') or not public.quiere_aviso(f, 'vence')
     or not public.quiere_aviso(b, 'tarea') or not public.quiere_aviso(b, 'vence') then
    raise exception 'La preferencia de tareas apagó otra cosa, o le faltó la clave a alguien y no contó como encendida';
  end if;
  if public.quiere_aviso(g, 'tarea') then raise exception 'G no tiene dispositivos y quiere_aviso dice que sí'; end if;
  if public.quiere_aviso(f, 'sumado') then raise exception '"Te sumó" dejó de seguir a la preferencia de cambios'; end if;

  -- ---------- "Te asignaron una tarea" ----------

  -- A crea una tarea para A, B, C, D, F y G: les llega a B, C y F. No a A (se puso ella), D (los apagó) ni G.
  execute como_usuario using ua;
  execute 'set local role authenticated';
  t1 := (public.crear_tarea('Reservar el auto', false, false, array[a, b, c, d, f, g], para => '2030-01-16')).id;
  -- La app no ve los avisos ni los puede encolar
  begin
    perform count(*) from public.avisos;
    raise exception 'Alguien de Puente pudo leer la tabla de avisos';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.encolar_aviso(b, 'tarea', tarea => t1);
    raise exception 'Alguien de Puente pudo encolar un aviso de tarea a mano';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.encolar_recordatorios_de_tareas(now());
    raise exception 'Alguien de Puente pudo encolar los recordatorios de tareas';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.tarea = t1 and v.tipo = 'tarea';
  select array_agg(x order by x) into esperados from unnest(array[b, c, f]) as x;
  if quienes is distinct from esperados then raise exception 'La tarea nueva se avisó a % (esperaba B, C y F)', quienes; end if;
  select * into aviso from public.avisos v where v.tarea = t1 and v.tipo = 'tarea' and v.persona = b;
  if aviso.datos ->> 'quien' is distinct from a::text or aviso.evento is not null then
    raise exception 'El aviso de la tarea no dice que fue A: %', aviso.datos;
  end if;
  if aviso.sale_en <= aviso.creado_en or aviso.enviado_en is not null or aviso.intentos <> 0 then
    raise exception 'El aviso de la tarea no quedó esperando sus segundos para "Deshacer"';
  end if;

  -- Una personal no avisa a nadie (es solo de quien la crea, aunque mande más personas)
  execute como_usuario using ua;
  execute 'set local role authenticated';
  tp := (public.crear_tarea('Algo mío', false, true, array[b, c])).id;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.tarea = tp;
  if n <> 0 then raise exception 'Una tarea personal dejó % avisos', n; end if;

  -- "Me la tomo" no avisa: A crea una sin asignar y B se la toma
  execute como_usuario using ua;
  execute 'set local role authenticated';
  t2 := (public.crear_tarea('Sin asignar', false, false, '{}'::uuid[])).id;
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  perform public.tomar_tarea(t2);
  execute 'reset role';
  if not exists (select 1 from public.asignados s where s.tarea = t2 and s.persona = b and s.tomada) then
    raise exception 'B no quedó con la tarea que se tomó';
  end if;
  select count(*) into n from public.avisos v where v.tarea = t2;
  if n <> 0 then raise exception 'Tomarse una tarea dejó % avisos', n; end if;

  -- C (administra) crea una para A: a A le llega, diciendo que fue C
  execute como_usuario using uc;
  execute 'set local role authenticated';
  t3 := (public.crear_tarea('Para A', false, false, array[a])).id;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.tarea = t3 and v.persona = a and v.tipo = 'tarea' and v.datos ->> 'quien' = c::text;
  if n <> 1 then raise exception 'A recibió % avisos de la tarea que le dio C (esperaba 1, con C en datos)', n; end if;

  -- A saca a B de la tarea ("Deshacer" o un cambio): el aviso de B que esperaba se borra; los de C y F siguen, uno
  -- cada uno. Si A vuelve a poner a B, le queda uno solo.
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.cambiar_tarea(t1, 'Reservar el auto', false, false, array[a, c, f]);
  execute 'reset role';
  select array_agg(v.persona order by v.persona) into quienes from public.avisos v where v.tarea = t1 and v.tipo = 'tarea';
  select array_agg(x order by x) into esperados from unnest(array[c, f]) as x;
  if quienes is distinct from esperados then raise exception 'Tras sacar a B, los avisos de la tarea quedaron para % (esperaba C y F)', quienes; end if;
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.cambiar_tarea(t1, 'Reservar el auto', false, false, array[a, b, c, f]);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.tarea = t1 and v.tipo = 'tarea' and v.persona = b;
  if n <> 1 then raise exception 'Volver a poner a B le dejó % avisos (esperaba 1)', n; end if;
  -- El de C ya salió: sacarla no lo borra (queda el registro de lo enviado)
  update public.avisos v set enviado_en = now(), intentos = 1 where v.tarea = t1 and v.persona = c;
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.cambiar_tarea(t1, 'Reservar el auto', false, false, array[a, b, f]);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.tarea = t1 and v.persona = c;
  if n <> 1 then raise exception 'Sacar a C borró el aviso que ya había salido (quedan %)', n; end if;

  -- A borra la tarea: los avisos que esperaban salir se borran
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.borrar_tarea(t1);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.tarea = t1 and v.enviado_en is null;
  if n <> 0 then raise exception 'Borrar la tarea dejó % avisos esperando salir', n; end if;

  -- Con los avisos en pausa (cargas en bloque) no se encola nada
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform set_config('puente.sin_avisos', 'si', true);
  t4 := (public.crear_tarea('En pausa', false, false, array[b])).id;
  perform set_config('puente.sin_avisos', '', true);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.tarea = t4;
  if n <> 0 then raise exception 'Una tarea creada en pausa dejó % avisos', n; end if;

  -- Un aviso de tarea sin la tarea no se puede guardar
  begin
    insert into public.avisos (persona, tipo) values (a, 'vence');
    raise exception 'Se guardó un aviso de tarea sin la tarea';
  exception when check_violation then null;
  end;

  -- ---------- "Mañana vence una tarea tuya" ----------
  -- Todas para el miércoles 16 de enero de 2030, salvo V6 (jueves 17):
  -- V1 basta con uno, de A, B y E, nadie la marcó          → A y B (E sale del grupo)
  -- V2 basta con uno, de A y B, B la marcó                 → nadie
  -- V3 cada uno, de A, B y C, B marcó la suya              → A y C
  -- V4 de B, borrada                                       → nadie
  -- V5 de D (apagó los de tareas) y G (sin dispositivos)   → nadie
  -- V6 de B, para el 17                                    → nadie todavía
  -- VP personal de A                                       → A
  execute como_usuario using ua;
  execute 'set local role authenticated';
  v1 := (public.crear_tarea('V1', false, false, array[a, b, e], para => '2030-01-16')).id;
  v2 := (public.crear_tarea('V2', false, false, array[a, b], para => '2030-01-16')).id;
  v3 := (public.crear_tarea('V3', true, false, array[a, b, c], para => '2030-01-16')).id;
  v4 := (public.crear_tarea('V4', false, false, array[b], para => '2030-01-16')).id;
  v5 := (public.crear_tarea('V5', false, false, array[d, g], para => '2030-01-16')).id;
  v6 := (public.crear_tarea('V6', false, false, array[b], para => '2030-01-17')).id;
  vp := (public.crear_tarea('VP', false, true, '{}'::uuid[], para => '2030-01-16')).id;
  perform public.borrar_tarea(v4);
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  perform public.marcar_tarea(v2, true);
  perform public.marcar_tarea(v3, true);
  execute 'reset role';
  update public.personas set sacada_en = now() where id = e;

  -- Dos días antes, y el día antes a las 09:59, todavía no
  n := public.encolar_recordatorios_de_tareas(timestamp '2030-01-14 12:00' at time zone la);
  if n <> 0 then raise exception 'Dos días antes se encolaron % recordatorios', n; end if;
  n := public.encolar_recordatorios_de_tareas(timestamp '2030-01-15 09:59' at time zone la);
  if n <> 0 then raise exception 'Antes de las 10:00 se encolaron % recordatorios', n; end if;
  select count(*) into n from public.avisos v where v.tipo = 'vence' and v.tarea in (v1, v2, v3, v4, v5, v6, vp);
  if n <> 0 then raise exception 'Hay % recordatorios antes de tiempo', n; end if;

  -- A las 10:00 del día antes
  n := public.encolar_recordatorios_de_tareas(timestamp '2030-01-15 10:00' at time zone la);
  if n <> 5 then raise exception 'A las 10:00 del día antes se encolaron % recordatorios (esperaba 5)', n; end if;
  select array_agg(q.x order by q.x) into pares
    from (select v.tarea::text || ':' || v.persona::text as x from public.avisos v
           where v.tipo = 'vence' and v.tarea in (v1, v2, v3, v4, v5, v6, vp)) q;
  select array_agg(x order by x) into pares_esperados
    from unnest(array[v1::text || ':' || a::text, v1::text || ':' || b::text, v3::text || ':' || a::text,
                      v3::text || ':' || c::text, vp::text || ':' || a::text]) as x;
  if pares is distinct from pares_esperados then
    raise exception 'Los recordatorios quedaron para % (esperaba V1: A y B; V3: A y C; VP: A)', pares;
  end if;
  select * into aviso from public.avisos v where v.tipo = 'vence' and v.tarea = v1 and v.persona = a;
  if aviso.datos ->> 'para' <> '2030-01-16' or aviso.sale_en > now() or aviso.evento is not null then
    raise exception 'El recordatorio no guardó la fecha o no quedó para salir de inmediato: %', aviso.datos;
  end if;

  -- Más tarde ese día (también a las 23:30 de California, que ya es el 16 en UTC) no se repite ni se adelanta V6
  n := public.encolar_recordatorios_de_tareas(timestamp '2030-01-15 18:30' at time zone la);
  if n <> 0 then raise exception 'La vuelta siguiente repitió % recordatorios', n; end if;
  n := public.encolar_recordatorios_de_tareas(timestamptz '2030-01-16 07:30:00+00');
  if n <> 0 then raise exception 'A las 23:30 de California se encolaron % recordatorios (¿tomó el día de UTC?)', n; end if;
  -- Aunque ya haya salido, no se repite
  update public.avisos v set enviado_en = now(), intentos = 1 where v.tipo = 'vence' and v.tarea = vp;
  n := public.encolar_recordatorios_de_tareas(timestamp '2030-01-15 21:00' at time zone la);
  if n <> 0 then raise exception 'Se repitió un recordatorio que ya había salido'; end if;

  -- El día 16 a las 10:00 toca V6 (vence el 17); las del 16 ya no
  n := public.encolar_recordatorios_de_tareas(timestamp '2030-01-16 10:00' at time zone la);
  if n <> 1 then raise exception 'El día 16 se encolaron % recordatorios (esperaba solo el de V6)', n; end if;
  select count(*) into n from public.avisos v where v.tipo = 'vence' and v.tarea = v6 and v.persona = b and v.datos ->> 'para' = '2030-01-17';
  if n <> 1 then raise exception 'B no recibió el recordatorio de V6'; end if;

  -- A le cambia la fecha a V1 (y deja fuera a E, que salió): la fecha nueva vuelve a recordar
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.cambiar_tarea(v1, 'V1', false, false, array[a, b], para => '2030-01-18');
  execute 'reset role';
  n := public.encolar_recordatorios_de_tareas(timestamp '2030-01-17 10:00' at time zone la);
  if n <> 2 then raise exception 'La fecha nueva de V1 dejó % recordatorios (esperaba A y B)', n; end if;
  select count(*) into n from public.avisos v where v.tipo = 'vence' and v.tarea = v1;
  if n <> 4 then raise exception 'V1 tiene % recordatorios (esperaba 2 del 16 y 2 del 18)', n; end if;

  -- Sacar a alguien de la tarea borra su recordatorio pendiente; borrar la tarea, todos
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.cambiar_tarea(v3, 'V3', true, false, array[a, b], para => '2030-01-16');
  perform public.borrar_tarea(v1);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.tipo = 'vence' and v.tarea = v3 and v.persona = c;
  if n <> 0 then raise exception 'Sacar a C de V3 dejó su recordatorio pendiente'; end if;
  select count(*) into n from public.avisos v where v.tipo = 'vence' and v.tarea = v3 and v.persona = a;
  if n <> 1 then raise exception 'Sacar a C de V3 borró el recordatorio de A'; end if;
  select count(*) into n from public.avisos v where v.tarea = v1;
  if n <> 0 then raise exception 'Borrar V1 dejó % avisos pendientes', n; end if;

  -- El reloj corre con la tarea nueva (con la hora de verdad no toca ninguna de estas)
  perform public.reloj_de_avisos();

  -- ---------- Los avisos de antes siguen con la firma nueva de encolar_aviso ----------
  execute como_usuario using ub;
  execute 'set local role authenticated';
  p1 := public.marcar_pagado(a, 1000);
  execute 'reset role';
  select count(*) into n from public.avisos v where v.pago = p1.id and v.persona = a and v.tipo = 'pago';
  if n <> 1 then raise exception 'A recibió % avisos del pago de B (esperaba 1)', n; end if;
  execute como_usuario using ua;
  execute 'set local role authenticated';
  insert into public.contactos (nombre, responsable) values ('Contacto para B', b) returning id into k1;
  execute 'reset role';
  select count(*) into n from public.avisos v where v.contacto = k1 and v.persona = b and v.tipo = 'contacto';
  if n <> 1 then raise exception 'B recibió % avisos del contacto asignado (esperaba 1)', n; end if;

  -- Nunca a quien apagó los de tareas, a quien no tiene dispositivos ni a quien salió
  select count(*) into n from public.avisos v where v.persona in (d, g, e);
  if n <> 0 then raise exception 'Hay % avisos para D, G o E', n; end if;

  execute 'reset role';
  raise exception 'PRUEBAS-OK';
end
$$;
