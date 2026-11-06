-- Neighborhoods are no longer used: restaurants show their city and state instead.
-- New restaurants don't get one. The districts table and existing values stay, so nothing is lost.
alter table public.restaurants alter column district_id drop not null;
