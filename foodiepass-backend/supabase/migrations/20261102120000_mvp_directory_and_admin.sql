-- FoodiePass MVP: restaurant directory run by an admin, partner applications, customer profiles.
-- Restaurants have no logins and visits are not tracked, so the old redemptions table goes away.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------- Admins (added by hand in Supabase) ----------
create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Customers: one profile per account, copied from the sign-up details ----------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  full_name      text,
  first_name     text,
  last_name      text,
  contact_email  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create function private.sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare md jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, full_name, first_name, last_name, contact_email)
  values (
    new.id,
    coalesce(nullif(md->>'full_name', ''), nullif(concat_ws(' ', md->>'first_name', md->>'last_name'), '')),
    nullif(md->>'first_name', ''),
    nullif(md->>'last_name', ''),
    coalesce(new.email, nullif(md->>'contact_email', ''))
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    contact_email = excluded.contact_email,
    updated_at = now();
  return new;
end $$;
revoke all on function private.sync_profile() from public;

create trigger on_auth_user_profile_sync
  after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function private.sync_profile();

insert into public.profiles (id, full_name, first_name, last_name, contact_email)
select u.id,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name'), '')),
  nullif(u.raw_user_meta_data->>'first_name', ''),
  nullif(u.raw_user_meta_data->>'last_name', ''),
  coalesce(u.email, nullif(u.raw_user_meta_data->>'contact_email', ''))
from auth.users u;

-- ---------- Directory ----------
create table public.districts (
  id          text primary key,
  name        text not null,
  lat         double precision not null,
  lng         double precision not null,
  live        boolean not null default false,
  sort_order  integer not null default 0
);

insert into public.districts (id, name, lat, lng, live, sort_order) values
  ('rice', 'Rice Village / West U', 29.7174, -95.4153, true, 1),
  ('montrose', 'Montrose', 29.7454, -95.3909, true, 2),
  ('heights', 'The Heights', 29.7980, -95.3980, true, 3),
  ('downtown', 'Midtown · Downtown · EaDo', 29.7520, -95.3650, true, 4),
  ('tmc', 'Medical Center / Museum District', 29.7140, -95.3960, true, 5),
  ('bellaire', 'Bellaire Blvd / Chinatown', 29.7058, -95.5450, true, 6),
  ('galleria', 'Galleria / Uptown', 29.7400, -95.4630, false, 7),
  ('memorial', 'Memorial / Washington Ave', 29.7700, -95.4050, false, 8),
  ('sugarland', 'Sugar Land', 29.6197, -95.6349, false, 9),
  ('katy', 'Katy', 29.7858, -95.8245, false, 10),
  ('woodlands', 'The Woodlands', 30.1658, -95.4613, false, 11),
  ('pearland', 'Pearland', 29.5636, -95.2860, false, 12);

-- Public-safe fields only: anything on an active restaurant can be read by anyone.
create table public.restaurants (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(name) between 1 and 120),
  description     text not null default '',
  cuisine         text not null default '',
  district_id     text not null references public.districts (id),
  address         text,
  hours           text,
  phone           text,
  website_url     text,
  lat             double precision,
  lng             double precision,
  price_level     integer not null default 2 check (price_level between 1 and 3),
  dine_in         boolean not null default true,
  pickup          boolean not null default false,
  offer_text      text not null default '' check (length(offer_text) <= 120),
  founding_until  timestamptz,                               -- top placement on the map until this date
  status          text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  listed_at       timestamptz,                               -- first time it went active; drives the "New" badge
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (status <> 'active' or (lat is not null and lng is not null and offer_text <> ''))
);
create index restaurants_status_idx on public.restaurants (status, district_id);

create function private.restaurant_before_write() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'active' and new.listed_at is null then new.listed_at := now(); end if;
  new.updated_at := now();
  return new;
end $$;
create trigger restaurants_before_write before insert or update on public.restaurants
  for each row execute function private.restaurant_before_write();

-- ---------- Restaurant sign-up form submissions (contact details stay private) ----------
create table public.partner_applications (
  id               uuid primary key default gen_random_uuid(),
  restaurant_name  text not null check (length(restaurant_name) between 1 and 120),
  contact_name     text not null check (length(contact_name) between 1 and 120),
  contact_reach    text not null check (length(contact_reach) between 1 and 200),
  address          text check (length(address) <= 300),
  district_text    text check (length(district_text) <= 120),
  cuisine          text check (length(cuisine) <= 120),
  description      text not null check (length(description) between 1 and 2000),
  proposed_offer   text check (length(proposed_offer) <= 200),
  slow_nights      text check (length(slow_nights) <= 200),
  status           text not null default 'new' check (status in ('new', 'contacted', 'added', 'declined')),
  restaurant_id    uuid references public.restaurants (id) on delete set null,
  admin_notes      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index partner_applications_status_idx on public.partner_applications (status, created_at desc);
create trigger partner_applications_updated before update on public.partner_applications
  for each row execute function private.set_updated_at();

-- The only way in for the public form: validates input and caps volume. p_hp is a hidden spam-trap field.
create function public.submit_partner_application(
  p_restaurant_name text, p_contact_name text, p_contact_reach text, p_description text,
  p_address text default null, p_district text default null, p_cuisine text default null,
  p_proposed_offer text default null, p_slow_nights text default null, p_hp text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_restaurant_name, ''));
  v_reach text := btrim(coalesce(p_contact_reach, ''));
begin
  if coalesce(p_hp, '') <> '' then return; end if;
  if v_name = '' or v_reach = '' or btrim(coalesce(p_contact_name, '')) = '' or btrim(coalesce(p_description, '')) = '' then
    raise exception 'invalid_application' using errcode = 'P0001';
  end if;
  if (select count(*) from public.partner_applications where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.partner_applications
    where lower(restaurant_name) = lower(v_name) and lower(contact_reach) = lower(v_reach)
      and created_at > now() - interval '1 day'
  ) then return; end if;
  insert into public.partner_applications
    (restaurant_name, contact_name, contact_reach, description, address, district_text, cuisine, proposed_offer, slow_nights)
  values (
    v_name, btrim(p_contact_name), v_reach, btrim(p_description),
    nullif(btrim(p_address), ''), nullif(btrim(p_district), ''), nullif(btrim(p_cuisine), ''),
    nullif(btrim(p_proposed_offer), ''), nullif(btrim(p_slow_nights), '')
  );
end $$;
revoke all on function public.submit_partner_application(text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_partner_application(text, text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------- Visits are not tracked ----------
drop table public.redemptions;

-- ---------- Keep purchase and gift records when an account is deleted, so later refunds can still revoke access ----------
alter table public.purchases drop constraint purchases_user_id_fkey;
alter table public.purchases alter column user_id drop not null;
alter table public.purchases add constraint purchases_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;
alter table public.gift_codes drop constraint gift_codes_purchaser_id_fkey;
alter table public.gift_codes alter column purchaser_id drop not null;
alter table public.gift_codes add constraint gift_codes_purchaser_id_fkey foreign key (purchaser_id) references auth.users (id) on delete set null;

-- ---------- Row level security for the new tables ----------
alter table public.platform_admins      enable row level security;
alter table public.profiles             enable row level security;
alter table public.districts            enable row level security;
alter table public.restaurants          enable row level security;
alter table public.partner_applications enable row level security;

create policy "see own admin row" on public.platform_admins for select to authenticated using (user_id = auth.uid());
create policy "own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "admins read profiles" on public.profiles for select to authenticated using (private.is_admin());
create policy "districts are public" on public.districts for select to anon, authenticated using (true);
create policy "admins manage districts" on public.districts for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "active restaurants are public" on public.restaurants for select to anon, authenticated using (status = 'active');
create policy "admins manage restaurants" on public.restaurants for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admins manage applications" on public.partner_applications for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- ---------- Least privilege: every table had full grants for anon and authenticated ----------
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant select on public.offerings, public.districts, public.restaurants to anon, authenticated;
grant select on public.billing_customers, public.purchases, public.gift_codes, public.subscriptions,
  public.checkout_attempts, public.entitlements, public.consents, public.platform_admins, public.profiles to authenticated;
grant insert on public.consents to authenticated;
grant insert, update, delete on public.districts, public.restaurants to authenticated;
grant select, insert, update, delete on public.partner_applications to authenticated;

alter policy "own customer" on public.billing_customers to authenticated;
alter policy "own attempts" on public.checkout_attempts to authenticated;
alter policy "own consents" on public.consents to authenticated;
alter policy "own marketing consent" on public.consents to authenticated;
alter policy "own entitlements" on public.entitlements to authenticated;
alter policy "own gift codes" on public.gift_codes to authenticated;
alter policy "own purchases" on public.purchases to authenticated;
alter policy "own subscriptions" on public.subscriptions to authenticated;

-- ---------- Admins are members without paying, through the same entitlement check paying members use ----------
create function private.sync_admin_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.entitlements where user_id = old.user_id and feature = 'membership' and source = 'admin';
    return old;
  end if;
  insert into public.entitlements (user_id, feature, source, access_expires_at)
  values (new.user_id, 'membership', 'admin', '2099-12-31T00:00:00Z')
  on conflict (user_id, feature, source) do update set access_expires_at = excluded.access_expires_at, updated_at = now();
  return new;
end $$;
revoke all on function private.sync_admin_membership() from public;
create trigger platform_admins_membership after insert or delete on public.platform_admins
  for each row execute function private.sync_admin_membership();

-- ---------- Functions only the server or the database should call ----------
revoke all on function public.has_membership(uuid) from public, anon, authenticated;
grant execute on function public.has_membership(uuid) to service_role;
revoke all on function public.handle_new_user() from public, anon, authenticated;
