-- ============================================================================
-- OfficeBites — guest order security fix (Phase 3 of the production hardening)
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- AUDIT FINDING (see chat write-up for full detail):
-- orders_select_own_guest_or_admin allowed `customer_id is null` with no
-- further scoping. Because Supabase's REST layer lets any holder of the
-- public anon key run arbitrary filters, this meant:
--
--   GET /rest/v1/orders?customer_id=is.null&select=*
--
-- returned EVERY guest order ever placed — names, phone numbers, totals,
-- ticket numbers — to anyone, with no login and no knowledge of any specific
-- order. The anon key is not secret (it ships in the JS bundle by design);
-- RLS was the only real barrier, and this policy had none for guest rows.
--
-- FIX: guest order reads no longer go through the base table's SELECT policy
-- at all. They go through three narrow, parameter-bound SECURITY DEFINER
-- functions below, each of which can only ever return the ONE order matching
-- the specific id/ticket+contact you already supply as arguments — there's no
-- way to call them without a filter and get everything back, unlike a raw
-- table read. Authenticated customers, vendors, and admins are completely
-- unaffected — they still read `orders` directly under their existing
-- policies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Delivery location — didn't exist anywhere in the schema. Vendors had no
-- structured way to know where to deliver a completed order.
-- ---------------------------------------------------------------------------
alter table orders add column if not exists delivery_location text;

-- ---------------------------------------------------------------------------
-- Tighten the leaky policy. Guests no longer get any direct table access;
-- authenticated owners and admins are unaffected.
-- ---------------------------------------------------------------------------
drop policy if exists "orders_select_own_guest_or_admin" on orders;
create policy "orders_select_own_or_admin" on orders
  for select using (customer_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- Shared JSON formatter — mirrors the exact shape src/services/api/mappers.js
-- (ORDER_SELECT / mapOrder) already expects on the frontend, so orderService.js
-- can feed either a direct table row or this function's output through the
-- same mapOrder() unchanged.
-- ---------------------------------------------------------------------------
create or replace function order_to_json(o orders)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', o.id,
    'ticket_number', o.ticket_number,
    'customer_id', o.customer_id,
    'guest_name', o.guest_name,
    'delivery_date', o.delivery_date,
    'delivery_location', o.delivery_location,
    'status', o.status,
    'total', o.total,
    'payment_proof_url', o.payment_proof_url,
    'created_at', o.created_at,
    'order_suborders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', so.id,
        'vendor_id', so.vendor_id,
        'vendors', jsonb_build_object('name', v.name),
        'status', so.status,
        'payment_status', so.payment_status,
        'subtotal', so.subtotal,
        'collection_time', so.collection_time,
        'notes', so.notes,
        'order_items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'meal_id', oi.meal_id,
            'meal_name', oi.meal_name,
            'qty', oi.qty,
            'price', oi.price
          ))
          from order_items oi
          where oi.suborder_id = so.id
        ), '[]'::jsonb)
      ))
      from order_suborders so
      join vendors v on v.id = so.vendor_id
      where so.order_id = o.id
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- get_guest_order_json — fetch one guest order by its internal id (the id is
-- a 122-bit random UUID, effectively unguessable; this is the "same device /
-- same session, right after checkout or on refresh" path). Refuses to return
-- anything for an order that actually belongs to a signed-in customer.
-- ---------------------------------------------------------------------------
create or replace function get_guest_order_json(p_order_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select order_to_json(o) from orders o
  where o.id = p_order_id and o.customer_id is null;
$$;

grant execute on function get_guest_order_json(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_guest_orders_json — batch version for "your orders on this device"
-- (src/utils/guest.js already only ever holds ids the browser itself created).
-- ---------------------------------------------------------------------------
create or replace function get_guest_orders_json(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(order_to_json(o) order by o.created_at desc), '[]'::jsonb)
  from orders o
  where o.id = any(p_ids) and o.customer_id is null;
$$;

grant execute on function get_guest_orders_json(uuid[]) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- get_guest_order_by_ticket_json — cross-device tracking. Requires BOTH the
-- ticket code and the contact the guest originally gave — this is the
-- "order code + mobile number" second factor the audit called for. A wrong
-- guess on either returns nothing; there is no way to enumerate orders
-- through this function, only to confirm one you already believe is yours.
-- ---------------------------------------------------------------------------
create or replace function get_guest_order_by_ticket_json(p_ticket_number text, p_contact text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select order_to_json(o)
  from orders o
  where o.customer_id is null
    and o.ticket_number = upper(trim(p_ticket_number))
    and o.guest_contact = trim(p_contact);
$$;

grant execute on function get_guest_order_by_ticket_json(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- ANOTHER LIVE BUG FOUND BY THIS AUDIT, unrelated to the guest-read issue
-- above but just as severe: orders_update_admin_only only ever let an admin
-- UPDATE the orders table. attachPaymentProof() in orderService.js — called
-- by the CUSTOMER (guest or logged-in) right after uploading proof of
-- payment — does exactly that update. Postgres RLS silently drops
-- non-matching rows on UPDATE rather than raising an error, so this call has
-- been completing "successfully" (no thrown error, toast says "submitted for
-- verification") while writing nothing at all: payment_proof_url and status
-- never actually changed, and the order never enters the admin verification
-- queue. Every customer who has ever tried to pay for a real order has
-- likely hit this — it's worth checking whether any live orders are stuck at
-- pending_payment despite the customer believing they'd paid.
--
-- Fixed the same way as the read path: a narrow SECURITY DEFINER function
-- that can only move a SPECIFIC order (by id) from pending_payment to
-- payment_submitted, only for that order's own customer/guest, and only
-- ever touches payment_proof_url/status/payment_status — nothing else the
-- caller sends is applied, which also closes off the "browser sets
-- payment_status = paid directly" risk called out for the PayFast work.
-- ---------------------------------------------------------------------------
create or replace function submit_payment_proof(p_order_id uuid, p_proof_path text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders;
begin
  select * into v_order from orders where id = p_order_id;

  if v_order.id is null then
    raise exception 'Order not found';
  end if;

  if v_order.customer_id is not null and v_order.customer_id is distinct from auth.uid() then
    raise exception 'Not authorized for this order';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'This order is not awaiting payment';
  end if;

  update orders
    set payment_proof_url = p_proof_path, status = 'payment_submitted'
    where id = p_order_id;

  update order_suborders
    set status = 'payment_submitted', payment_status = 'verifying'
    where order_id = p_order_id;

  return (select order_to_json(o) from orders o where o.id = p_order_id);
end;
$$;

grant execute on function submit_payment_proof(uuid, text) to anon, authenticated;
