-- ============================================================================
-- OfficeBites — allow vendor-initiated chat, scoped to a real order
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- conversations_insert_customer (migration 0003) only allows
-- `customer_id = auth.uid()` — i.e. only the customer side can create a
-- conversation row. A vendor calling chatService.startConversationAsVendor()
-- would 403 on the insert every time, regardless of whether a legitimate
-- order relationship exists, because no policy at all currently permits a
-- vendor-initiated insert.
--
-- This adds that missing INSERT path — but only for a customer who has
-- actually placed an order involving this vendor, mirroring the same
-- order-relationship check profiles_select_by_vendor_for_own_orders
-- (migration 0011) already uses for profile visibility. A vendor still
-- cannot open a conversation with an unrelated customer; the insert itself
-- is rejected by RLS if the exists() check fails, not merely hidden by the
-- UI — so this can't be bypassed by calling the table directly.
-- ============================================================================

-- NOTE: the exists() subquery below deliberately qualifies the new row's
-- own column as `conversations.customer_id` (not a bare `customer_id`) —
-- `orders` also has a customer_id column, and since it's in the subquery's
-- own FROM list, an unqualified reference would resolve to THAT column
-- instead of the row being inserted, silently collapsing the check to
-- "this vendor has at least one order from anyone" rather than "...from
-- this specific customer". Qualifying by table name is the standard way
-- to reference the row under evaluation from inside an RLS check/using
-- subquery (the same style profiles_select_by_vendor_for_own_orders,
-- migration 0011, uses for `profiles.id`).
create policy "conversations_insert_vendor_with_order" on conversations
  for insert with check (
    vendor_id = current_vendor_id()
    and exists (
      select 1 from orders o
      join order_suborders so on so.order_id = o.id
      where o.customer_id = conversations.customer_id
        and so.vendor_id = current_vendor_id()
    )
  );
