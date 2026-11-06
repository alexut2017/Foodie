-- Customer list for the admin console. Each account can still read only its own billing rows;
-- this function returns everyone's summary, and only when the caller is an admin.
create function public.admin_customers()
returns table (
  id            uuid,
  full_name     text,
  email         text,
  joined_at     timestamptz,
  is_admin      boolean,
  access_until  timestamptz,
  grace_until   timestamptz,
  sources       text[],
  marketing     boolean
)
language sql stable security definer set search_path = '' as $$
  select
    u.id,
    p.full_name,
    coalesce(p.contact_email, u.email)::text,
    u.created_at,
    exists (select 1 from public.platform_admins a where a.user_id = u.id),
    (select max(e.access_expires_at) from public.entitlements e where e.user_id = u.id and e.feature = 'membership'),
    (select max(e.grace_expires_at)  from public.entitlements e where e.user_id = u.id and e.feature = 'membership'),
    coalesce((select array_agg(distinct split_part(e.source, ':', 1)) from public.entitlements e where e.user_id = u.id and e.feature = 'membership'), '{}'),
    coalesce((select c.granted from public.consents c where c.user_id = u.id and c.kind = 'marketing' order by c.recorded_at desc, c.id desc limit 1), false)
  from auth.users u
  left join public.profiles p on p.id = u.id
  where private.is_admin()
  order by u.created_at desc;
$$;

revoke all on function public.admin_customers() from public, anon;
grant execute on function public.admin_customers() to authenticated;
