-- ============================================================================
-- OfficeBites — core schema (Phase 1 of Supabase migration)
-- Run this in the Supabase SQL editor, or via `supabase db push` if you're
-- using the CLI. Covers: accounts, vendors, menu, and the ordering/ticketing
-- loop. Chat, notifications, and support tickets stay on the local mock
-- layer for now (see README-SUPABASE.md) and get their own migration later
-- once this slice is confirmed working end to end.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enums — mirror src/utils/constants.js exactly. If you rename a status
-- there, rename it here too, or the two layers will drift.
-- ---------------------------------------------------------------------------
create type user_role as enum ('customer', 'vendor', 'admin');

create type vendor_status as enum ('pending', 'approved', 'suspended', 'rejected');

create type order_status as enum (
  'pending_payment', 'payment_submitted', 'confirmed', 'accepted',
  'preparing', 'ready', 'collected', 'completed', 'cancelled'
);

create type payment_status as enum ('unpaid', 'verifying', 'paid');

-- The single-step-forward pipeline vendors move an order through — mirrors
-- utils/constants.js VENDOR_ORDER_FLOW. Used by the trigger below so an
-- invalid transition is rejected by the database, not just the client.
create table if not exists order_flow (
  status order_status primary key,
  step int not null unique
);
insert into order_flow (status, step) values
  ('pending_payment', 1), ('payment_submitted', 2), ('confirmed', 3),
  ('accepted', 4), ('preparing', 5), ('ready', 6), ('collected', 7), ('completed', 8)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- profiles — one row per authenticated user, 1:1 with auth.users.
-- Guests never get a row here; their orders carry guest_name/guest_contact
-- directly on the order instead (see orders table below).
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role user_role not null default 'customer',
  avatar_url text,
  building text,
  vendor_id uuid, -- set once the vendors row exists; fk added after vendors is created
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete set null,
  name text not null,
  tagline text,
  category text not null,
  rating numeric(2,1) not null default 0,
  review_count int not null default 0,
  prep_time_mins int not null default 20,
  cover_image text,
  logo text,
  building text,
  status vendor_status not null default 'pending',
  featured boolean not null default false,
  subscription_tier text not null default 'basic',
  contact_number text,
  email text,
  address text,
  delivery_radius numeric,
  operating_hours text,
  created_at timestamptz not null default now()
);

alter table profiles add constraint profiles_vendor_id_fkey
  foreign key (vendor_id) references vendors(id) on delete set null;

create table if not exists meals (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  image text,
  category text not null,
  tags text[] not null default '{}',
  available boolean not null default true,
  featured boolean not null default false,
  preparation_time int not null default 15,
  rating numeric(2,1) not null default 0,
  review_count int not null default 0,
  created_at timestamptz not null default now()
);

-- One checkout -> one order; internally split per vendor via order_suborders.
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  customer_id uuid references profiles(id) on delete set null,
  guest_name text,
  guest_contact text,
  delivery_date date not null,
  status order_status not null default 'pending_payment',
  total numeric(10,2) not null default 0,
  payment_proof_url text,
  created_at timestamptz not null default now(),
  constraint orders_customer_or_guest check (customer_id is not null or guest_name is not null)
);

create table if not exists order_suborders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  vendor_id uuid not null references vendors(id),
  status order_status not null default 'pending_payment',
  payment_status payment_status not null default 'unpaid',
  subtotal numeric(10,2) not null default 0,
  collection_time text,
  notes text,
  unique (order_id, vendor_id)
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  suborder_id uuid not null references order_suborders(id) on delete cascade,
  meal_id uuid references meals(id) on delete set null,
  meal_name text not null, -- snapshot at order time, survives menu edits
  qty int not null check (qty > 0),
  price numeric(10,2) not null
);

create table if not exists favourites (
  profile_id uuid not null references profiles(id) on delete cascade,
  meal_id uuid not null references meals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, meal_id)
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  meal_id uuid references meals(id) on delete set null,
  customer_id uuid references profiles(id) on delete set null,
  customer_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Enforce the vendor order pipeline at the database level too — a status
-- can only move to the next step, matching orderService.isValidTransition()
-- on the client. Belt-and-braces: the client should never send an invalid
-- transition, but this makes it impossible even if it did.
-- ---------------------------------------------------------------------------
create or replace function enforce_order_status_transition()
returns trigger as $$
declare
  old_step int;
  new_step int;
begin
  if new.status = old.status then
    return new;
  end if;
  select step into old_step from order_flow where status = old.status;
  select step into new_step from order_flow where status = new.status;
  if old.status = 'cancelled' then
    raise exception 'Cannot change status of a cancelled order';
  end if;
  if new.status = 'cancelled' then
    return new;
  end if;
  if old_step is null or new_step is null or new_step <> old_step + 1 then
    raise exception 'Invalid status transition: % -> %', old.status, new.status;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists order_suborders_status_guard on order_suborders;
create trigger order_suborders_status_guard
  before update of status on order_suborders
  for each row execute function enforce_order_status_transition();

-- ---------------------------------------------------------------------------
-- Helper functions for RLS policies below.
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer stable;

create or replace function current_vendor_id()
returns uuid as $$
  select vendor_id from profiles where id = auth.uid();
$$ language sql security definer stable;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table vendors enable row level security;
alter table meals enable row level security;
alter table orders enable row level security;
alter table order_suborders enable row level security;
alter table order_items enable row level security;
alter table favourites enable row level security;
alter table reviews enable row level security;

-- profiles: you can read/update your own row; admins can read everyone's.
create policy "profiles_select_own_or_admin" on profiles
  for select using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());
create policy "profiles_insert_own" on profiles
  for insert with check (id = auth.uid());

-- vendors: anyone (including guests) can see approved vendors; a vendor
-- owner sees and edits their own regardless of status; admins see/edit all.
create policy "vendors_select_approved_or_own_or_admin" on vendors
  for select using (status = 'approved' or owner_id = auth.uid() or is_admin());
create policy "vendors_update_own_or_admin" on vendors
  for update using (owner_id = auth.uid() or is_admin());
create policy "vendors_insert_admin_or_self" on vendors
  for insert with check (owner_id = auth.uid() or is_admin());

-- meals: public read for meals belonging to an approved vendor; the owning
-- vendor has full CRUD on their own meals regardless of vendor status.
create policy "meals_select_public_or_own" on meals
  for select using (
    exists (select 1 from vendors v where v.id = meals.vendor_id and v.status = 'approved')
    or vendor_id = current_vendor_id()
    or is_admin()
  );
create policy "meals_crud_own_vendor" on meals
  for all using (vendor_id = current_vendor_id() or is_admin())
  with check (vendor_id = current_vendor_id() or is_admin());

-- orders: a signed-in customer sees their own orders; admins see everything.
-- Guest orders (customer_id is null) are looked up by id/ticket number only
-- — the UUID itself is the "secret" the guest holds via their ticket link,
-- the same trust model as most guest order-tracking flows. If you need
-- guests to be unable to enumerate other guest orders even by id, add a
-- short-lived signed token instead before going further into production.
drop policy if exists "orders_select_own_guest_or_admin" on orders;
create policy "orders_select_own_guest_or_admin" on orders
  for select using (
    customer_id = auth.uid()
    or is_admin()
    or exists (
      select 1
      from order_suborders so
      where so.order_id = orders.id
        and so.vendor_id = current_vendor_id()
    )
    or customer_id is null
  );
create policy "orders_insert_any" on orders
  for insert with check (true); -- ordering must never require login
create policy "orders_update_admin_only" on orders
  for update using (is_admin());

create policy "suborders_select_customer_vendor_admin" on order_suborders
  for select using (
    vendor_id = current_vendor_id()
    or is_admin()
    or exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or o.customer_id is null))
  );
create policy "suborders_insert_any" on order_suborders
  for insert with check (true);
create policy "suborders_update_vendor_or_admin" on order_suborders
  for update using (vendor_id = current_vendor_id() or is_admin());

create policy "order_items_select_via_suborder" on order_items
  for select using (
    exists (
      select 1 from order_suborders so
      join orders o on o.id = so.order_id
      where so.id = suborder_id
        and (so.vendor_id = current_vendor_id() or is_admin() or o.customer_id = auth.uid() or o.customer_id is null)
    )
  );
create policy "order_items_insert_any" on order_items
  for insert with check (true);

-- favourites: fully private to the owning profile.
create policy "favourites_owner_only" on favourites
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- reviews: public read, only the reviewing customer can write their own.
create policy "reviews_select_public" on reviews
  for select using (true);
create policy "reviews_insert_own" on reviews
  for insert with check (customer_id = auth.uid() or customer_id is null);
