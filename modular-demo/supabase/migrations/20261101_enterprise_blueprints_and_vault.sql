-- ============================================================================
-- ARCHSCALE ENTERPRISE DISASTER RECOVERY & JIT RESTORATION MIGRATION
-- Migration: 20261101_enterprise_blueprints_and_vault.sql
-- Description:
--   1. Schema Blueprints catalog for instant table re-provisioning
--   2. Permanent Data Snapshots vault with pre-deletion hooks
--   3. Just-In-Time (JIT) access request tickets & time-bound approval tokens
--   4. Atomic restore_app_schema() and restore_data_from_snapshot() procedures
-- ============================================================================

-- 1. Master Schema Blueprints Catalog
create table if not exists public.schema_blueprints (
  app_id text primary key check (app_id in ('contacts', 'products', 'orders', 'tasks')),
  version integer not null default 1,
  schema_name text not null,
  table_name text not null,
  ddl_sql text not null,
  updated_at timestamptz not null default now()
);

alter table public.schema_blueprints enable row level security;
do $$ begin
  drop policy if exists schema_blueprints_read on public.schema_blueprints;
  create policy schema_blueprints_read on public.schema_blueprints
    for select to authenticated using (true);
exception when others then null; end $$;
grant select on public.schema_blueprints to authenticated, service_role;

-- 2. Permanent Data Snapshots Vault
create table if not exists public.data_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  app_id text not null check (app_id in ('contacts', 'products', 'orders', 'tasks')),
  trigger_action text not null, -- 'delete_data', 'remove_schema', 'manual_backup'
  records_count integer not null default 0,
  storage_mode text not null default 'inline_jsonb' check (storage_mode in ('inline_jsonb', 'object_storage')),
  snapshot_payload jsonb,
  storage_path text,
  actor_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_data_snapshots_lookup
  on public.data_snapshots(organization_id, app_id, created_at desc);

alter table public.data_snapshots enable row level security;
do $$ begin
  drop policy if exists data_snapshots_read on public.data_snapshots;
  create policy data_snapshots_read on public.data_snapshots
    for select to authenticated using (public.is_platform_admin() or public.has_org_access(organization_id));
exception when others then null; end $$;
grant select on public.data_snapshots to authenticated, service_role;

-- 3. JIT Access Request System (Hidden until requested, time-bound approval)
create table if not exists public.access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  app_id text not null check (app_id in ('contacts', 'products', 'orders', 'tasks')),
  action_type text not null check (action_type in ('db_restore', 'download_export')),
  reason text not null check (length(trim(reason)) > 0),
  requested_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'consumed', 'rejected', 'expired')),
  auth_token text unique,
  granted_by uuid references auth.users(id),
  expires_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_access_requests_pending
  on public.access_requests(organization_id, status, created_at desc);

alter table public.access_requests enable row level security;
do $$ begin
  drop policy if exists access_requests_read on public.access_requests;
  create policy access_requests_read on public.access_requests
    for select to authenticated using (public.is_platform_admin() or requested_by = auth.uid());
exception when others then null; end $$;
grant select on public.access_requests to authenticated, service_role;

-- 4. Load Canonical Blueprints into Catalog
insert into public.schema_blueprints (app_id, version, schema_name, table_name, ddl_sql, updated_at)
values
(
  'contacts',
  1,
  'contacts',
  'contacts',
  $sql$
    create schema if not exists contacts;
    create table if not exists contacts.contacts (
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
      task_id uuid,
      task_name text not null default '',
      created_at timestamptz not null default now()
    );
    alter table contacts.contacts enable row level security;
    do $$ begin
      drop policy if exists contacts_read on contacts.contacts;
      create policy contacts_read on contacts.contacts for select to authenticated using (public.has_org_access(organization_id));
      drop policy if exists contacts_write on contacts.contacts;
      create policy contacts_write on contacts.contacts for all to authenticated using (public.has_app_write_access(organization_id, 'contacts')) with check (public.has_app_write_access(organization_id, 'contacts'));
    exception when others then null; end $$;
    grant all on schema contacts to authenticated, service_role;
    grant all on all tables in schema contacts to authenticated, service_role;
  $sql$,
  now()
),
(
  'products',
  1,
  'products',
  'products',
  $sql$
    create schema if not exists products;
    create table if not exists products.products (
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
      task_id uuid,
      task_name text not null default '',
      created_at timestamptz not null default now(),
      unique (organization_id, sku)
    );
    alter table products.products enable row level security;
    do $$ begin
      drop policy if exists products_read on products.products;
      create policy products_read on products.products for select to authenticated using (public.has_org_access(organization_id));
      drop policy if exists products_write on products.products;
      create policy products_write on products.products for all to authenticated using (public.has_app_write_access(organization_id, 'products')) with check (public.has_app_write_access(organization_id, 'products'));
    exception when others then null; end $$;
    grant all on schema products to authenticated, service_role;
    grant all on all tables in schema products to authenticated, service_role;
  $sql$,
  now()
),
(
  'orders',
  1,
  'orders',
  'orders',
  $sql$
    create schema if not exists orders;
    create table if not exists orders.orders (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      order_no text not null,
      customer_id uuid,
      customer_name text not null default '',
      product_id uuid,
      product_name text not null default '',
      unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
      quantity integer not null default 1 check (quantity > 0),
      total numeric(12,2) generated always as (round(unit_price * quantity, 2)) stored,
      status text not null default 'Draft',
      task_id uuid,
      task_name text not null default '',
      created_at timestamptz not null default now(),
      unique (organization_id, order_no)
    );
    alter table orders.orders enable row level security;
    do $$ begin
      drop policy if exists orders_read on orders.orders;
      create policy orders_read on orders.orders for select to authenticated using (public.has_org_access(organization_id));
      drop policy if exists orders_write on orders.orders;
      create policy orders_write on orders.orders for all to authenticated using (public.has_app_write_access(organization_id, 'orders')) with check (public.has_app_write_access(organization_id, 'orders'));
    exception when others then null; end $$;
    grant all on schema orders to authenticated, service_role;
    grant all on all tables in schema orders to authenticated, service_role;
  $sql$,
  now()
),
(
  'tasks',
  1,
  'tasks',
  'tasks',
  $sql$
    create schema if not exists tasks;
    create table if not exists tasks.tasks (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      name text not null check (length(trim(name)) > 0),
      assigned_to text not null default '',
      order_id uuid,
      order_ref text not null default '',
      contact_id uuid,
      contact_name text not null default '',
      product_id uuid,
      product_name text not null default '',
      due_date date,
      status text not null default 'Open',
      created_at timestamptz not null default now()
    );
    alter table tasks.tasks enable row level security;
    do $$ begin
      drop policy if exists tasks_read on tasks.tasks;
      create policy tasks_read on tasks.tasks for select to authenticated using (public.has_org_access(organization_id));
      drop policy if exists tasks_write on tasks.tasks;
      create policy tasks_write on tasks.tasks for all to authenticated using (public.has_app_write_access(organization_id, 'tasks')) with check (public.has_app_write_access(organization_id, 'tasks'));
    exception when others then null; end $$;
    grant all on schema tasks to authenticated, service_role;
    grant all on all tables in schema tasks to authenticated, service_role;
  $sql$,
  now()
)
on conflict (app_id) do update set
  ddl_sql = excluded.ddl_sql,
  updated_at = now();

-- 5. Updated Lifecycle Handler with Pre-Deletion Snapshot Hook
create or replace function public.manage_app_lifecycle(target_org uuid, target_app text, requested_action text)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  current_status text;
  snapshot_data jsonb;
  record_count integer := 0;
begin
  if not public.is_platform_admin() then raise exception 'Super admin access required'; end if;
  if target_app not in ('contacts', 'products', 'orders', 'tasks') then raise exception 'Unknown app'; end if;
  if requested_action not in ('activate', 'deactivate', 'retire', 'delete_data', 'remove_schema') then raise exception 'Unsupported action'; end if;

  select status into current_status from public.app_registry
    where organization_id = target_org and app_id = target_app;

  -- PRE-DELETION BACKUP HOOK (Runs automatically before delete_data or remove_schema)
  if requested_action in ('delete_data', 'remove_schema') then
    if target_app = 'contacts' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb), count(*) into snapshot_data, record_count
      from contacts.contacts t where t.organization_id = target_org;
    elsif target_app = 'products' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb), count(*) into snapshot_data, record_count
      from products.products t where t.organization_id = target_org;
    elsif target_app = 'orders' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb), count(*) into snapshot_data, record_count
      from orders.orders t where t.organization_id = target_org;
    elsif target_app = 'tasks' then
      select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb), count(*) into snapshot_data, record_count
      from tasks.tasks t where t.organization_id = target_org;
    end if;

    if record_count > 0 then
      insert into public.data_snapshots (
        organization_id, app_id, trigger_action, records_count, storage_mode, snapshot_payload, actor_id
      ) values (
        target_org, target_app, requested_action, record_count, 'inline_jsonb', snapshot_data, auth.uid()
      );
    end if;
  end if;

  -- REMOVE SCHEMA HANDLER
  if requested_action = 'remove_schema' then
    insert into public.audit_log(organization_id, actor_id, action, app_id, details)
      select o.id, auth.uid(), 'remove_schema', target_app,
        jsonb_build_object('source','manage_app_lifecycle','schema',target_app,'vault_backup_records',record_count)
      from public.organizations o;
    delete from public.integration_contracts where producer_app = target_app or consumer_app = target_app;
    delete from public.app_memberships where app_id = target_app;
    update public.app_registry set status='removed', updated_at=now() where app_id=target_app;
    execute format('drop schema if exists %I cascade', target_app);
    execute format('create schema if not exists %I', target_app);
    return 'removed';
  end if;

  -- DELETE DATA HANDLER
  if requested_action = 'delete_data' then
    if target_app = 'contacts' then delete from contacts.contacts where organization_id = target_org; end if;
    if target_app = 'products' then delete from products.products where organization_id = target_org; end if;
    if target_app = 'orders' then delete from orders.orders where organization_id = target_org; end if;
    if target_app = 'tasks' then delete from tasks.tasks where organization_id = target_org; end if;
  end if;

  insert into public.app_registry(organization_id, app_id, status, updated_at)
  values (target_org, target_app,
    case requested_action when 'activate' then 'active' when 'deactivate' then 'inactive'
      when 'retire' then 'retired' else 'deleted' end, now())
  on conflict (organization_id, app_id) do update set
    status = excluded.status, updated_at = excluded.updated_at;

  insert into public.audit_log(organization_id, actor_id, action, app_id, details)
  values (target_org, auth.uid(), requested_action, target_app,
    jsonb_build_object('source', 'manage_app_lifecycle', 'vault_backup_records', record_count));

  return requested_action;
end;
$$;

-- 6. Atomic Schema Re-Provisioning from Master Blueprint
create or replace function public.restore_app_schema(target_org uuid, target_app text)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  blueprint_sql text;
begin
  if not public.is_platform_admin() then raise exception 'Super admin access required'; end if;
  if target_app not in ('contacts', 'products', 'orders', 'tasks') then raise exception 'Unknown app'; end if;

  select ddl_sql into blueprint_sql
  from public.schema_blueprints
  where app_id = target_app;

  if blueprint_sql is null then
    raise exception 'No registered blueprint found for %', target_app;
  end if;

  -- Execute DDL from blueprint
  execute blueprint_sql;

  -- Re-register integration contracts
  insert into public.integration_contracts(producer_app, consumer_app, contract_key, version)
  select producer.app_id, consumer.app_id, 'record-link-with-display-snapshot', 1
  from (values ('contacts'),('products'),('orders'),('tasks')) as producer(app_id)
  cross join (values ('contacts'),('products'),('orders'),('tasks')) as consumer(app_id)
  where (producer.app_id = target_app or consumer.app_id = target_app)
    and producer.app_id <> consumer.app_id
  on conflict do nothing;

  -- Re-activate in registry
  insert into public.app_registry(organization_id, app_id, status, updated_at)
  values (target_org, target_app, 'active', now())
  on conflict (organization_id, app_id) do update set
    status = 'active', updated_at = now();

  insert into public.audit_log(organization_id, actor_id, action, app_id, details)
  values (target_org, auth.uid(), 'restore_app_schema', target_app,
    jsonb_build_object('source', 'restore_app_schema', 'status', 'active'));

  return 'active';
end;
$$;
grant execute on function public.restore_app_schema(uuid, text) to authenticated;

-- 7. Developer JIT Request & Approval Functions
create or replace function public.request_data_access(target_org uuid, target_app text, target_action text, request_reason text)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  request_id uuid;
begin
  if target_app not in ('contacts', 'products', 'orders', 'tasks') then raise exception 'Unknown app'; end if;
  if target_action not in ('db_restore', 'download_export') then raise exception 'Invalid action type'; end if;
  if length(trim(request_reason)) < 5 then raise exception 'Reason must be at least 5 characters'; end if;

  insert into public.access_requests (organization_id, app_id, action_type, reason, requested_by, status)
  values (target_org, target_app, target_action, trim(request_reason), auth.uid(), 'pending')
  returning id into request_id;

  return request_id;
end;
$$;
grant execute on function public.request_data_access(uuid, text, text, text) to authenticated;

create or replace function public.grant_data_access(target_request uuid, duration_minutes integer default 60)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  generated_token text;
begin
  if not public.is_platform_admin() then raise exception 'Super admin access required'; end if;

  generated_token := 'JIT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 24));

  update public.access_requests
  set status = 'approved',
      auth_token = generated_token,
      granted_by = auth.uid(),
      expires_at = now() + (coalesce(duration_minutes, 60) || ' minutes')::interval,
      updated_at = now()
  where id = target_request and status = 'pending';

  if not found then
    raise exception 'Request not found or not in pending status';
  end if;

  return generated_token;
end;
$$;
grant execute on function public.grant_data_access(uuid, integer) to authenticated;

-- 8. Data Restoration from Snapshot using JIT Token
create or replace function public.restore_data_from_snapshot(target_token text, target_snapshot uuid)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  req record;
  snap record;
  restored_count integer := 0;
begin
  -- Validate single-use time-bound JIT token
  select * into req from public.access_requests
  where auth_token = target_token
    and status = 'approved'
    and expires_at > now();

  if not found then
    raise exception 'Invalid, expired, or previously consumed token';
  end if;

  -- Fetch snapshot from vault
  select * into snap from public.data_snapshots
  where id = target_snapshot and organization_id = req.organization_id and app_id = req.app_id;

  if not found then
    raise exception 'Target snapshot not found in vault';
  end if;

  -- Restore records into app schema
  if snap.app_id = 'contacts' then
    insert into contacts.contacts (id, organization_id, name, organization, email, phone, city, product_id, product_name, order_id, order_ref, task_id, task_name, created_at)
    select (x->>'id')::uuid, (x->>'organization_id')::uuid, x->>'name', coalesce(x->>'organization',''), coalesce(x->>'email',''), coalesce(x->>'phone',''), coalesce(x->>'city',''), (x->>'product_id')::uuid, coalesce(x->>'product_name',''), (x->>'order_id')::uuid, coalesce(x->>'order_ref',''), (x->>'task_id')::uuid, coalesce(x->>'task_name',''), (x->>'created_at')::timestamptz
    from jsonb_array_elements(snap.snapshot_payload) as x
    on conflict (id) do nothing;
  elsif snap.app_id = 'products' then
    insert into products.products (id, organization_id, name, sku, category, unit, price, contact_id, contact_name, order_id, order_ref, task_id, task_name, created_at)
    select (x->>'id')::uuid, (x->>'organization_id')::uuid, x->>'name', x->>'sku', coalesce(x->>'category',''), coalesce(x->>'unit','each'), (x->>'price')::numeric, (x->>'contact_id')::uuid, coalesce(x->>'contact_name',''), (x->>'order_id')::uuid, coalesce(x->>'order_ref',''), (x->>'task_id')::uuid, coalesce(x->>'task_name',''), (x->>'created_at')::timestamptz
    from jsonb_array_elements(snap.snapshot_payload) as x
    on conflict (id) do nothing;
  elsif snap.app_id = 'orders' then
    insert into orders.orders (id, organization_id, order_no, customer_id, customer_name, product_id, product_name, unit_price, quantity, status, task_id, task_name, created_at)
    select (x->>'id')::uuid, (x->>'organization_id')::uuid, x->>'order_no', (x->>'customer_id')::uuid, coalesce(x->>'customer_name',''), (x->>'product_id')::uuid, coalesce(x->>'product_name',''), (x->>'unit_price')::numeric, (x->>'quantity')::integer, coalesce(x->>'status','Draft'), (x->>'task_id')::uuid, coalesce(x->>'task_name',''), (x->>'created_at')::timestamptz
    from jsonb_array_elements(snap.snapshot_payload) as x
    on conflict (id) do nothing;
  elsif snap.app_id = 'tasks' then
    insert into tasks.tasks (id, organization_id, name, assigned_to, order_id, order_ref, contact_id, contact_name, product_id, product_name, due_date, status, created_at)
    select (x->>'id')::uuid, (x->>'organization_id')::uuid, x->>'name', coalesce(x->>'assigned_to',''), (x->>'order_id')::uuid, coalesce(x->>'order_ref',''), (x->>'contact_id')::uuid, coalesce(x->>'contact_name',''), (x->>'product_id')::uuid, coalesce(x->>'product_name',''), (x->>'due_date')::date, coalesce(x->>'status','Open'), (x->>'created_at')::timestamptz
    from jsonb_array_elements(snap.snapshot_payload) as x
    on conflict (id) do nothing;
  end if;

  -- Burn single-use token
  update public.access_requests
  set status = 'consumed', consumed_at = now(), updated_at = now()
  where id = req.id;

  -- Ensure app is active in registry
  update public.app_registry
  set status = 'active', updated_at = now()
  where organization_id = req.organization_id and app_id = req.app_id;

  return jsonb_build_object(
    'ok', true,
    'restored_app', snap.app_id,
    'records_restored', snap.records_count,
    'snapshot_id', snap.id
  );
end;
$$;
grant execute on function public.restore_data_from_snapshot(text, uuid) to authenticated;
