-- ============================================================================
-- OfficeBites — vendor order visibility fix (Production Readiness Pass)
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- CRITICAL FINDING: orders_select_own_guest_or_admin (original migration
-- 0001) was `customer_id = auth.uid() or customer_id is null or is_admin()`.
-- There has never been a vendor clause on the base `orders` table's SELECT
-- policy — only on `order_suborders`/`order_items`. Since orderService.js's
-- ORDER_SELECT embeds suborders/items INTO a query rooted at `orders`,
-- PostgREST still requires the root `orders` row itself to pass its own
-- SELECT policy before any embedded data is returned at all. In practice
-- this meant a vendor calling getOrdersForVendor() could only ever see
-- orders placed by a GUEST (customer_id is null) — any order from a
-- logged-in customer has been invisible to the vendor fulfilling it since
-- this schema was first created.
--
-- migration 0005 (the guest-order-security fix) then tightened that same
-- policy to `customer_id = auth.uid() or is_admin()`, removing the
-- `customer_id is null` clause to close the guest-order data leak. That was
-- the correct fix for guests reading OTHER guests' orders — but it also
-- removed the one path that accidentally let vendors see anything at all,
-- so as of 0005, VendorOrders.jsx and VendorOverview.jsx show zero orders,
-- always, regardless of real order volume.
--
-- FIX: add vendor visibility as its own, correctly-scoped policy — a vendor
-- can see an order if and only if they have a suborder on it. This is
-- additive (Postgres OR's multiple permissive policies together) and
-- doesn't change customer, guest, or admin access at all.
-- ============================================================================

create policy "orders_select_vendor" on orders
  for select using (
    exists (
      select 1 from order_suborders so
      where so.order_id = orders.id and so.vendor_id = current_vendor_id()
    )
  );
