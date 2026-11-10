-- Referrals. Every member's code is "GS-" plus the first 6 characters of their account id (the website and apps
-- build it the same way). A friend who joins with the code gets 13 months for the first year, and the member who
-- shared it gets one extra month. The months are granted by the server once the friend's membership is paid
-- (see functions/_shared/referrals.ts); these tables and functions only record who referred whom.

create table public.referrals (
  referred_id     uuid primary key references auth.users (id) on delete cascade,   -- one referral per account
  referrer_id     uuid references auth.users (id) on delete set null,
  code            text not null check (code ~ '^GS-[0-9A-F]{6}$'),
  status          text not null default 'pending' check (status in ('pending', 'processing', 'rewarded')),
  referred_bonus  text,          -- 'stripe', 'entitlement' or 'skipped:<reason>' once handled
  referrer_bonus  text,
  created_at      timestamptz not null default now(),
  rewarded_at     timestamptz
);
create index referrals_referrer on public.referrals (referrer_id);
alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;
create policy "admins read referrals" on public.referrals for select to authenticated using (private.is_admin());
grant select on public.referrals to authenticated;

-- Code -> member. Returns nothing if the code is unknown or (very unlikely) matches more than one account.
create function public.referrer_for_code(p_code text) returns uuid
language sql stable security definer set search_path = '' as $$
  with m as (
    select u.id from auth.users u
    where upper(substr(replace(u.id::text, '-', ''), 1, 6)) = substr(upper(btrim(p_code)), 4)
      and upper(btrim(p_code)) ~ '^GS-[0-9A-F]{6}$'
    limit 2
  )
  select case when (select count(*) from m) = 1 then (select id from m) end;
$$;
revoke all on function public.referrer_for_code(text) from public, anon, authenticated;
grant execute on function public.referrer_for_code(text) to service_role;

-- A new member who joined without the link can add a friend's code within 14 days of joining.
-- Returns ok, invalid_code, own_code, already_referred, too_late or not_signed_in. The months follow once they've paid.
create function public.claim_referral(p_code text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_referrer uuid;
begin
  if v_me is null then return 'not_signed_in'; end if;
  if v_code !~ '^GS-[0-9A-F]{6}$' then return 'invalid_code'; end if;
  v_referrer := public.referrer_for_code(v_code);
  if v_referrer is null then return 'invalid_code'; end if;
  if v_referrer = v_me then return 'own_code'; end if;
  if exists (select 1 from public.referrals where referred_id = v_me) then return 'already_referred'; end if;
  if (select created_at from auth.users where id = v_me) < now() - interval '14 days' then return 'too_late'; end if;
  insert into public.referrals (referred_id, referrer_id, code) values (v_me, v_referrer, v_code) on conflict do nothing;
  insert into public.audit_log (user_id, action, detail) values (v_me, 'referral_claimed', jsonb_build_object('code', v_code));
  return 'ok';
end $$;
revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- The signed-in member's numbers: friends who joined, free months earned this calendar year, and the code they joined with.
create function public.my_referrals() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'joined', (select count(*) from public.referrals r where r.referrer_id = auth.uid() and r.status = 'rewarded'),
    'months_this_year', (select count(*) from public.referrals r where r.referrer_id = auth.uid() and r.status = 'rewarded'
                          and r.referrer_bonus in ('stripe', 'entitlement') and r.rewarded_at >= date_trunc('year', now())),
    'referred_by', (select r.code from public.referrals r where r.referred_id = auth.uid())
  )
  where auth.uid() is not null;
$$;
revoke all on function public.my_referrals() from public, anon;
grant execute on function public.my_referrals() to authenticated;
