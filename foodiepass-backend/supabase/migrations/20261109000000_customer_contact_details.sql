-- Customers give their name, phone and mailing address when they join.
-- The website sends them as sign-up details (user metadata); this copies them into profiles.

alter table public.profiles
  add column phone         text check (length(phone) <= 40),
  add column address_line1 text check (length(address_line1) <= 200),
  add column address_line2 text check (length(address_line2) <= 200),
  add column city          text check (length(city) <= 120),
  add column state         text check (length(state) <= 40),
  add column zip           text check (length(zip) <= 20);

-- Same as before for names and email. The new fields only change when the sign-up details include them,
-- so an app that updates other details never erases a saved address or phone.
create or replace function private.sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare md jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, full_name, first_name, last_name, contact_email,
                               phone, address_line1, address_line2, city, state, zip)
  values (
    new.id,
    coalesce(nullif(md->>'full_name', ''), nullif(concat_ws(' ', md->>'first_name', md->>'last_name'), '')),
    nullif(md->>'first_name', ''),
    nullif(md->>'last_name', ''),
    coalesce(new.email, nullif(md->>'contact_email', '')),
    left(coalesce(nullif(btrim(md->>'phone'), ''), nullif(new.phone, '')), 40),
    left(nullif(btrim(md->>'address_line1'), ''), 200),
    left(nullif(btrim(md->>'address_line2'), ''), 200),
    left(nullif(btrim(md->>'city'), ''), 120),
    left(nullif(upper(btrim(md->>'state')), ''), 40),
    left(nullif(btrim(md->>'zip'), ''), 20)
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    contact_email = excluded.contact_email,
    phone = coalesce(excluded.phone, profiles.phone),
    address_line1 = coalesce(excluded.address_line1, profiles.address_line1),
    address_line2 = case when excluded.address_line1 is not null then excluded.address_line2 else profiles.address_line2 end,
    city = coalesce(excluded.city, profiles.city),
    state = coalesce(excluded.state, profiles.state),
    zip = coalesce(excluded.zip, profiles.zip),
    updated_at = now();
  return new;
end $$;
revoke all on function private.sync_profile() from public;

-- Fill in anyone who already gave these details at sign-up.
update public.profiles p set
  phone = left(coalesce(nullif(btrim(u.raw_user_meta_data->>'phone'), ''), nullif(u.phone, '')), 40),
  address_line1 = left(nullif(btrim(u.raw_user_meta_data->>'address_line1'), ''), 200),
  address_line2 = left(nullif(btrim(u.raw_user_meta_data->>'address_line2'), ''), 200),
  city = left(nullif(btrim(u.raw_user_meta_data->>'city'), ''), 120),
  state = left(nullif(upper(btrim(u.raw_user_meta_data->>'state')), ''), 40),
  zip = left(nullif(btrim(u.raw_user_meta_data->>'zip'), ''), 20)
from auth.users u
where u.id = p.id;

-- The admin customer list gains the new details. Its columns change, so it is dropped and recreated.
drop function public.admin_customers();
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
  marketing     boolean,
  first_name    text,
  last_name     text,
  phone         text,
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  zip           text
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
    coalesce((select c.granted from public.consents c where c.user_id = u.id and c.kind = 'marketing' order by c.recorded_at desc, c.id desc limit 1), false),
    p.first_name, p.last_name, p.phone, p.address_line1, p.address_line2, p.city, p.state, p.zip
  from auth.users u
  left join public.profiles p on p.id = u.id
  where private.is_admin()
  order by u.created_at desc;
$$;

revoke all on function public.admin_customers() from public, anon;
grant execute on function public.admin_customers() to authenticated;
