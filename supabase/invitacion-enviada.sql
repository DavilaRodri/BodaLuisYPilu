-- Invitación enviada y dirección por invitado
alter table public.invitados
  add column if not exists direccion text check (direccion is null or char_length(direccion) <= 400),
  add column if not exists invitacion_enviada boolean not null default false;

update public.invitados i set direccion = c.direccion
  from public.confirmaciones c where c.id = i.confirmacion_id and i.direccion is null and c.direccion is not null;

create or replace function public.copiar_direccion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.direccion is null and new.confirmacion_id is not null then
    select direccion into new.direccion from public.confirmaciones where id = new.confirmacion_id;
  end if;
  return new;
end $$;
drop trigger if exists invitados_direccion on public.invitados;
create trigger invitados_direccion before insert on public.invitados for each row execute function public.copiar_direccion();
revoke execute on function public.copiar_direccion() from public, anon, authenticated;
