-- Prueba de las fotos de perfil. Corre en una sola transacción que termina con un error a propósito:
-- si todo está bien, el mensaje es "PRUEBAS-OK" y no queda nada guardado. Si algo falla, el mensaje dice qué.
-- Se corre con la Management API de Supabase (POST /v1/projects/<ref>/database/query) como postgres.
do $$
declare
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  a uuid;
  b uuid;
  base text;
  n int;
  como_usuario constant text := 'select set_config(''request.jwt.claims'', json_build_object(''sub'', $1, ''role'', ''authenticated'')::text, true)';
begin
  insert into public.personas (correo) values ('prueba.a@example.com') returning id into a;
  insert into public.personas (correo) values ('prueba.b@example.com') returning id into b;
  -- A entra con foto de Google; B, sin foto
  insert into auth.users (id, email, aud, role, raw_user_meta_data) values
    (ua, 'prueba.a@example.com', 'authenticated', 'authenticated', '{"full_name": "Prueba A", "avatar_url": "https://lh3.googleusercontent.com/a/prueba-a"}'),
    (ub, 'prueba.b@example.com', 'authenticated', 'authenticated', '{"full_name": "Prueba B"}');
  select count(*) into n from public.personas where id = a and foto = 'https://lh3.googleusercontent.com/a/prueba-a' and foto_google = foto;
  if n <> 1 then raise exception 'Al entrar, la foto de Google no quedó en foto y foto_google'; end if;
  base := 'https://yzkeajhidbvmemmsufaw.supabase.co/storage/v1/object/public/fotos/';

  execute como_usuario using ua;
  execute 'set local role authenticated';
  -- Una foto subida a su propia carpeta, ninguna, o volver a la de Google
  update public.personas set foto = base || a || '/propia.jpg' where id = a;
  update public.personas set foto = null where id = a;
  update public.personas set foto = 'https://lh3.googleusercontent.com/a/prueba-a' where id = a;
  begin
    update public.personas set foto = base || b || '/ajena.jpg' where id = a;
    raise exception 'A pudo usar una foto de la carpeta de B';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.personas set foto = 'https://otro-sitio.example/foto.jpg' where id = a;
    raise exception 'A pudo usar una foto de otro sitio';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.personas set foto_google = 'https://otro-sitio.example/foto.jpg' where id = a;
    raise exception 'A pudo cambiar su foto de Google';
  exception when insufficient_privilege then null;
  end;

  -- Cada uno sube y ve solo lo de su carpeta
  insert into storage.objects (bucket_id, name) values ('fotos', a || '/propia.jpg');
  begin
    insert into storage.objects (bucket_id, name) values ('fotos', b || '/ajena.jpg');
    raise exception 'A pudo subir a la carpeta de B';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from storage.objects where bucket_id = 'fotos' and name = a || '/propia.jpg';
  if n <> 1 then raise exception 'A no ve su propia foto'; end if;

  execute 'reset role';
  execute como_usuario using ub;
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'fotos' and name = a || '/propia.jpg';
  if n <> 0 then raise exception 'B ve la carpeta de A'; end if;
  -- Borrar no se prueba aquí: Supabase no deja borrar archivos con SQL, solo con su API de archivos

  execute 'reset role';
  raise exception 'PRUEBAS-OK';
end
$$;
