-- ============================================================================
-- OfficeBites - vendor signup provisioning
--
-- Customer signup:
--   auth.users -> profiles
--
-- Vendor signup:
--   auth.users -> profiles
--              -> vendors (pending)
--              -> profiles.vendor_id
--
-- Existing users/vendors are NOT modified.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
  new_vendor_id uuid;
  business_name text;
  business_category text;
begin
  requested_role :=
    coalesce(
      (new.raw_user_meta_data->>'role')::public.user_role,
      'customer'::public.user_role
    );

  -- Create the normal OfficeBites profile first.
  insert into public.profiles (
    id,
    name,
    email,
    role,
    building
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    requested_role,
    nullif(trim(new.raw_user_meta_data->>'building'), '')
  );

  -- Customers stop here.
  if requested_role <> 'vendor'::public.user_role then
    return new;
  end if;

  business_name :=
    nullif(trim(new.raw_user_meta_data->>'business_name'), '');

  business_category :=
    nullif(trim(new.raw_user_meta_data->>'business_category'), '');

  if business_name is null then
    raise exception 'Business name is required for vendor registration';
  end if;

  if business_category is null then
    raise exception 'Business category is required for vendor registration';
  end if;

  -- Create the storefront as PENDING.
  -- It remains invisible to normal marketplace discovery until admin approval.
  insert into public.vendors (
    owner_id,
    name,
    category,
    building,
    status,
    email
  )
  values (
    new.id,
    business_name,
    business_category,
    nullif(trim(new.raw_user_meta_data->>'building'), ''),
    'pending'::public.vendor_status,
    new.email
  )
  returning id into new_vendor_id;

  -- Link the authenticated profile to its storefront.
  update public.profiles
  set vendor_id = new_vendor_id
  where id = new.id;

  return new;
end;
$$;
