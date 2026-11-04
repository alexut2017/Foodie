-- Featured restaurants on the home page, each with a photo of the location.
alter table public.restaurants
  add column featured boolean not null default false,
  add column photo_url text;

-- Photos are public to view; only admins can add, change or remove them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('restaurant-photos', 'restaurant-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "admins add restaurant photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'restaurant-photos' and private.is_admin());
create policy "admins change restaurant photos" on storage.objects for update to authenticated
  using (bucket_id = 'restaurant-photos' and private.is_admin())
  with check (bucket_id = 'restaurant-photos' and private.is_admin());
create policy "admins remove restaurant photos" on storage.objects for delete to authenticated
  using (bucket_id = 'restaurant-photos' and private.is_admin());
