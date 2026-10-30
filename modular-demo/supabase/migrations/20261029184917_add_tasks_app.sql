-- Add Tasks as a fourth independently managed workspace without changing
-- existing Contacts, Products, Orders, Auth users, or their records.
alter table public.app_memberships drop constraint if exists app_memberships_app_id_check;
alter table public.app_memberships add constraint app_memberships_app_id_check
  check (app_id in ('contacts', 'products', 'orders', 'tasks'));
alter table public.app_registry drop constraint if exists app_registry_app_id_check;
alter table public.app_registry add constraint app_registry_app_id_check
  check (app_id in ('contacts', 'products', 'orders', 'tasks'));
alter table public.contacts add column task_id uuid, add column task_name text not null default '';
alter table public.products add column task_id uuid, add column task_name text not null default '';
alter table public.orders add column task_id uuid, add column task_name text not null default '';

create table public.tasks (
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

create index tasks_org_created_idx on public.tasks(organization_id, created_at);
create index tasks_order_idx on public.tasks(order_id);
create index tasks_contact_idx on public.tasks(contact_id);
create index tasks_product_idx on public.tasks(product_id);
create index contacts_task_idx on public.contacts(task_id);
create index products_task_idx on public.products(task_id);
create index orders_task_idx on public.orders(task_id);

alter table public.tasks enable row level security;
create policy tasks_read on public.tasks for select to authenticated using (public.has_org_access(organization_id));
create policy tasks_insert on public.tasks for insert to authenticated with check (public.has_app_write_access(organization_id, 'tasks'));
create policy tasks_update on public.tasks for update to authenticated using (public.has_app_write_access(organization_id, 'tasks')) with check (public.has_app_write_access(organization_id, 'tasks'));
create policy tasks_delete on public.tasks for delete to authenticated using (public.has_app_write_access(organization_id, 'tasks'));
grant select, insert, update, delete on public.tasks to authenticated;

create trigger tasks_audit after insert or update or delete on public.tasks
  for each row execute function public.audit_app_record_change();

create or replace function public.manage_app_lifecycle(target_org uuid, target_app text, requested_action text)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then raise exception 'Super admin access required'; end if;
  if target_app not in ('contacts', 'products', 'orders', 'tasks') then raise exception 'Unknown app'; end if;
  if requested_action not in ('activate', 'deactivate', 'retire', 'delete_data') then raise exception 'Unsupported action'; end if;
  if requested_action = 'delete_data' then
    if target_app = 'contacts' then delete from public.contacts where organization_id = target_org; end if;
    if target_app = 'products' then delete from public.products where organization_id = target_org; end if;
    if target_app = 'orders' then delete from public.orders where organization_id = target_org; end if;
    if target_app = 'tasks' then delete from public.tasks where organization_id = target_org; end if;
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

insert into public.app_registry(organization_id, app_id, status)
values ('a0000000-0000-4000-8000-000000000001', 'tasks', 'active')
on conflict (organization_id, app_id) do nothing;

insert into public.app_memberships(organization_id, user_id, app_id, role, is_active)
select organization_id, user_id, 'tasks', 'admin', true
from public.app_memberships
where organization_id = 'a0000000-0000-4000-8000-000000000001'
  and app_id = 'orders' and role = 'admin' and is_active
on conflict (organization_id, user_id, app_id) do update set role='admin', is_active=true;

insert into public.tasks
  (id, organization_id, name, assigned_to, order_id, order_ref, contact_id, contact_name,
   product_id, product_name, status)
values
  ('e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Confirm delivery', 'Operations', 'd0000000-0000-4000-8000-000000000001', 'ORD-001',
   'c0000000-0000-4000-8000-000000000001', 'ABC Studio',
   'b0000000-0000-4000-8000-000000000001', 'Marble Sample', 'Open')
on conflict (id) do nothing;

update public.contacts set task_id='e0000000-0000-4000-8000-000000000001', task_name='Confirm delivery'
where id='c0000000-0000-4000-8000-000000000001' and task_id is null;
update public.products set task_id='e0000000-0000-4000-8000-000000000001', task_name='Confirm delivery'
where id='b0000000-0000-4000-8000-000000000001' and task_id is null;
update public.orders set task_id='e0000000-0000-4000-8000-000000000001', task_name='Confirm delivery'
where id='d0000000-0000-4000-8000-000000000001' and task_id is null;
