-- OfficeBites production fixes for existing installations.
-- Run after 0001_core_schema.sql, 0003_chat_and_notifications.sql and 0004_support.sql.

-- Keep the database order transition guard aligned with the payment lifecycle.
insert into order_flow (status, step) values
  ('pending_payment', 1), ('payment_submitted', 2), ('confirmed', 3),
  ('accepted', 4), ('preparing', 5), ('ready', 6), ('collected', 7), ('completed', 8)
on conflict (status) do update set step = excluded.step;

create or replace function enforce_order_status_transition()
returns trigger as $$
declare
  old_step int;
  new_step int;
begin
  if new.status = old.status then return new; end if;
  if old.status = 'cancelled' then
    raise exception 'Cannot change status of a cancelled order';
  end if;
  if new.status = 'cancelled' then
    return new;
  end if;
  select step into old_step from order_flow where status = old.status;
  select step into new_step from order_flow where status = new.status;
  if old_step is null or new_step is null or new_step <> old_step + 1 then
    raise exception 'Invalid status transition: % -> %', old.status, new.status;
  end if;
  return new;
end;
$$ language plpgsql;

-- Vendors may edit their storefront, but only admins may change approval status.
create or replace function protect_vendor_status()
returns trigger as $$
begin
  if new.status is distinct from old.status and not is_admin() then
    raise exception 'Only an admin can change vendor status';
  end if;
  if new.owner_id is distinct from old.owner_id and not is_admin() then
    raise exception 'Only an admin can change vendor ownership';
  end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists protect_vendor_status_trigger on vendors;
create trigger protect_vendor_status_trigger
before update on vendors for each row execute function protect_vendor_status();

-- Users cannot promote themselves, change vendor linkage, or clear a suspension.
create or replace function protect_profile_privileged_fields()
returns trigger as $$
begin
  if not is_admin() and (
    new.role is distinct from old.role
    or new.vendor_id is distinct from old.vendor_id
    or new.suspended is distinct from old.suspended
  ) then
    raise exception 'Only an admin can change protected profile fields';
  end if;
  return new;
end;
$$ language plpgsql;
drop trigger if exists protect_profile_privileged_fields_trigger on profiles;
create trigger protect_profile_privileged_fields_trigger
before update on profiles for each row execute function protect_profile_privileged_fields();

-- Vendors must be able to see their own customer-facing orders, while admins
-- retain full access. Guest-order visibility remains the existing ticket/UUID
-- model and should be replaced by a signed token before public launch.
drop policy if exists "orders_select_own_guest_or_admin" on orders;
create policy "orders_select_own_guest_or_admin" on orders
for select using (
  customer_id = auth.uid()
  or is_admin()
  or exists (select 1 from order_suborders so where so.order_id = orders.id and so.vendor_id = current_vendor_id())
  or customer_id is null
);

-- Rerunnable policy creation for chat and notifications.
drop policy if exists "conversations_select_participant_or_admin" on conversations;
create policy "conversations_select_participant_or_admin" on conversations for select using (customer_id = auth.uid() or vendor_id = current_vendor_id() or is_admin());
drop policy if exists "conversations_insert_customer" on conversations;
create policy "conversations_insert_customer" on conversations for insert with check (customer_id = auth.uid());
drop policy if exists "conversations_update_participant_or_admin" on conversations;
create policy "conversations_update_participant_or_admin" on conversations for update using (customer_id = auth.uid() or vendor_id = current_vendor_id() or is_admin());

-- Avoid a broad messages UPDATE permission: the existing client only needs to
-- mark incoming messages read. The policy still allows participant updates,
-- so keep this as an interim guard until a mark-message-read RPC is introduced.
drop policy if exists "messages_update_participant_or_admin" on messages;
create policy "messages_update_participant_or_admin" on messages for update using (exists (select 1 from conversations c where c.id = conversation_id and (c.customer_id = auth.uid() or c.vendor_id = current_vendor_id() or is_admin())));

-- Secure payment proof submission; no general customer UPDATE policy on orders.
create or replace function submit_payment_proof(p_order_id uuid, p_proof_path text, p_ticket_number text default null)
returns void language plpgsql security definer set search_path = public as $$
declare current_status order_status; order_customer uuid; order_ticket text;
begin
  if p_proof_path is null or p_proof_path not like p_order_id::text || '/%' then raise exception 'Invalid payment proof path'; end if;
  select status, customer_id, ticket_number into current_status, order_customer, order_ticket from orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if not (order_customer = auth.uid() or (order_customer is null and p_ticket_number is not null and order_ticket = p_ticket_number)) then raise exception 'You are not allowed to submit payment for this order'; end if;
  if current_status <> 'pending_payment' then raise exception 'Payment can only be submitted for an order awaiting payment'; end if;
  update orders set payment_proof_url = p_proof_path, status = 'payment_submitted' where id = p_order_id;
  update order_suborders set status = 'payment_submitted', payment_status = 'verifying' where order_id = p_order_id;
end;
$$;
grant execute on function submit_payment_proof(uuid, text, text) to anon, authenticated;
