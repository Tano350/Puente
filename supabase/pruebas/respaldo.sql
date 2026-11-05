-- Prueba de la copia diaria: que se copie cada tabla con su cantidad, que nadie de afuera la vea, que se borren las
-- copias de más de 30 días y que se pueda recuperar lo borrado (contactos con notas, gastos con partes, eventos con
-- asistentes, pagos) sin duplicar y sin mandar avisos.
-- Corre en una sola transacción que termina con un error a propósito: si todo está bien, el mensaje es
-- "PRUEBAS-OK" y no queda nada guardado. Si algo falla, el mensaje dice qué.
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres, con la
-- migración 20261106020000_copia_diaria.sql ya aplicada.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  pa uuid;
  pb uuid;
  k1 uuid;
  k2 uuid;
  n1 uuid;
  n2 uuid;
  gid uuid;
  ev uuid;
  pago_id uuid;
  hoy date := (now() at time zone 'America/Los_Angeles')::date;
  una text;
  n int;
  esperadas int := cardinality(respaldo.tablas());
  cant int;
  largo int;
  filas_reales int;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  -- Los datos de prueba se crean con los avisos en pausa, para no encolar nada
  perform set_config('puente.sin_avisos', 'si', true);

  -- A y B son miembros; B está allá en enero de 2030 y tiene un dispositivo con avisos (recibiría todo tipo de avisos)
  insert into public.personas (correo) values ('prueba.a@example.com') returning id into pa;
  insert into public.personas (correo, llega, vuelve) values ('prueba.b@example.com', '2030-01-01', '2030-01-31') returning id into pb;
  insert into auth.users (id, email, aud, role) values
    (ua, 'prueba.a@example.com', 'authenticated', 'authenticated'),
    (ub, 'prueba.b@example.com', 'authenticated', 'authenticated');
  insert into public.suscripciones (endpoint, persona, p256dh, auth)
  values ('https://example.com/push/prueba-b', pb, 'prueba', 'prueba');

  -- Dos contactos con una nota cada uno. El primero ya cambió de etapa; al segundo se lo asignó otra persona.
  insert into public.contactos (nombre, responsable, creado_por) values ('Contacto uno de prueba', pa, pa) returning id into k1;
  insert into public.contactos (nombre, responsable, creado_por) values ('Contacto dos de prueba', pb, pa) returning id into k2;
  update public.contactos set etapa = 'contactado', etapa_en = '2030-01-02 10:00+00' where id = k1;
  update public.contactos set asignado_por = pb where id = k2;
  insert into public.notas (contacto, autor, texto) values (k1, pa, 'Nota uno de prueba') returning id into n1;
  insert into public.notas (contacto, autor, texto) values (k2, pa, 'Nota dos de prueba') returning id into n2;

  -- Un gasto con sus partes y una rendición
  insert into public.gastos (titulo, monto, fecha, pagado_por, division, creado_por)
  values ('Gasto de prueba', 3000, '2030-01-10', pa, 'iguales', pa) returning id into gid;
  insert into public.partes (gasto, persona, monto) values (gid, pa, 1500), (gid, pb, 1500);
  insert into public.rendiciones (gasto, persona) values (gid, pa);

  -- Un evento: al crearlo, el trigger suma a quien organiza; B también va, y la hora de llegada de A es anterior
  insert into public.eventos (titulo, inicio, fin, organizador, creado_por)
  values ('Evento de prueba', '2030-01-10 18:00+00', '2030-01-10 19:00+00', pa, pa) returning id into ev;
  insert into public.asistentes (evento, persona, estado) values (ev, pb, 'va');
  update public.asistentes set desde = '2030-01-09 12:00+00' where evento = ev and persona = pa;
  insert into public.notas_reunion (evento, autor, aprendi) values (ev, pa, 'Algo que aprendí en la prueba');

  -- Un pago de A a B, un calendario de Google asignado y un rato ocupado
  insert into public.pagos (de, a, monto) values (pa, pb, 500) returning id into pago_id;
  insert into public.calendarios (google_id, nombre, permiso, persona)
  values ('prueba-calendario@example.com', 'The Bridge: Prueba', 'reader', pa);
  insert into public.ocupados (persona, titulo, inicio, fin) values (pa, 'Ocupado de prueba', '2030-01-11 10:00+00', '2030-01-11 11:00+00');

  -- No hay avisos de B (todo se creó en pausa)
  select count(*) into n from public.avisos where persona = pb;
  if n <> 0 then raise exception 'La prueba encoló % avisos para B antes de empezar', n; end if;

  -- 1. Copiar: una fila por tabla copiada, con la cantidad correcta
  n := respaldo.copiar();
  if n <> esperadas then raise exception 'copiar() copió % tablas (esperaba %)', n, esperadas; end if;
  foreach una in array respaldo.tablas() loop
    execute format('select count(*)::int from public.%I', una) into filas_reales;
    select c.cantidad, jsonb_array_length(c.filas) into cant, largo
      from respaldo.copias c where c.dia = hoy and c.tabla = una;
    if not found then raise exception 'No quedó la copia de %', una; end if;
    if cant <> filas_reales or largo <> filas_reales then
      raise exception 'La copia de % trae % filas (cantidad %), la tabla tiene %', una, largo, cant, filas_reales;
    end if;
  end loop;
  select count(*) into n from respaldo.copias c where c.dia = hoy;
  if n <> esperadas then raise exception 'Hay % copias de hoy (esperaba %)', n, esperadas; end if;
  -- Lo que no vale la pena copiar no se copia
  select count(*) into n from respaldo.copias c
   where c.tabla in ('suscripciones', 'ocupados_google', 'avisos', 'sincronizacion');
  if n <> 0 then raise exception 'Se copiaron tablas que no se deben copiar'; end if;
  -- La copia trae los datos de la prueba
  if not exists (
    select 1 from respaldo.copias c, jsonb_array_elements(c.filas) f
     where c.dia = hoy and c.tabla = 'contactos' and f ->> 'id' = k1::text and f ->> 'nombre' = 'Contacto uno de prueba'
  ) then raise exception 'La copia de contactos no trae el contacto de prueba'; end if;
  -- Copiar otra vez el mismo día reemplaza, no duplica
  n := respaldo.copiar();
  select count(*) into n from respaldo.copias c where c.dia = hoy;
  if n <> esperadas then raise exception 'Copiar dos veces dejó % copias de hoy (esperaba %)', n, esperadas; end if;

  -- 2. Se borran las copias de más de 30 días (la de hace exactamente 30 días se queda)
  insert into respaldo.copias (dia, tabla, filas, cantidad) values
    (hoy - 31, 'prueba_vieja', '[]', 0), (hoy - 30, 'prueba_vieja', '[]', 0), (hoy - 100, 'prueba_vieja', '[]', 0);
  perform respaldo.copiar();
  select count(*) into n from respaldo.copias c where c.tabla = 'prueba_vieja' and c.dia in (hoy - 31, hoy - 100);
  if n <> 0 then raise exception 'Quedaron % copias de más de 30 días', n; end if;
  select count(*) into n from respaldo.copias c where c.tabla = 'prueba_vieja' and c.dia = hoy - 30;
  if n <> 1 then raise exception 'Se borró la copia de hace 30 días, que se debía quedar'; end if;
  delete from respaldo.copias c where c.tabla = 'prueba_vieja';

  -- 3. Nadie de afuera lee las copias ni llama a las funciones
  execute como_usuario using ua;
  execute 'set local role authenticated';
  begin
    perform 1 from respaldo.copias;
    raise exception 'Un usuario leyó respaldo.copias';
  exception when insufficient_privilege then null;
  end;
  begin
    perform respaldo.copiar();
    raise exception 'Un usuario llamó a respaldo.copiar()';
  exception when insufficient_privilege then null;
  end;
  begin
    perform respaldo.recuperar('contactos', hoy);
    raise exception 'Un usuario llamó a respaldo.recuperar()';
  exception when insufficient_privilege then null;
  end;
  begin
    perform respaldo.tablas();
    raise exception 'Un usuario llamó a respaldo.tablas()';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  execute 'set local role anon';
  begin
    perform 1 from respaldo.copias;
    raise exception 'Alguien sin sesión leyó respaldo.copias';
  exception when insufficient_privilege then null;
  end;
  begin
    perform respaldo.copiar();
    raise exception 'Alguien sin sesión llamó a respaldo.copiar()';
  exception when insufficient_privilege then null;
  end;
  begin
    perform respaldo.recuperar('contactos', hoy);
    raise exception 'Alguien sin sesión llamó a respaldo.recuperar()';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';

  -- 4. Recuperar pide una tabla de la lista y un día con copia
  begin
    perform respaldo.recuperar('avisos', hoy);
    raise exception 'Recuperó una tabla que no se copia';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform respaldo.recuperar('contactos; drop table public.personas', hoy);
    raise exception 'Aceptó un nombre de tabla armado a mano';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform respaldo.recuperar(null, hoy);
    raise exception 'Aceptó una tabla vacía';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform respaldo.recuperar('contactos', hoy + 1);
    raise exception 'Recuperó de un día sin copia';
  exception when no_data_found then null;
  end;
  begin
    perform respaldo.recuperar('calendarios', hoy, array[gen_random_uuid()]);
    raise exception 'Filtró por ids una tabla que no tiene id';
  exception when invalid_parameter_value then null;
  end;

  -- Desde aquí los avisos NO están en pausa: recuperar los pausa por su cuenta
  perform set_config('puente.sin_avisos', '', true);

  -- 5. Un contacto borrado vuelve, con su etapa y sus notas; el otro no vuelve si no se pide
  delete from public.contactos where id in (k1, k2);
  select count(*) into n from public.notas where id in (n1, n2);
  if n <> 0 then raise exception 'Borrar los contactos no se llevó sus notas'; end if;
  n := respaldo.recuperar('contactos', hoy, array[k1]);
  if n <> 1 then raise exception 'Recuperar el contacto devolvió % (esperaba 1)', n; end if;
  if not exists (select 1 from public.contactos where id = k1 and etapa = 'contactado' and etapa_en = '2030-01-02 10:00+00' and asignado_por is null) then
    raise exception 'El contacto no volvió con su etapa y su fecha de etapa';
  end if;
  if exists (select 1 from public.contactos where id = k2) then raise exception 'Volvió un contacto que no se pidió'; end if;
  n := respaldo.recuperar('notas', hoy, array[n1]);
  if n <> 1 then raise exception 'Recuperar la nota devolvió % (esperaba 1)', n; end if;
  if exists (select 1 from public.notas where id = n2) then raise exception 'Volvió una nota que no se pidió'; end if;
  -- Dos veces no duplica
  n := respaldo.recuperar('contactos', hoy, array[k1]);
  if n <> 0 then raise exception 'Recuperar de nuevo el contacto devolvió % (esperaba 0)', n; end if;
  n := respaldo.recuperar('notas', hoy, array[n1]);
  if n <> 0 then raise exception 'Recuperar de nuevo la nota devolvió % (esperaba 0)', n; end if;
  -- Sin ids vuelve todo lo que falta, y conserva a quien se lo asignó
  n := respaldo.recuperar('contactos', hoy);
  if n <> 1 then raise exception 'Recuperar todos los contactos devolvió % (esperaba 1)', n; end if;
  if not exists (select 1 from public.contactos where id = k2 and responsable = pb and asignado_por = pb) then
    raise exception 'El segundo contacto no volvió con quien se lo asignó';
  end if;
  n := respaldo.recuperar('notas', hoy);
  if n <> 1 then raise exception 'Recuperar todas las notas devolvió % (esperaba 1)', n; end if;
  n := respaldo.recuperar('contactos', hoy);
  if n <> 0 then raise exception 'Recuperar todos los contactos otra vez devolvió % (esperaba 0)', n; end if;
  n := respaldo.recuperar('notas', hoy);
  if n <> 0 then raise exception 'Recuperar todas las notas otra vez devolvió % (esperaba 0)', n; end if;
  select count(*) into n from public.contactos where id in (k1, k2);
  if n <> 2 then raise exception 'Hay % contactos de prueba (esperaba 2)', n; end if;
  select count(*) into n from public.notas where id in (n1, n2);
  if n <> 2 then raise exception 'Hay % notas de prueba (esperaba 2)', n; end if;

  -- 6. Un gasto borrado vuelve con sus partes y su rendición, en ese orden (las partes sin su gasto no entran)
  delete from public.gastos where id = gid;
  select count(*) into n from public.partes where gasto = gid;
  if n <> 0 then raise exception 'Borrar el gasto no se llevó sus partes'; end if;
  begin
    perform respaldo.recuperar('partes', hoy, array[gid]);
    raise exception 'Recuperó partes de un gasto que no está';
  exception when foreign_key_violation then null;
  end;
  n := respaldo.recuperar('gastos', hoy, array[gid]);
  if n <> 1 then raise exception 'Recuperar el gasto devolvió % (esperaba 1)', n; end if;
  n := respaldo.recuperar('partes', hoy, array[gid]);
  if n <> 2 then raise exception 'Recuperar las partes devolvió % (esperaba 2)', n; end if;
  n := respaldo.recuperar('rendiciones', hoy, array[gid]);
  if n <> 1 then raise exception 'Recuperar la rendición devolvió % (esperaba 1)', n; end if;
  if not exists (select 1 from public.gastos where id = gid and monto = 3000 and titulo = 'Gasto de prueba') then
    raise exception 'El gasto no volvió igual';
  end if;
  select coalesce(sum(monto), 0) into n from public.partes where gasto = gid;
  if n <> 3000 then raise exception 'Las partes recuperadas suman % (esperaba 3000)', n; end if;
  -- Dos veces no duplica
  if respaldo.recuperar('gastos', hoy, array[gid]) <> 0 or respaldo.recuperar('partes', hoy, array[gid]) <> 0
     or respaldo.recuperar('rendiciones', hoy, array[gid]) <> 0 then
    raise exception 'Recuperar el gasto dos veces volvió a insertar filas';
  end if;
  select count(*) into n from public.partes where gasto = gid;
  if n <> 2 then raise exception 'Hay % partes (esperaba 2)', n; end if;

  -- 7. Un evento borrado vuelve sin inventar asistentes: cada uno con su estado y su hora de llegada de entonces
  delete from public.eventos where id = ev;
  select count(*) into n from public.asistentes where evento = ev;
  if n <> 0 then raise exception 'Borrar el evento no se llevó a sus asistentes'; end if;
  n := respaldo.recuperar('eventos', hoy, array[ev]);
  if n <> 1 then raise exception 'Recuperar el evento devolvió % (esperaba 1)', n; end if;
  select count(*) into n from public.asistentes where evento = ev;
  if n <> 0 then raise exception 'Al volver el evento quedaron % asistentes inventados por el trigger', n; end if;
  n := respaldo.recuperar('asistentes', hoy, array[ev]);
  if n <> 2 then raise exception 'Recuperar los asistentes devolvió % (esperaba 2)', n; end if;
  if not exists (select 1 from public.asistentes where evento = ev and persona = pa and estado = 'va' and desde = '2030-01-09 12:00+00') then
    raise exception 'El organizador no volvió con su hora de llegada de entonces';
  end if;
  n := respaldo.recuperar('notas_reunion', hoy, array[ev]);
  if n <> 1 then raise exception 'Recuperar la nota de reunión devolvió % (esperaba 1)', n; end if;
  if respaldo.recuperar('eventos', hoy, array[ev]) <> 0 or respaldo.recuperar('asistentes', hoy, array[ev]) <> 0
     or respaldo.recuperar('notas_reunion', hoy, array[ev]) <> 0 then
    raise exception 'Recuperar el evento dos veces volvió a insertar filas';
  end if;
  select count(*) into n from public.asistentes where evento = ev;
  if n <> 2 then raise exception 'Hay % asistentes (esperaba 2)', n; end if;

  -- 8. Un pago y un calendario borrados vuelven
  delete from public.pagos where id = pago_id;
  n := respaldo.recuperar('pagos', hoy, array[pago_id]);
  if n <> 1 then raise exception 'Recuperar el pago devolvió % (esperaba 1)', n; end if;
  delete from public.calendarios where google_id = 'prueba-calendario@example.com';
  n := respaldo.recuperar('calendarios', hoy);
  if n <> 1 then raise exception 'Recuperar el calendario devolvió % (esperaba 1)', n; end if;
  if not exists (select 1 from public.calendarios where google_id = 'prueba-calendario@example.com' and persona = pa) then
    raise exception 'El calendario no volvió con su persona';
  end if;
  delete from public.ocupados where persona = pa;
  n := respaldo.recuperar('ocupados', hoy);
  if n <> 1 then raise exception 'Recuperar el rato ocupado devolvió % (esperaba 1)', n; end if;

  -- 9. Recuperar no avisó a nadie (evento, contacto asignado a B y pago a B habrían avisado a B) y dejó la pausa como estaba
  select count(*) into n from public.avisos where persona = pb;
  if n <> 0 then raise exception 'Recuperar encoló % avisos para B', n; end if;
  if coalesce(current_setting('puente.sin_avisos', true), '') <> '' then
    raise exception 'Recuperar dejó la pausa de avisos encendida';
  end if;

  -- (Que una tabla que falta no rompa la copia no se prueba aquí: habría que renombrar una tabla de la base real.)

  raise exception 'PRUEBAS-OK';
end
$$;
