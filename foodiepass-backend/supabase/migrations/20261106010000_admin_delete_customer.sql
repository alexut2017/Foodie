-- Lets an admin delete a customer's account from the admin console.
-- Refuses admins (including yourself), and anyone with a live subscription or an open checkout,
-- so a deleted account can never keep being charged. Their rows in our tables cascade or lose the user id.
create function public.admin_delete_customer(p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.platform_admins a where a.user_id = p_user) then
    raise exception 'is_admin' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.subscriptions s where s.user_id = p_user
             and s.provider_status in ('active', 'trialing', 'past_due', 'unpaid', 'paused')) then
    raise exception 'live_subscription' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.checkout_attempts c where c.user_id = p_user
             and c.status = 'open' and c.expires_at > now()) then
    raise exception 'checkout_open' using errcode = 'P0001';
  end if;

  insert into public.audit_log (user_id, action, detail)
  values (auth.uid(), 'admin_deleted_customer', jsonb_build_object('customer', p_user));
  delete from auth.users where id = p_user;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
end $$;

revoke all on function public.admin_delete_customer(uuid) from public, anon;
grant execute on function public.admin_delete_customer(uuid) to authenticated;
