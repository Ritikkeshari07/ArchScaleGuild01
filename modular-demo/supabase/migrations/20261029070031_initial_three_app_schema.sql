-- Initial Supabase schema for the Contacts, Products, and Orders pilot.
-- Cross-app IDs intentionally have no cascading foreign keys; snapshots remain
-- readable when a source app's records are removed.

create extension if not exists pgcrypto with schema extensions;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.app_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  app_id text not null check (app_id in ('contacts', 'products', 'orders')),
  role text not null default 'member' check (role in ('admin', 'member')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id, app_id)
);

create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.app_registry (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  app_id text not null check (app_id in ('contacts', 'products', 'orders')),
  status text not null default 'active' check (status in ('active', 'inactive', 'retired', 'deleted')),
  updated_at timestamptz not null default now(),
  primary key (organization_id, app_id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  organization text not null default '',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  product_id uuid,
  product_name text not null default '',
  order_id uuid,
  order_ref text not null default '',
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  sku text not null,
  category text not null default '',
  unit text not null default 'each',
  price numeric(12,2) not null default 0 check (price >= 0),
  contact_id uuid,
  contact_name text not null default '',
  order_id uuid,
  order_ref text not null default '',
  created_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_no text not null,
  customer_id uuid,
  customer_name text not null default '',
  product_id uuid,
  product_name text not null default '',
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  total numeric(14,2) generated always as (unit_price * quantity) stored,
  status text not null default 'Draft',
  created_at timestamptz not null default now(),
  unique (organization_id, order_no)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  app_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index app_memberships_user_app_idx on public.app_memberships(user_id, app_id) where is_active;
create index contacts_org_created_idx on public.contacts(organization_id, created_at);
create index products_org_created_idx on public.products(organization_id, created_at);
create index orders_org_created_idx on public.orders(organization_id, created_at);
create index contacts_product_idx on public.contacts(product_id);
create index contacts_order_idx on public.contacts(order_id);
create index products_contact_idx on public.products(contact_id);
create index products_order_idx on public.products(order_id);
create index orders_contact_idx on public.orders(customer_id);
create index orders_product_idx on public.orders(product_id);

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$ select exists (select 1 from public.platform_admins where user_id = auth.uid()); $$;

create or replace function public.has_org_access(target_org uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.app_memberships m
    where m.organization_id = target_org and m.user_id = auth.uid() and m.is_active
  );
$$;

create or replace function public.has_app_access(target_org uuid, target_app text)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin() or (
    exists (
      select 1 from public.app_memberships m
      where m.organization_id = target_org and m.user_id = auth.uid()
        and m.app_id = target_app and m.is_active
    ) and coalesce((
      select r.status = 'active' from public.app_registry r
      where r.organization_id = target_org and r.app_id = target_app
    ), true)
  );
$$;

create or replace function public.has_app_write_access(target_org uuid, target_app text)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin() or exists (
    select 1 from public.app_memberships m
    where m.organization_id = target_org and m.user_id = auth.uid()
      and m.app_id = target_app and m.is_active and m.role = 'admin'
      and coalesce((select r.status = 'active' from public.app_registry r
        where r.organization_id = target_org and r.app_id = target_app), true)
  );
$$;

create or replace function public.manage_app_lifecycle(target_org uuid, target_app text, requested_action text)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then raise exception 'Super admin access required'; end if;
  if target_app not in ('contacts', 'products', 'orders') then raise exception 'Unknown app'; end if;
  if requested_action not in ('activate', 'deactivate', 'retire', 'delete_data') then raise exception 'Unsupported action'; end if;
  if requested_action = 'delete_data' then
    if target_app = 'contacts' then delete from public.contacts where organization_id = target_org; end if;
    if target_app = 'products' then delete from public.products where organization_id = target_org; end if;
    if target_app = 'orders' then delete from public.orders where organization_id = target_org; end if;
  end if;
  insert into public.app_registry(organization_id, app_id, status, updated_at)
  values (target_org, target_app,
    case requested_action when 'activate' then 'active' when 'deactivate' then 'inactive'
      when 'retire' then 'retired' else 'deleted' end, now())
  on conflict (organization_id, app_id) do update set
    status = excluded.status, updated_at = excluded.updated_at;
  insert into public.audit_log(organization_id, actor_id, action, app_id, details)
  values (target_org, auth.uid(), requested_action, target_app, jsonb_build_object('source', 'manage_app_lifecycle'));
  return requested_action;
end;
$$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.has_org_access(uuid) from public, anon;
revoke all on function public.has_app_access(uuid, text) from public, anon;
revoke all on function public.has_app_write_access(uuid, text) from public, anon;
revoke all on function public.manage_app_lifecycle(uuid, text, text) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.has_org_access(uuid) to authenticated;
grant execute on function public.has_app_access(uuid, text) to authenticated;
grant execute on function public.has_app_write_access(uuid, text) to authenticated;
grant execute on function public.manage_app_lifecycle(uuid, text, text) to authenticated;

alter table public.organizations enable row level security;
alter table public.app_memberships enable row level security;
alter table public.platform_admins enable row level security;
alter table public.app_registry enable row level security;
alter table public.contacts enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.audit_log enable row level security;

create policy organizations_read on public.organizations for select to authenticated using (public.has_org_access(id));
create policy memberships_read on public.app_memberships for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
create policy platform_admins_read_self on public.platform_admins for select to authenticated using (user_id = auth.uid());
create policy app_registry_read on public.app_registry for select to authenticated using (public.has_org_access(organization_id));
create policy contacts_read on public.contacts for select to authenticated using (public.has_org_access(organization_id));
create policy contacts_insert on public.contacts for insert to authenticated with check (public.has_app_write_access(organization_id, 'contacts'));
create policy contacts_update on public.contacts for update to authenticated using (public.has_app_write_access(organization_id, 'contacts')) with check (public.has_app_write_access(organization_id, 'contacts'));
create policy contacts_delete on public.contacts for delete to authenticated using (public.has_app_write_access(organization_id, 'contacts'));
create policy products_read on public.products for select to authenticated using (public.has_org_access(organization_id));
create policy products_insert on public.products for insert to authenticated with check (public.has_app_write_access(organization_id, 'products'));
create policy products_update on public.products for update to authenticated using (public.has_app_write_access(organization_id, 'products')) with check (public.has_app_write_access(organization_id, 'products'));
create policy products_delete on public.products for delete to authenticated using (public.has_app_write_access(organization_id, 'products'));
create policy orders_read on public.orders for select to authenticated using (public.has_org_access(organization_id));
create policy orders_insert on public.orders for insert to authenticated with check (public.has_app_write_access(organization_id, 'orders'));
create policy orders_update on public.orders for update to authenticated using (public.has_app_write_access(organization_id, 'orders')) with check (public.has_app_write_access(organization_id, 'orders'));
create policy orders_delete on public.orders for delete to authenticated using (public.has_app_write_access(organization_id, 'orders'));
create policy audit_read_super_admin on public.audit_log for select to authenticated using (public.is_platform_admin());

create or replace function public.audit_app_record_change()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  changed_row jsonb;
begin
  changed_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  insert into public.audit_log(organization_id, actor_id, action, app_id, details)
  values ((changed_row->>'organization_id')::uuid, auth.uid(), tg_op, tg_table_name,
    jsonb_build_object('record_id', changed_row->>'id'));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.audit_app_record_change() from public, anon, authenticated;
create trigger contacts_audit after insert or update or delete on public.contacts
  for each row execute function public.audit_app_record_change();
create trigger products_audit after insert or update or delete on public.products
  for each row execute function public.audit_app_record_change();
create trigger orders_audit after insert or update or delete on public.orders
  for each row execute function public.audit_app_record_change();

grant select on public.organizations, public.app_memberships, public.platform_admins, public.app_registry,
  public.contacts, public.products, public.orders, public.audit_log to authenticated;
grant insert, update, delete on public.contacts, public.products, public.orders to authenticated;
grant usage, select on sequence public.audit_log_id_seq to authenticated;

-- A registered organization begins with all three pilot workspaces active.
insert into public.organizations(id, name)
values ('a0000000-0000-4000-8000-000000000001', 'ArchScale Pilot')
on conflict (id) do nothing;
insert into public.app_registry(organization_id, app_id, status)
values
  ('a0000000-0000-4000-8000-000000000001', 'contacts', 'active'),
  ('a0000000-0000-4000-8000-000000000001', 'products', 'active'),
  ('a0000000-0000-4000-8000-000000000001', 'orders', 'active')
on conflict (organization_id, app_id) do nothing;
