-- Mobile app sign-up records the optional marketing choice after the phone code step.
-- Members may add their own marketing consent rows only (terms consent is still written by the sign-up trigger).
create policy "own marketing consent" on public.consents for insert
  with check (auth.uid() = user_id and kind = 'marketing');

grant insert on public.consents to authenticated;
