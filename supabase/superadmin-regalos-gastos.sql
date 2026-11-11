
-- Datos de la boda visibles para los novios
alter table public.bodas
  add column if not exists pareja_a text,
  add column if not exists pareja_b text,
  add column if not exists dominio text,
  add column if not exists cuentas_separadas boolean not null default false,
  add column if not exists pagadores text[] not null default '{}',
  add column if not exists presupuesto numeric(10,2),
  add column if not exists borrar_alergias_meses int not null default 3 check (borrar_alergias_meses between 1 and 36),
  add column if not exists borrar_datos_meses int not null default 36 check (borrar_datos_meses between 3 and 36);

update public.bodas set pareja_a = 'Pilar', pareja_b = 'Luis', dominio = 'bodapilaryluis.com' where slug = 'pilar-y-luis' and pareja_a is null;

alter table public.confirmaciones add column if not exists consiente boolean;

-- Datos de la cuenta, solo para el superadmin
create table if not exists public.boda_cuentas (
  boda_id uuid primary key references public.bodas(id) on delete cascade,
  estado text not null default 'activa' check (estado in ('activa','bloqueada')),
  precio numeric(10,2),
  cobrado boolean not null default false,
  contacto text,
  notas text,
  actualizado timestamptz not null default now()
);
alter table public.boda_cuentas enable row level security;
insert into public.boda_cuentas (boda_id, precio, cobrado, notas)
  select id, 0, true, 'Boda de Luis, regalo de RD' from public.bodas where slug = 'pilar-y-luis'
  on conflict do nothing;

create or replace function public.es_superadmin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.superadmins where user_id = (select auth.uid()));
$$;

-- Una boda bloqueada deja fuera a los novios (el superadmin sigue entrando)
create or replace function public.es_admin(b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (exists (select 1 from public.boda_admins where boda_id = b and user_id = (select auth.uid()))
          and not exists (select 1 from public.boda_cuentas where boda_id = b and estado = 'bloqueada'))
      or exists (select 1 from public.superadmins where user_id = (select auth.uid()));
$$;

create policy "superadmin cuentas" on public.boda_cuentas for all to authenticated using (public.es_superadmin()) with check (public.es_superadmin());
create policy "superadmin crea boda" on public.bodas for insert to authenticated with check (public.es_superadmin());
create policy "superadmin borra boda" on public.bodas for delete to authenticated using (public.es_superadmin());
create policy "superadmin accesos" on public.boda_admins for all to authenticated using (public.es_superadmin()) with check (public.es_superadmin());

-- Las políticas viejas atadas al email de Luis ya sobran
drop policy if exists "novios borran" on public.confirmaciones;
drop policy if exists "novios leen" on public.confirmaciones;

-- Regalos
create table if not exists public.regalos (
  id uuid primary key default gen_random_uuid(),
  boda_id uuid not null references public.bodas(id) on delete cascade,
  de text not null check (length(de) between 1 and 160),
  personas int not null default 1 check (personas between 0 and 50),
  importe numeric(10,2) not null default 0 check (importe >= 0),
  lado text not null default 'ambos' check (lado in ('a','b','ambos')),
  forma text not null default 'transferencia' check (forma in ('transferencia','efectivo','bizum','sobre','regalo','otro')),
  recibido date,
  agradecido boolean not null default false,
  notas text,
  creado timestamptz not null default now()
);
create index if not exists regalos_boda on public.regalos(boda_id);
alter table public.regalos enable row level security;
create policy "admin regalos" on public.regalos for all to authenticated using (public.es_admin(boda_id)) with check (public.es_admin(boda_id));

alter table public.invitados add column if not exists regalo_id uuid references public.regalos(id) on delete set null;
create index if not exists invitados_regalo on public.invitados(regalo_id);

-- Proveedores
create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  boda_id uuid not null references public.bodas(id) on delete cascade,
  nombre text not null check (length(nombre) between 1 and 120),
  categoria text,
  contacto text,
  telefono text,
  email text,
  web text,
  notas text,
  creado timestamptz not null default now()
);
create index if not exists proveedores_boda on public.proveedores(boda_id);
alter table public.proveedores enable row level security;
create policy "admin proveedores" on public.proveedores for all to authenticated using (public.es_admin(boda_id)) with check (public.es_admin(boda_id));

-- Gastos
create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  boda_id uuid not null references public.bodas(id) on delete cascade,
  concepto text not null check (length(concepto) between 1 and 160),
  categoria text,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  importe numeric(10,2) not null default 0 check (importe >= 0),
  pagado numeric(10,2) not null default 0 check (pagado >= 0),
  vence date,
  paga text,
  notas text,
  creado timestamptz not null default now()
);
create index if not exists gastos_boda on public.gastos(boda_id);
alter table public.gastos enable row level security;
create policy "admin gastos" on public.gastos for all to authenticated using (public.es_admin(boda_id)) with check (public.es_admin(boda_id));

-- Alta de una boda nueva con su cuenta de novios, en un paso
create or replace function public.crear_boda(p_nombre text, p_slug text, p_fecha date, p_pareja_a text, p_pareja_b text,
  p_dominio text, p_email text, p_password text, p_precio numeric default null, p_contacto text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_boda uuid; v_user uuid; v_email text := lower(trim(p_email));
begin
  if not public.es_superadmin() then raise exception 'Solo el superadmin puede crear bodas'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'La contraseña tiene que tener al menos 8 caracteres'; end if;
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'El identificador solo admite minúsculas, números y guiones'; end if;
  if exists (select 1 from public.bodas where slug = p_slug) then raise exception 'Ya existe una boda con el identificador %', p_slug; end if;

  insert into public.bodas (nombre, slug, fecha, pareja_a, pareja_b, dominio)
    values (p_nombre, p_slug, p_fecha, p_pareja_a, p_pareja_b, nullif(trim(p_dominio),''))
    returning id into v_boda;
  insert into public.boda_cuentas (boda_id, precio, contacto) values (v_boda, p_precio, p_contacto);

  select id into v_user from auth.users where email = v_email;
  if v_user is null then
    v_user := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_user, v_user::text, 'email',
      jsonb_build_object('sub', v_user::text, 'email', v_email, 'email_verified', true), now(), now(), now());
  end if;
  insert into public.boda_admins (boda_id, user_id) values (v_boda, v_user) on conflict do nothing;
  insert into public.grupos (boda_id, nombre, color, orden) values
    (v_boda, 'Familia de ' || p_pareja_a, '#b4746a', 1), (v_boda, 'Familia de ' || p_pareja_b, '#5f7a8c', 2),
    (v_boda, 'Amigos de ' || p_pareja_a, '#c49a4a', 3), (v_boda, 'Amigos de ' || p_pareja_b, '#6f7d4f', 4);
  return v_boda;
end $$;
revoke all on function public.crear_boda from public, anon;
grant execute on function public.crear_boda to authenticated;

-- El superadmin puede poner una contraseña nueva a una cuenta de novios
create or replace function public.cambiar_clave_novios(p_boda uuid, p_password text)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not public.es_superadmin() then raise exception 'Solo el superadmin'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'La contraseña tiene que tener al menos 8 caracteres'; end if;
  update auth.users u set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
    from public.boda_admins a
   where a.boda_id = p_boda and a.user_id = u.id and not exists (select 1 from public.superadmins s where s.user_id = u.id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.cambiar_clave_novios from public, anon;
grant execute on function public.cambiar_clave_novios to authenticated;

-- Resumen de todas las bodas para el superadmin
create or replace function public.superadmin_bodas()
returns table (id uuid, nombre text, slug text, fecha date, dominio text, estado text, precio numeric, cobrado boolean,
  contacto text, notas text, cuentas text[], invitados bigint, vienen bigint, mesas bigint, regalos numeric, ultima timestamptz, creado timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.id, b.nombre, b.slug, b.fecha, b.dominio, coalesce(c.estado,'activa'), c.precio, coalesce(c.cobrado,false), c.contacto, c.notas,
    array(select u.email::text from public.boda_admins a join auth.users u on u.id = a.user_id
          where a.boda_id = b.id and not exists (select 1 from public.superadmins s where s.user_id = a.user_id)),
    (select count(*) from public.invitados i where i.boda_id = b.id),
    (select count(*) from public.invitados i where i.boda_id = b.id and i.asiste = 'si'),
    (select count(*) from public.mesas m where m.boda_id = b.id),
    (select coalesce(sum(r.importe),0) from public.regalos r where r.boda_id = b.id),
    (select max(x.creado) from public.confirmaciones x where x.boda_id = b.id),
    b.creado
  from public.bodas b left join public.boda_cuentas c on c.boda_id = b.id
  where public.es_superadmin()
  order by b.fecha nulls last;
$$;
revoke all on function public.superadmin_bodas from public, anon;
grant execute on function public.superadmin_bodas to authenticated;

-- Borrado automático por protección de datos
create or replace function public.purgar_datos()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Alergias y dietas: X meses después de la boda
  update public.invitados i set alergias = '{}', alergia_otra = null
    from public.bodas b
   where b.id = i.boda_id and b.fecha is not null
     and b.fecha + make_interval(months => b.borrar_alergias_meses) < current_date
     and (cardinality(i.alergias) > 0 or i.alergia_otra is not null);
  update public.confirmaciones c set asistentes = (
      select coalesce(jsonb_agg(a - 'alergias' - 'alergia_otra'), '[]'::jsonb) from jsonb_array_elements(c.asistentes) a)
    from public.bodas b
   where b.id = c.boda_id and b.fecha is not null
     and b.fecha + make_interval(months => b.borrar_alergias_meses) < current_date
     and c.asistentes is not null and jsonb_typeof(c.asistentes) = 'array'
     and exists (select 1 from jsonb_array_elements(c.asistentes) a where a ? 'alergias' or a ? 'alergia_otra');
  -- Todo lo demás: Y meses después de la boda
  delete from public.bodas b
   where b.fecha is not null and b.fecha + make_interval(months => b.borrar_datos_meses) < current_date;
end $$;
revoke all on function public.purgar_datos from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('purgar-datos-bodas', '30 3 * * *', 'select public.purgar_datos()');
