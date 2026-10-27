-- OfficeBites release-candidate reconciliation
-- Captures staging changes required by the QA-tested frontend.

-- Customer -> vendor conversion
create or replace function public.become_vendor(
  p_business_name text,
  p_business_category text,
  p_building text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_profile public.profiles%rowtype;
  existing_vendor public.vendors%rowtype;
  new_vendor public.vendors%rowtype;
  clean_name text := nullif(trim(p_business_name), '');
  clean_category text := nullif(trim(p_business_category), '');
  clean_building text := nullif(trim(p_building), '');
begin
  if current_user_id is null then raise exception 'You must be signed in to become a vendor'; end if;
  if clean_name is null then raise exception 'Business name is required'; end if;
  if clean_category is null then raise exception 'Business category is required'; end if;

  select * into current_profile from public.profiles where id = current_user_id for update;
  if not found then raise exception 'OfficeBites profile not found'; end if;
  if current_profile.role::text = 'admin' then raise exception 'Admin accounts cannot be converted to vendor accounts'; end if;

  if current_profile.vendor_id is not null then
    select * into existing_vendor from public.vendors where id = current_profile.vendor_id;
    if found then
      return jsonb_build_object('vendor_id', existing_vendor.id, 'status', existing_vendor.status, 'already_vendor', true);
    end if;
    raise exception 'Profile has an invalid vendor link';
  end if;

  select * into existing_vendor
  from public.vendors
  where owner_id = current_user_id
  order by created_at asc
  limit 1;

  if found then
    update public.profiles
    set role = 'vendor', vendor_id = existing_vendor.id, building = coalesce(clean_building, building)
    where id = current_user_id;

    return jsonb_build_object('vendor_id', existing_vendor.id, 'status', existing_vendor.status, 'already_vendor', true);
  end if;

  insert into public.vendors (owner_id, name, category, building, status, email)
  values (current_user_id, clean_name, clean_category, clean_building, 'pending', current_profile.email)
  returning * into new_vendor;

  update public.profiles
  set role = 'vendor', vendor_id = new_vendor.id, building = coalesce(clean_building, building)
  where id = current_user_id;

  return jsonb_build_object('vendor_id', new_vendor.id, 'status', new_vendor.status, 'already_vendor', false);
end;
$$;

revoke all on function public.become_vendor(text, text, text) from public, anon;
grant execute on function public.become_vendor(text, text, text) to authenticated;

-- Privileged profile/vendor field guards
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then return new; end if;

  if old.role::text = 'customer'
     and new.role::text = 'vendor'
     and old.vendor_id is null
     and new.vendor_id is not null
     and new.id = old.id
     and new.suspended is not distinct from old.suspended
     and new.created_at is not distinct from old.created_at
     and new.email is not distinct from old.email
     and auth.uid() = old.id
     and exists (
       select 1 from public.vendors v
       where v.id = new.vendor_id and v.owner_id = auth.uid()
     ) then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.role is distinct from old.role
     or new.vendor_id is distinct from old.vendor_id
     or new.suspended is distinct from old.suspended
     or new.created_at is distinct from old.created_at
     or new.email is distinct from old.email then
    raise exception 'Privileged profile fields cannot be changed by this user';
  end if;

  return new;
end;
$$;

create or replace function public.guard_vendor_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then return new; end if;

  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.status is distinct from old.status
     or new.featured is distinct from old.featured
     or new.rating is distinct from old.rating
     or new.review_count is distinct from old.review_count
     or new.subscription_tier is distinct from old.subscription_tier
     or new.created_at is distinct from old.created_at then
    raise exception 'Privileged vendor fields cannot be changed by this user';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_fields on public.profiles;
create trigger guard_profile_privileged_fields
before update on public.profiles
for each row execute function public.guard_profile_privileged_fields();

drop trigger if exists guard_vendor_privileged_fields on public.vendors;
create trigger guard_vendor_privileged_fields
before update on public.vendors
for each row execute function public.guard_vendor_privileged_fields();

revoke all on function public.guard_profile_privileged_fields() from public, anon, authenticated;
revoke all on function public.guard_vendor_privileged_fields() from public, anon, authenticated;

-- Trigger helpers must not be directly callable through the Data API.
revoke all on function public.notify_chat_recipient() from public, anon, authenticated;
revoke all on function public.notify_support_reply() from public, anon, authenticated;

-- Storage state used by the QA-tested frontend.
update storage.buckets set public = true
where id in ('avatars', 'meal-images', 'vendor-images');

update storage.buckets set public = false
where id in ('payment-proofs', 'support-attachments');

drop policy if exists public_read_vendor_images on storage.objects;
create policy public_read_vendor_images
on storage.objects for select to public
using (bucket_id = 'vendor-images');

drop policy if exists vendor_upload_own_vendor_images on storage.objects;
create policy vendor_upload_own_vendor_images
on storage.objects for insert to authenticated
with check (
  bucket_id = 'vendor-images'
  and exists (
    select 1 from public.vendors v
    where v.id::text = (storage.foldername(name))[1]
      and v.owner_id = (select auth.uid())
  )
);

drop policy if exists vendor_update_own_vendor_images on storage.objects;
create policy vendor_update_own_vendor_images
on storage.objects for update to authenticated
using (
  bucket_id = 'vendor-images'
  and exists (
    select 1 from public.vendors v
    where v.id::text = (storage.foldername(name))[1]
      and v.owner_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'vendor-images'
  and exists (
    select 1 from public.vendors v
    where v.id::text = (storage.foldername(name))[1]
      and v.owner_id = (select auth.uid())
  )
);

drop policy if exists vendor_delete_own_vendor_images on storage.objects;
create policy vendor_delete_own_vendor_images
on storage.objects for delete to authenticated
using (
  bucket_id = 'vendor-images'
  and exists (
    select 1 from public.vendors v
    where v.id::text = (storage.foldername(name))[1]
      and v.owner_id = (select auth.uid())
  )
);
