-- Si se cancela una reunión que salió de un contacto, el contacto vuelve solo a "Respondió" y desde ahí se agenda otra.
-- Deshacer la cancelación lo deja como estaba. Va en la base porque quien cancela no siempre puede editar el contacto.
-- Nunca hace fallar la cancelación: si algo sale mal, avisa y sigue.

create function public.al_cancelar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.contacto is null then
    return null;
  end if;
  begin
    if old.cancelado_en is null and new.cancelado_en is not null then
      -- Vuelve a "Respondió" si no le queda otra reunión vigente (sin cancelar y que no haya terminado)
      update public.contactos c
         set etapa = 'respondio'
       where c.id = new.contacto
         and c.etapa = 'reunion_agendada'
         and not exists (
           select 1 from public.eventos e
            where e.contacto = c.id and e.id <> new.id and e.cancelado_en is null and e.fin >= now()
         );
    elsif old.cancelado_en is not null and new.cancelado_en is null then
      -- Deshacer: vuelve a "Reunión agendada", con la fecha en que se creó la reunión (como estaba)
      update public.contactos c
         set etapa = 'reunion_agendada', etapa_en = least(new.creado_en, now())
       where c.id = new.contacto
         and c.etapa = 'respondio';
    end if;
  exception when others then
    raise warning 'Puente no pudo actualizar el contacto de la reunión %: %', new.id, sqlerrm;
  end;
  return null;
end;
$$;

create trigger al_cancelar_evento
after update of cancelado_en on public.eventos
for each row execute function public.al_cancelar_evento();
