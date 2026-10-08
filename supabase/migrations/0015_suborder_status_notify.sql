-- ============================================================================
-- OfficeBites — notify customer on vendor order-status change
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- GAP FOUND: orderService.updateSubOrderStatus() (called from
-- VendorOrders.jsx whenever a vendor advances their suborder through
-- Received -> Preparing -> Ready/Done) only ever ran two raw
-- `.update()` calls against order_suborders / orders. It never created a
-- notification, so customers were never told their order had been
-- accepted, was being prepared, or was ready — despite the QA brief
-- explicitly requiring this.
--
-- This can't just be "add a notifications insert in the JS", the way it
-- might look at first: the caller here is the VENDOR, and
-- notifications_insert_own_or_admin only allows
-- `user_id = auth.uid() or is_admin()`. A vendor is neither the customer
-- (auth.uid() <> customer's id) nor an admin, so a client-side insert
-- targeting the customer's user_id would just 403, the same class of bug
-- as the admin-payment-approval notification issue. The existing
-- payment RPCs (submit_payment_proof, confirm_payfast_payment) already
-- establish the right pattern for this: a narrow SECURITY DEFINER
-- function that does its OWN authorization check instead of relying on
-- the caller's own RLS grants, then performs the privileged write.
-- ============================================================================

create or replace function update_suborder_status_and_notify(
  p_order_id uuid,
  p_next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor_id uuid;
  v_vendor_name text;
  v_customer_id uuid;
  v_ticket text;
  v_all_at_status boolean;
begin
  v_vendor_id := current_vendor_id();
  if v_vendor_id is null then
    raise exception 'Not authorized: current user is not a vendor';
  end if;

  -- Authorization: the row must belong to THIS vendor. Existence + ownership
  -- are checked together so a vendor can't probe for other vendors' order
  -- ids via the error message.
  if not exists (
    select 1 from order_suborders
    where order_id = p_order_id and vendor_id = v_vendor_id
  ) then
    raise exception 'Suborder not found for this vendor';
  end if;

  -- The actual transition validity (must be exactly one step forward) is
  -- enforced by the existing order_suborders_status_guard trigger — this
  -- update will simply fail with that trigger's own exception if the move
  -- isn't legal, so it isn't duplicated here.
  update order_suborders
    set status = p_next_status
    where order_id = p_order_id and vendor_id = v_vendor_id;

  -- Advance the parent order only once every vendor on it has reached this
  -- same status — same "all suborders agree" rule the client used.
  select bool_and(status = p_next_status) into v_all_at_status
  from order_suborders
  where order_id = p_order_id;

  if v_all_at_status then
    update orders set status = p_next_status where id = p_order_id;
  end if;

  select o.customer_id, o.ticket_number, v.name
    into v_customer_id, v_ticket, v_vendor_name
    from orders o
    join vendors v on v.id = v_vendor_id
    where o.id = p_order_id;

  -- Guest orders have no customer_id and nobody to notify — the guest sees
  -- status changes on their tracking page instead.
  if v_customer_id is not null then
    insert into notifications (user_id, type, title, body)
    values (
      v_customer_id,
      'order_status',
      case p_next_status
        when 'accepted' then 'Order accepted'
        when 'preparing' then 'Order is being prepared'
        when 'ready' then 'Order ready for collection'
        when 'collected' then 'Order collected'
        when 'completed' then 'Order completed'
        else 'Order update'
      end,
      format('%s: %s (%s)', v_vendor_name, initcap(replace(p_next_status, '_', ' ')), v_ticket)
    );
  end if;

  return jsonb_build_object('success', true, 'status', p_next_status);
end;
$$;

grant execute on function update_suborder_status_and_notify(uuid, text) to authenticated;
