-- Run in local Supabase Studio AFTER creating an account from the app login.
-- Replace the email below. This bootstraps a local pilot super admin only.
with pilot_user as (
  select id from auth.users where lower(email) = lower('replace-with-your-email@example.com')
), pilot_org as (
  select id from public.organizations where id = 'a0000000-0000-4000-8000-000000000001'
)
insert into public.app_memberships(organization_id, user_id, app_id, role, is_active)
select pilot_org.id, pilot_user.id, apps.app_id, 'admin', true
from pilot_user cross join pilot_org
cross join (values ('contacts'), ('products'), ('orders'), ('tasks')) as apps(app_id)
on conflict (organization_id, user_id, app_id) do update
set role = 'admin', is_active = true;

insert into public.platform_admins(user_id)
select id from auth.users
where lower(email) = lower('replace-with-your-email@example.com')
on conflict (user_id) do nothing;
