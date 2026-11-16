-- Restaurant owners and staff PINs.
-- 1. Each restaurant has a 4-digit staff PIN (stored hashed). A server types it on the diner's phone to confirm a visit,
--    so diners can't confirm their own pass and every visit is tied to the right restaurant.
-- 2. Owners sign in with an emailed code (same as diners). The email on the restaurant's contact record (restaurant_contacts)
--    is the owner's login: signing in with it links the account to that restaurant.
-- 3. Owners see visits per week and edit their offer, hours and photo; they can also change the staff PIN.
-- Safe to run more than once. Nothing here drops or rewrites existing data.

create extension if not exists pgcrypto with schema extensions;

-- Visits. (The earlier redemptions migration was never applied to the live project.) Members read their own;
-- only confirm_visit below writes them, so a visit always carries a valid staff PIN.
create table if not exists public.redemptions (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  restaurant_id    text not null,
  restaurant_name  text,
  offer            text,
  code             text not null,
  opened_at        timestamptz,
  confirmed_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
create index if not exists redemptions_user_idx on public.redemptions (user_id, confirmed_at desc);
create index if not exists redemptions_restaurant_idx on public.redemptions (restaurant_id, confirmed_at desc);
alter table public.redemptions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'redemptions' and policyname = 'own visits') then
    create policy "own visits" on public.redemptions for select to authenticated using (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.restaurant_pins (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  pin_hash      text not null,
  updated_at    timestamptz not null default now()
);
alter table public.restaurant_pins enable row level security; -- no policies: only the functions below touch it

create table if not exists public.visit_pin_attempts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  ok            boolean not null,
  created_at    timestamptz not null default now()
);
create index if not exists visit_pin_attempts_idx on public.visit_pin_attempts (user_id, restaurant_id, created_at desc);
alter table public.visit_pin_attempts enable row level security;

create table if not exists public.restaurant_owners (
  user_id       uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);
alter table public.restaurant_owners enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'restaurant_owners' and policyname = 'owners see own links') then
    create policy "owners see own links" on public.restaurant_owners for select to authenticated using (auth.uid() = user_id);
  end if;
end $$;

-- Partner application emails (sent by the partner-email server function).
alter table public.partner_applications add column if not exists confirmation_sent_at timestamptz;
alter table public.partner_applications add column if not exists approved_email_sent_at timestamptz;

create or replace function private.owns_restaurant(p_restaurant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.restaurant_owners where user_id = auth.uid() and restaurant_id = p_restaurant);
$$;
revoke all on function private.owns_restaurant(uuid) from public;
grant execute on function private.owns_restaurant(uuid) to authenticated;

-- Admins and the restaurant's owners set the staff PIN.
create or replace function public.set_restaurant_pin(p_restaurant uuid, p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (private.is_admin() or private.owns_restaurant(p_restaurant)) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then raise exception 'invalid_pin' using errcode = 'P0001'; end if;
  insert into public.restaurant_pins (restaurant_id, pin_hash, updated_at)
    values (p_restaurant, extensions.crypt(p_pin, extensions.gen_salt('bf')), now())
    on conflict (restaurant_id) do update set pin_hash = excluded.pin_hash, updated_at = now();
end $$;

-- Which restaurants have a PIN (admin console and owner page).
create or replace function public.restaurants_with_pin() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.restaurant_id from public.restaurant_pins p
  where private.is_admin() or private.owns_restaurant(p.restaurant_id);
$$;

-- A member's visit, confirmed by staff with the restaurant PIN. Records the visit on the server and returns the visit code.
create or replace function public.confirm_visit(p_restaurant uuid, p_pin text, p_opened_at timestamptz default null) returns json
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r record;
  v_hash text;
  fails int;
  v_code text;
  recent record;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if uid is null then return json_build_object('status', 'not_signed_in'); end if;
  if not exists (
    select 1 from public.entitlements e
    where e.user_id = uid and e.feature = 'membership'
      and (e.source = 'admin' or greatest(e.access_expires_at, coalesce(e.grace_expires_at, e.access_expires_at)) > now())
  ) then return json_build_object('status', 'not_member'); end if;

  select id, name, offer_text into r from public.restaurants where id = p_restaurant and status = 'active';
  if not found then return json_build_object('status', 'not_found'); end if;

  -- Same visit confirmed a moment ago (double tap, bad connection): hand back the same code.
  select code, confirmed_at into recent from public.redemptions
    where user_id = uid and restaurant_id = p_restaurant::text and confirmed_at > now() - interval '30 minutes'
    order by confirmed_at desc limit 1;
  if found then return json_build_object('status', 'ok', 'code', recent.code, 'confirmed_at', recent.confirmed_at, 'repeat', true); end if;

  select count(*) into fails from public.visit_pin_attempts
    where user_id = uid and restaurant_id = p_restaurant and not ok and created_at > now() - interval '15 minutes';
  if fails >= 5 then return json_build_object('status', 'locked'); end if;

  select pin_hash into v_hash from public.restaurant_pins where restaurant_id = p_restaurant;
  if v_hash is null then return json_build_object('status', 'no_pin'); end if;

  if coalesce(p_pin, '') !~ '^[0-9]{4}$' or extensions.crypt(p_pin, v_hash) <> v_hash then
    insert into public.visit_pin_attempts (user_id, restaurant_id, ok) values (uid, p_restaurant, false);
    return json_build_object('status', 'wrong_pin', 'tries_left', greatest(0, 4 - fails));
  end if;

  insert into public.visit_pin_attempts (user_id, restaurant_id, ok) values (uid, p_restaurant, true);
  select string_agg(substr(alphabet, 1 + (get_byte(b, i) % 32), 1), '') into v_code
    from (select extensions.gen_random_bytes(6) as b) x, generate_series(0, 5) as i;
  insert into public.redemptions (user_id, restaurant_id, restaurant_name, offer, code, opened_at, confirmed_at)
    values (uid, p_restaurant::text, r.name, r.offer_text, v_code, coalesce(p_opened_at, now()), now());
  return json_build_object('status', 'ok', 'code', v_code, 'confirmed_at', now());
end $$;

-- Owner sign-in: link this account to every restaurant whose contact email matches the signed-in email.
create or replace function public.claim_owner_restaurants() returns int
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); v_email text; n int;
begin
  if uid is null then return 0; end if;
  select lower(email) into v_email from auth.users where id = uid;
  if v_email is null or v_email = '' then return 0; end if;
  insert into public.restaurant_owners (user_id, restaurant_id)
    select uid, c.restaurant_id from public.restaurant_contacts c where lower(btrim(c.email)) = v_email
    on conflict do nothing;
  select count(*) into n from public.restaurant_owners where user_id = uid;
  return n;
end $$;

-- Everything the owner page shows: listing fields, whether a PIN is set, and visits per week for the last 12 weeks.
create or replace function public.owner_dashboard() returns json
language sql stable security definer set search_path = '' as $$
  select coalesce(json_agg(json_build_object(
    'id', r.id, 'name', r.name, 'status', r.status, 'offer_text', r.offer_text, 'hours', r.hours,
    'photo_url', r.photo_url, 'description', r.description,
    'has_pin', exists (select 1 from public.restaurant_pins p where p.restaurant_id = r.id),
    'visits_total', (select count(*) from public.redemptions x where x.restaurant_id = r.id::text),
    'weeks', (
      select json_agg(json_build_object('week', w.wk, 'visits', (
        select count(*) from public.redemptions x
        where x.restaurant_id = r.id::text and x.confirmed_at >= w.wk and x.confirmed_at < w.wk + interval '7 days'
      )) order by w.wk)
      from (select generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') as wk) w
    )
  ) order by r.name), '[]'::json)
  from public.restaurants r
  join public.restaurant_owners o on o.restaurant_id = r.id and o.user_id = auth.uid();
$$;

-- Owners edit their offer, hours and photo. Photos must come from our storage (owners upload to owners/<restaurant id>/).
create or replace function public.owner_update_restaurant(p_restaurant uuid, p_offer text, p_hours text, p_photo_url text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_offer text := btrim(coalesce(p_offer, '')); v_hours text := btrim(coalesce(p_hours, ''));
begin
  if not private.owns_restaurant(p_restaurant) then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if v_offer = '' or length(v_offer) > 140 then raise exception 'invalid_offer' using errcode = 'P0001'; end if;
  if length(v_hours) > 300 then raise exception 'invalid_hours' using errcode = 'P0001'; end if;
  if p_photo_url is not null and p_photo_url <> ''
     and p_photo_url !~ ('^https://mroiimqqklitidpzaqnk\.supabase\.co/storage/v1/object/public/restaurant-photos/owners/' || p_restaurant::text || '/') then
    raise exception 'invalid_photo' using errcode = 'P0001';
  end if;
  update public.restaurants
    set offer_text = v_offer,
        -- Owners type hours as text; when they change them, the admin's structured hours give way to the new text.
        hours_json = case when nullif(v_hours, '') is distinct from hours then null else hours_json end,
        hours = nullif(v_hours, ''),
        photo_url = case when p_photo_url is null then photo_url else nullif(p_photo_url, '') end,
        updated_at = now()
    where id = p_restaurant;
end $$;

-- Owners upload photos for their own restaurants only (folder owners/<restaurant id>/ in the restaurant-photos bucket).
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'owners upload their restaurant photos') then
    create policy "owners upload their restaurant photos" on storage.objects for insert to authenticated
      with check (bucket_id = 'restaurant-photos' and (storage.foldername(name))[1] = 'owners'
                  and private.owns_restaurant(((storage.foldername(name))[2])::uuid));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'owners replace their restaurant photos') then
    create policy "owners replace their restaurant photos" on storage.objects for update to authenticated
      using (bucket_id = 'restaurant-photos' and (storage.foldername(name))[1] = 'owners'
             and private.owns_restaurant(((storage.foldername(name))[2])::uuid));
  end if;
end $$;

revoke all on function public.set_restaurant_pin(uuid, text) from public, anon;
revoke all on function public.restaurants_with_pin() from public, anon;
revoke all on function public.confirm_visit(uuid, text, timestamptz) from public, anon;
revoke all on function public.claim_owner_restaurants() from public, anon;
revoke all on function public.owner_dashboard() from public, anon;
revoke all on function public.owner_update_restaurant(uuid, text, text, text) from public, anon;
grant execute on function public.set_restaurant_pin(uuid, text) to authenticated;
grant execute on function public.restaurants_with_pin() to authenticated;
grant execute on function public.confirm_visit(uuid, text, timestamptz) to authenticated;
grant execute on function public.claim_owner_restaurants() to authenticated;
grant execute on function public.owner_dashboard() to authenticated;
grant execute on function public.owner_update_restaurant(uuid, text, text, text) to authenticated;
grant select on public.restaurant_owners to authenticated;
grant select on public.redemptions to authenticated;
