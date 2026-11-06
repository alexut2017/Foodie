-- The admin restaurant form now has the same fields as the partner application.

-- 1. Applications keep each answer in its own column (the old combined columns stay for older applications).
alter table public.partner_applications
  add column first_name    text check (length(first_name) <= 60),
  add column last_name     text check (length(last_name) <= 60),
  add column phone         text check (length(phone) <= 40),
  add column email         text check (length(email) <= 140),
  add column address_line1 text check (length(address_line1) <= 120),
  add column address_line2 text check (length(address_line2) <= 80),
  add column city          text check (length(city) <= 80),
  add column state         text check (length(state) <= 2),
  add column zip           text check (length(zip) <= 10),
  add column website_url   text check (length(website_url) <= 300);

-- 2. Restaurants get a structured address. `address` stays as the one-line version the site shows.
alter table public.restaurants
  add column address_line1 text check (length(address_line1) <= 120),
  add column address_line2 text check (length(address_line2) <= 80),
  add column city          text check (length(city) <= 80),
  add column state         text check (length(state) <= 2),
  add column zip           text check (length(zip) <= 10);

-- 3. The restaurant's contact person. Restaurants are public to read, so this lives in its own admin-only table.
create table public.restaurant_contacts (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  first_name    text check (length(first_name) <= 60),
  last_name     text check (length(last_name) <= 60),
  phone         text check (length(phone) <= 40),
  email         text check (length(email) <= 140),
  updated_at    timestamptz not null default now()
);
alter table public.restaurant_contacts enable row level security;
create policy "admins manage restaurant contacts" on public.restaurant_contacts for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select, insert, update, delete on public.restaurant_contacts to authenticated;

-- 4. The application form sends the new fields. Every new parameter has a default, so the current site keeps working.
drop function public.submit_partner_application(text, text, text, text, text, text, text, text, text, text);
create function public.submit_partner_application(
  p_restaurant_name text, p_contact_name text, p_contact_reach text, p_description text,
  p_address text default null, p_district text default null, p_cuisine text default null,
  p_proposed_offer text default null, p_slow_nights text default null, p_hp text default null,
  p_first_name text default null, p_last_name text default null, p_phone text default null, p_email text default null,
  p_address_line1 text default null, p_address_line2 text default null, p_city text default null,
  p_state text default null, p_zip text default null, p_website text default null
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
    (restaurant_name, contact_name, contact_reach, description, address, district_text, cuisine, proposed_offer, slow_nights,
     first_name, last_name, phone, email, address_line1, address_line2, city, state, zip, website_url)
  values (
    v_name, btrim(p_contact_name), v_reach, btrim(p_description),
    nullif(btrim(p_address), ''), nullif(btrim(p_district), ''), nullif(btrim(p_cuisine), ''),
    nullif(btrim(p_proposed_offer), ''), nullif(btrim(p_slow_nights), ''),
    nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), ''), nullif(btrim(p_phone), ''), nullif(btrim(p_email), ''),
    nullif(btrim(p_address_line1), ''), nullif(btrim(p_address_line2), ''), nullif(btrim(p_city), ''),
    nullif(upper(btrim(p_state)), ''), nullif(btrim(p_zip), ''), nullif(btrim(p_website), '')
  );
end $$;
revoke all on function public.submit_partner_application(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_partner_application(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
