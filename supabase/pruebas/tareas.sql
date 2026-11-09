-- Prueba de permisos de Tareas: crear (con el id del dispositivo), quién ve qué (las personales ni quien administra),
-- quién cambia y borra, marcar en "basta con uno" y en "cada uno", tomar y soltar (dos no se toman la misma), quién
-- ya no está en Puente y la copia diaria de las dos tablas nuevas.
-- Corre en una sola transacción que termina con un error a propósito: si todo está bien, el mensaje es
-- "PRUEBAS-OK" y no queda nada guardado. Si algo falla, el mensaje dice qué.
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  uc uuid := gen_random_uuid();
  ud uuid := gen_random_uuid();
  a uuid;
  b uuid;
  c uuid;
  d uuid;
  t1 public.tareas;
  t2 public.tareas;
  t3 public.tareas;
  t4 public.tareas;
  t5 public.tareas;
  t6 public.tareas;
  otra public.tareas;
  tid uuid := gen_random_uuid();
  n int;
  h text;
  primera timestamptz;
  hoy date := (now() at time zone 'America/Los_Angeles')::date;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  -- A, B y D son miembros; C administra
  insert into public.personas (correo) values ('prueba.a@example.com') returning id into a;
  insert into public.personas (correo) values ('prueba.b@example.com') returning id into b;
  insert into public.personas (correo, administra) values ('prueba.c@example.com', true) returning id into c;
  insert into public.personas (correo) values ('prueba.d@example.com') returning id into d;
  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba.a@example.com', 'authenticated', 'authenticated'),
    (ub, 'prueba.b@example.com', 'authenticated', 'authenticated'),
    (uc, 'prueba.c@example.com', 'authenticated', 'authenticated'),
    (ud, 'prueba.d@example.com', 'authenticated', 'authenticated');

  -- ---------- A crea ----------
  execute como_usuario using ua;
  execute 'set local role authenticated';
  t1 := public.crear_tarea('Para B', false, false, array[b], 'Notas de prueba', '2030-01-10');
  if t1.creada_por <> a or t1.cada_uno or t1.personal or t1.para <> '2030-01-10' or t1.notas <> 'Notas de prueba' then
    raise exception 'crear_tarea no guardó bien la tarea de B';
  end if;
  select count(*) into n from public.asignados where tarea = t1.id and persona = b and not tomada and hecha_en is null;
  if n <> 1 then raise exception 'B no quedó asignado a su tarea'; end if;
  -- "Cada uno" con los tres; con una sola persona, "cada uno" no cuenta
  t2 := public.crear_tarea('Cada uno', true, false, array[a, b, c, a]);
  if not t2.cada_uno then raise exception 'La tarea de cada uno no quedó como cada uno'; end if;
  select count(*) into n from public.asignados where tarea = t2.id;
  if n <> 3 then raise exception 'Cada uno no quedó con tres personas sin repetir (%)', n; end if;
  otra := public.crear_tarea('Cada uno de uno', true, false, array[b]);
  if otra.cada_uno then raise exception '"Cada uno" quedó con una sola persona'; end if;
  -- Personal: es solo de quien la crea aunque mande a otros
  t3 := public.crear_tarea('Personal de A', false, true, array[b, c]);
  select count(*) into n from public.asignados where tarea = t3.id;
  if not t3.personal or n <> 1 or not exists (select 1 from public.asignados where tarea = t3.id and persona = a) then
    raise exception 'La tarea personal no quedó solo de A';
  end if;
  -- Sin asignar
  t4 := public.crear_tarea('Sin asignar', false, false, '{}'::uuid[]);
  select count(*) into n from public.asignados where tarea = t4.id;
  if n <> 0 then raise exception 'La tarea sin asignar quedó con alguien'; end if;
  -- Basta con uno, entre A y B
  t5 := public.crear_tarea('A o B', false, false, array[a, b]);
  -- Sin título no se crea
  begin
    perform public.crear_tarea('   ', false, false, array[a]);
    raise exception 'Se creó una tarea sin título';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'titulo' then raise exception 'Sin título dio el motivo "%"', h; end if;
  end;
  -- Con el id del dispositivo: repetir devuelve la misma, sin cambiarla ni duplicarla
  t6 := public.crear_tarea('Con id', false, false, array[a], null, null, tid);
  if t6.id <> tid then raise exception 'crear_tarea no usó el id del dispositivo'; end if;
  otra := public.crear_tarea('Otro título', true, false, array[a, b], null, null, tid);
  if otra.id <> tid or otra.titulo <> 'Con id' then raise exception 'Repetir crear_tarea cambió la tarea'; end if;
  select count(*) into n from public.tareas where id = tid;
  if n <> 1 then raise exception 'Repetir crear_tarea la duplicó'; end if;
  -- Las tablas no se escriben directo
  begin
    insert into public.tareas (titulo) values ('Directo');
    raise exception 'A escribió directo en tareas';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.asignados (tarea, persona) values (t4.id, a);
    raise exception 'A escribió directo en asignados';
  exception when insufficient_privilege then null;
  end;

  -- ---------- Quién ve qué ----------
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  select count(*) into n from public.tareas where id in (t1.id, t2.id, t4.id, t5.id);
  if n <> 4 then raise exception 'B no ve las tareas del grupo (%)', n; end if;
  select count(*) into n from public.tareas where id = t3.id;
  if n <> 0 then raise exception 'B ve la tarea personal de A'; end if;
  select count(*) into n from public.asignados where tarea = t3.id;
  if n <> 0 then raise exception 'B ve quién tiene la tarea personal de A'; end if;
  -- Con el id de la tarea de A, B no la puede reclamar como suya
  begin
    perform public.crear_tarea('Robo de id', false, false, array[b], null, null, tid);
    raise exception 'B reusó el id de una tarea de A';
  exception when unique_violation then null;
  end;
  execute 'reset role';
  execute como_usuario using uc;
  execute 'set local role authenticated';
  select count(*) into n from public.tareas where id = t3.id;
  if n <> 0 then raise exception 'Quien administra ve la tarea personal de A'; end if;

  -- ---------- Quién cambia y borra ----------
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  begin
    perform public.cambiar_tarea(t1.id, 'B la cambia', false, false, array[b]);
    raise exception 'B cambió una tarea que creó A';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.borrar_tarea(t1.id);
    raise exception 'B borró una tarea que creó A';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cambiar_tarea(t3.id, 'B cambia la personal', false, true, array[a]);
    raise exception 'B cambió la tarea personal de A';
  exception when no_data_found then null;
  end;
  -- Quien administra cambia la de A, pero no la puede hacer personal
  execute 'reset role';
  execute como_usuario using uc;
  execute 'set local role authenticated';
  otra := public.cambiar_tarea(t1.id, 'C la cambia', false, false, array[b], null, '2030-01-12');
  if otra.titulo <> 'C la cambia' or otra.para <> '2030-01-12' or otra.notas is not null then
    raise exception 'Quien administra no pudo cambiar la tarea (o no se borraron las notas)';
  end if;
  begin
    perform public.cambiar_tarea(t1.id, 'C la hace personal', false, true, array[b]);
    raise exception 'Quien administra hizo personal una tarea ajena';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.cambiar_tarea(t3.id, 'C cambia la personal', false, true, array[a]);
    raise exception 'Quien administra cambió la tarea personal de A';
  exception when no_data_found then null;
  end;
  begin
    perform public.borrar_tarea(t3.id);
    raise exception 'Quien administra borró la tarea personal de A';
  exception when insufficient_privilege then null;
  end;

  -- ---------- Marcar ----------
  -- Basta con uno (t5, A o B): A marca, B marcar no cambia nada, B desmarca para todos
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.marcar_tarea(t5.id, true);
  select hecha_en into primera from public.asignados where tarea = t5.id and persona = a;
  if primera is null then raise exception 'A no pudo marcar la tarea de A o B'; end if;
  perform public.marcar_tarea(t5.id, true);
  select count(*) into n from public.asignados where tarea = t5.id and persona = a and hecha_en = primera;
  if n <> 1 then raise exception 'Marcar de nuevo cambió la hora de la marca'; end if;
  begin
    perform public.marcar_tarea(t1.id, true);
    raise exception 'A marcó una tarea que no tiene';
  exception when insufficient_privilege then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'no_asignado' then raise exception 'Marcar ajena dio el motivo "%"', h; end if;
  end;
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  perform public.marcar_tarea(t5.id, true);
  select count(*) into n from public.asignados where tarea = t5.id and hecha_en is not null;
  if n <> 1 then raise exception 'En "basta con uno" quedaron % marcas', n; end if;
  perform public.marcar_tarea(t5.id, false);
  select count(*) into n from public.asignados where tarea = t5.id and hecha_en is not null;
  if n <> 0 then raise exception 'Desmarcar "basta con uno" no la dejó por hacer para todos'; end if;
  -- Cada uno (t2, A, B y C): cada marca es de quien la hace
  perform public.marcar_tarea(t2.id, true);
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.marcar_tarea(t2.id, true);
  perform public.marcar_tarea(t2.id, false);
  select count(*) into n from public.asignados where tarea = t2.id and hecha_en is not null;
  if n <> 1 or not exists (select 1 from public.asignados where tarea = t2.id and persona = b and hecha_en is not null) then
    raise exception 'En "cada uno" las marcas no quedaron de cada persona';
  end if;
  -- Cambiar quiénes la tienen: quien sigue conserva su marca, quien sale la pierde
  otra := public.cambiar_tarea(t2.id, 'Cada uno', true, false, array[b, c]);
  select count(*) into n from public.asignados where tarea = t2.id;
  if n <> 2 or exists (select 1 from public.asignados where tarea = t2.id and persona = a) then
    raise exception 'Cambiar las personas no sacó a A';
  end if;
  if not exists (select 1 from public.asignados where tarea = t2.id and persona = b and hecha_en is not null) then
    raise exception 'B perdió su marca al cambiar las personas';
  end if;

  -- ---------- Tomar y soltar ----------
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  perform public.tomar_tarea(t4.id);
  select count(*) into n from public.asignados where tarea = t4.id and persona = b and tomada;
  if n <> 1 then raise exception 'B no pudo tomar la tarea sin asignar'; end if;
  begin
    perform public.tomar_tarea(t3.id);
    raise exception 'B tomó la tarea personal de A';
  exception when no_data_found then null;
  end;
  execute 'reset role';
  execute como_usuario using uc;
  execute 'set local role authenticated';
  begin
    perform public.tomar_tarea(t4.id);
    raise exception 'C tomó una tarea que ya tenía B';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'tomada' then raise exception 'Tomar una ya tomada dio el motivo "%"', h; end if;
  end;
  begin
    perform public.soltar_tarea(t4.id);
    raise exception 'C soltó una tarea que tomó B';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  perform public.marcar_tarea(t4.id, true);
  perform public.soltar_tarea(t4.id);
  select count(*) into n from public.asignados where tarea = t4.id;
  if n <> 0 then raise exception 'Soltar no la devolvió a sin asignar'; end if;

  -- ---------- Borrar y devolver ----------
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.borrar_tarea(t1.id);
  select count(*) into n from public.tareas where id = t1.id and borrada_en is not null;
  if n <> 1 then raise exception 'La tarea no quedó borrada'; end if;
  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  begin
    perform public.marcar_tarea(t1.id, true);
    raise exception 'B marcó una tarea borrada';
  exception when no_data_found then null;
  end;
  execute 'reset role';
  execute como_usuario using ua;
  execute 'set local role authenticated';
  perform public.devolver_tarea(t1.id);
  select count(*) into n from public.tareas where id = t1.id and borrada_en is null;
  if n <> 1 then raise exception 'La tarea no volvió'; end if;
  -- Quien administra borra una tarea ajena (no personal)
  execute 'reset role';
  execute como_usuario using uc;
  execute 'set local role authenticated';
  perform public.borrar_tarea(t5.id);

  -- ---------- Quien ya no está en Puente ----------
  execute 'reset role';
  update public.personas set sacada_en = now() where id = d;
  execute como_usuario using ua;
  execute 'set local role authenticated';
  begin
    perform public.crear_tarea('Para D', false, false, array[d]);
    raise exception 'Se asignó una tarea a quien ya no está en Puente';
  exception when invalid_parameter_value then
    get stacked diagnostics h = pg_exception_hint;
    if h <> 'persona' then raise exception 'Asignar a quien salió dio el motivo "%"', h; end if;
  end;
  execute 'reset role';
  execute como_usuario using ud;
  execute 'set local role authenticated';
  select count(*) into n from public.tareas;
  if n <> 0 then raise exception 'Quien ya no está en Puente ve tareas'; end if;
  begin
    perform public.crear_tarea('D crea', false, false, array[a]);
    raise exception 'Quien ya no está en Puente creó una tarea';
  exception when insufficient_privilege then null;
  end;

  -- ---------- Copia diaria: las dos tablas se copian y se recuperan por el id de la tarea ----------
  execute 'reset role';
  if not ('tareas' = any (respaldo.tablas()) and 'asignados' = any (respaldo.tablas())) then
    raise exception 'La copia diaria no incluye tareas y asignados';
  end if;
  perform respaldo.copiar();
  delete from public.tareas where id = t2.id;
  n := respaldo.recuperar('tareas', hoy, array[t2.id]);
  if n <> 1 then raise exception 'No se recuperó la tarea borrada por error (%)', n; end if;
  n := respaldo.recuperar('asignados', hoy, array[t2.id]);
  if n <> 2 then raise exception 'No se recuperaron sus asignados (%)', n; end if;

  raise exception 'PRUEBAS-OK';
end
$$;
