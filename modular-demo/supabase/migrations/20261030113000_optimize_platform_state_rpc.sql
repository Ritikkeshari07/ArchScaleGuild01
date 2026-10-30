-- Optimized single-roundtrip RPC for fetching platform and app state
create or replace function public.get_platform_state()
returns jsonb
language plpgsql
security definer
set search_path = public, contacts, products, orders, tasks, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_modules jsonb := '[]'::jsonb;
  v_audit jsonb := '[]'::jsonb;
  v_contracts jsonb := '[]'::jsonb;
  v_contacts jsonb := '[]'::jsonb;
  v_products jsonb := '[]'::jsonb;
  v_orders jsonb := '[]'::jsonb;
  v_tasks jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Sign in required' using errcode = '40100';
  end if;

  select organization_id into v_org_id
  from public.app_memberships
  where user_id = v_user_id and is_active = true
  limit 1;

  if v_org_id is null then
    if public.is_platform_admin() then
      select id into v_org_id from public.organizations order by created_at asc limit 1;
    end if;
  end if;

  if v_org_id is null then
    raise exception 'Account has no active app membership' using errcode = '40300';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into v_modules
  from (
    select app_id, status, updated_at
    from public.app_registry
    where organization_id = v_org_id
    order by app_id
  ) r;

  select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) into v_audit
  from (
    select id, action, app_id, details, created_at
    from public.audit_log
    where organization_id = v_org_id
    order by created_at desc
    limit 100
  ) a;

  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_contracts
  from (
    select producer_app, consumer_app, contract_key, version, status, created_at
    from public.integration_contracts
    where status = 'active'
    order by producer_app, consumer_app
  ) c;

  begin
    select coalesce(jsonb_agg(to_jsonb(co)), '[]'::jsonb) into v_contacts
    from (
      select * from contacts.contacts
      where organization_id = v_org_id
      order by created_at asc
    ) co;
  exception when others then
    v_contacts := '[]'::jsonb;
  end;

  begin
    select coalesce(jsonb_agg(to_jsonb(pr)), '[]'::jsonb) into v_products
    from (
      select * from products.products
      where organization_id = v_org_id
      order by created_at asc
    ) pr;
  exception when others then
    v_products := '[]'::jsonb;
  end;

  begin
    select coalesce(jsonb_agg(to_jsonb(od)), '[]'::jsonb) into v_orders
    from (
      select * from orders.orders
      where organization_id = v_org_id
      order by created_at asc
    ) od;
  exception when others then
    v_orders := '[]'::jsonb;
  end;

  begin
    select coalesce(jsonb_agg(to_jsonb(tk)), '[]'::jsonb) into v_tasks
    from (
      select * from tasks.tasks
      where organization_id = v_org_id
      order by created_at asc
    ) tk;
  exception when others then
    v_tasks := '[]'::jsonb;
  end;

  return jsonb_build_object(
    'organizationId', v_org_id,
    'moduleRows', v_modules,
    'auditRows', v_audit,
    'contractRows', v_contracts,
    'contacts', v_contacts,
    'products', v_products,
    'orders', v_orders,
    'tasks', v_tasks
  );
end;
$$;

grant execute on function public.get_platform_state() to authenticated, service_role;

