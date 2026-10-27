-- ============================================================================
-- OfficeBites — vendor visibility into ordering customer's name
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- Found while verifying the previous vendor-order-visibility fix (0007):
-- ORDER_SELECT embeds `profiles ( name )` on every order (customer_id ->
-- profiles.id) so the app can show who placed the order. profiles' only
-- SELECT policy is `id = auth.uid() or is_admin()` — a vendor is neither,
-- so that embed silently returns nothing for a vendor's query. mapOrder()
-- then falls through its `profiles?.name || guest_name || "Guest"` chain
-- straight to "Guest" — meaning every order from a real, logged-in
-- customer displays as "Guest" to the vendor fulfilling it, with no error
-- to indicate anything is wrong.
--
-- Fix: let a vendor read a customer's profile row only when that customer
-- has an actual order with them — narrowly scoped, not "vendors can browse
-- all customer profiles". The app's own query only ever selects the `name`
-- column through this embed, so nothing beyond a name is actually exposed
-- in practice even though the RLS grant is at the row level.
-- ============================================================================

create policy "profiles_select_by_vendor_for_own_orders" on profiles
  for select using (
    exists (
      select 1 from orders o
      join order_suborders so on so.order_id = o.id
      where o.customer_id = profiles.id and so.vendor_id = current_vendor_id()
    )
  );
