-- ============================================================================
-- OfficeBites — auth trigger + storage buckets (Phase 1, part 2)
-- ============================================================================

-- Whenever someone signs up via supabase.auth.signUp(), automatically create
-- their profiles row from the metadata passed in options.data. This is what
-- lets authService.register() stay a single call instead of two.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, role, building)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'customer'),
    new.raw_user_meta_data->>'building'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage buckets — names must match BUCKETS in src/services/api/supabaseClient.js
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('payment-proofs', 'payment-proofs', false), -- private: only admin + the order's own customer should view
  ('meal-images', 'meal-images', true),
  ('vendor-images', 'vendor-images', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public buckets: anyone can view, only the vendor who owns the row (checked
-- at the app level when writing the path) can upload. Kept simple here —
-- tighten with a path-prefix check (e.g. path starts with vendor_id) once
-- vendor image management moves off the deferred vendor dashboard.
create policy "public_read_meal_images" on storage.objects
  for select using (bucket_id = 'meal-images');
create policy "authenticated_write_meal_images" on storage.objects
  for insert with check (bucket_id = 'meal-images' and auth.role() = 'authenticated');

create policy "public_read_vendor_images" on storage.objects
  for select using (bucket_id = 'vendor-images');
create policy "authenticated_write_vendor_images" on storage.objects
  for insert with check (bucket_id = 'vendor-images' and auth.role() = 'authenticated');

create policy "public_read_avatars" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "authenticated_write_avatars" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

-- Payment proofs are sensitive: anyone (including guests, via the anon key)
-- can upload one at checkout time — that's the whole point of guest
-- checkout — but only admins can read them back to review. Customers view
-- their own proof through the order record's payment_proof_url instead of
-- browsing the bucket directly.
create policy "anyone_can_upload_payment_proof" on storage.objects
  for insert with check (bucket_id = 'payment-proofs');
create policy "admin_read_payment_proofs" on storage.objects
  for select using (bucket_id = 'payment-proofs' and is_admin());
