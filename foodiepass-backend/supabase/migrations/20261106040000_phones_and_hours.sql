-- Applications collect a public phone and structured opening hours; restaurants store the structured hours too.
-- hours_json is a list like [{"days": ["mon","tue"], "open": "11:00", "close": "21:00"}].
-- `hours` stays as the readable version the site shows ("Mon–Fri 11 AM – 9 PM").

alter table public.partner_applications
  add column public_phone text check (length(public_phone) <= 40),
  add column hours        text check (length(hours) <= 300),
  add column hours_json   jsonb check (hours_json is null or (jsonb_typeof(hours_json) = 'array' and jsonb_array_length(hours_json) <= 7));

alter table public.restaurants
  add column hours_json jsonb check (hours_json is null or (jsonb_typeof(hours_json) = 'array' and jsonb_array_length(hours_json) <= 7));

-- Replace the application function again. All new parameters have defaults, so older versions of the site keep working.
drop function public.submit_partner_application(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text);
create function public.submit_partner_application(
  p_restaurant_name text, p_contact_name text, p_contact_reach text, p_description text,
  p_address text default null, p_district text default null, p_cuisine text default null,
  p_proposed_offer text default null, p_slow_nights text default null, p_hp text default null,
  p_first_name text default null, p_last_name text default null, p_phone text default null, p_email text default null,
  p_address_line1 text default null, p_address_line2 text default null, p_city text default null,
  p_state text default null, p_zip text default null, p_website text default null,
  p_public_phone text default null, p_hours text default null, p_hours_json jsonb default null
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
     first_name, last_name, phone, email, address_line1, address_line2, city, state, zip, website_url,
     public_phone, hours, hours_json)
  values (
    v_name, btrim(p_contact_name), v_reach, btrim(p_description),
    nullif(btrim(p_address), ''), nullif(btrim(p_district), ''), nullif(btrim(p_cuisine), ''),
    nullif(btrim(p_proposed_offer), ''), nullif(btrim(p_slow_nights), ''),
    nullif(btrim(p_first_name), ''), nullif(btrim(p_last_name), ''), nullif(btrim(p_phone), ''), nullif(btrim(p_email), ''),
    nullif(btrim(p_address_line1), ''), nullif(btrim(p_address_line2), ''), nullif(btrim(p_city), ''),
    nullif(upper(btrim(p_state)), ''), nullif(btrim(p_zip), ''), nullif(btrim(p_website), ''),
    nullif(btrim(p_public_phone), ''), nullif(btrim(p_hours), ''),
    case when jsonb_typeof(p_hours_json) = 'array' and jsonb_array_length(p_hours_json) between 1 and 7 then p_hours_json end
  );
end $$;
revoke all on function public.submit_partner_application(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.submit_partner_application(text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb) to anon, authenticated;
