-- Keep identity, tenancy, authorization, module registry, audit, and integration
-- contracts in the permanent platform schema; each app owns one removable schema.
create schema if not exists contacts;
create schema if not exists products;
create schema if not exists orders;
create schema if not exists tasks;

alter table public.contacts set schema contacts;
alter table public.products set schema products;
alter table public.orders set schema orders;
alter table public.tasks set schema tasks;

grant usage on schema contacts, products, orders, tasks to authenticated, service_role;

create table public.integration_contracts (
  producer_app text not null check (producer_app in ('contacts','products','orders','tasks')),
  consumer_app text not null check (consumer_app in ('contacts','products','orders','tasks')),
  contract_key text not null,
  version integer not null check (version > 0),
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  primary key (producer_app, consumer_app, contract_key, version),
  check (producer_app <> consumer_app)
);
alter table public.integration_contracts enable row level security;
create policy integration_contracts_read on public.integration_contracts
  for select to authenticated using (true);
grant select on public.integration_contracts to authenticated;

insert into public.integration_contracts(producer_app, consumer_app, contract_key, version)
select producer.app_id, consumer.app_id, 'record-link-with-display-snapshot', 1
from (values ('contacts'),('products'),('orders'),('tasks')) as producer(app_id)
cross join (values ('contacts'),('products'),('orders'),('tasks')) as consumer(app_id)
where producer.app_id <> consumer.app_id
on conflict do nothing;

alter table public.app_registry drop constraint if exists app_registry_status_check;
alter table public.app_registry add constraint app_registry_status_check
  check (status in ('active','inactive','retired','deleted','removed'));

create or replace function public.manage_app_lifecycle(target_org uuid, target_app text, requested_action text)
returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  current_status text;
begin
  if not public.is_platform_admin() then raise exception 'Super admin access required'; end if;
  if target_app not in ('contacts', 'products', 'orders', 'tasks') then raise exception 'Unknown app'; end if;
  if requested_action not in ('activate', 'deactivate', 'retire', 'delete_data', 'remove_schema') then raise exception 'Unsupported action'; end if;
  select status into current_status from public.app_registry
    where organization_id = target_org and app_id = target_app;
  if current_status = 'removed' then raise exception 'App schema has already been removed'; end if;

  if requested_action = 'remove_schema' then
    insert into public.audit_log(organization_id, actor_id, action, app_id, details)
      select o.id, auth.uid(), 'remove_schema', target_app,
        jsonb_build_object('source','manage_app_lifecycle','schema',target_app)
      from public.organizations o;
    delete from public.integration_contracts
      where producer_app = target_app or consumer_app = target_app;
    delete from public.app_memberships where app_id = target_app;
    update public.app_registry set status='removed', updated_at=now() where app_id=target_app;
    execute format('drop schema if exists %I cascade', target_app);
    execute format('create schema if not exists %I', target_app);
    return 'removed';
  end if;

  if requested_action = 'activate' and current_status = 'removed' then
    raise exception 'Removed app schemas must be redeployed before activation';
  end if;
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
  values (target_org, auth.uid(), requested_action, target_app, jsonb_build_object('source', 'manage_app_lifecycle'));
  return requested_action;
end;
$$;
