-- Pay first, verify after. A visitor fills in the Join form and goes straight to Stripe; the account is
-- only created once Stripe confirms the payment. Until then the form details wait here.
-- Only the server functions (service role) use this table: RLS is on and there are no policies.

create table public.pending_signups (
  id                 uuid primary key,                       -- also the Stripe checkout's client_reference_id
  email              text not null check (length(email) between 3 and 254),
  details            jsonb not null default '{}'::jsonb,     -- name, phone and address from the Join form
  marketing          boolean not null default false,
  terms_version      text check (length(terms_version) <= 40),
  referred_by        text check (length(referred_by) <= 20),
  offering_id        text not null references public.offerings (id),
  stripe_session_id  text unique,
  session_url        text,
  expires_at         timestamptz,
  purchase_id        uuid references public.purchases (id) on delete set null,
  user_id            uuid references auth.users (id) on delete set null,
  status             text not null default 'open' check (status in ('open', 'completed', 'expired')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index pending_signups_email_recent on public.pending_signups (lower(email), created_at desc);
create index pending_signups_recent on public.pending_signups (created_at desc);
alter table public.pending_signups enable row level security;
revoke all on public.pending_signups from anon, authenticated;

-- The server needs to find an existing account by email (someone who signed up before but never paid).
create function public.user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
$$;
revoke all on function public.user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.user_id_by_email(text) to service_role;
