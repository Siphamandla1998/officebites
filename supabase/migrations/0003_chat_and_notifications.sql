-- ============================================================================
-- OfficeBites — chat & notifications schema (Phase 2 of Supabase migration)
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- src/services/chatService.js and src/services/notificationService.js were
-- already rewritten to talk to Supabase tables named `conversations`,
-- `messages`, and `notifications` — but those tables were never created in
-- 0001_core_schema.sql, which explicitly left them "on the local mock layer
-- for now". That gap is the root cause of every broken chat/notification
-- feature in the app (every call from those two services 404s against
-- PostgREST with "relation does not exist"). This migration closes the gap
-- so the existing service code — which is otherwise correct — actually has
-- somewhere to read/write.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- conversations — one thread per (customer, vendor) pair.
-- ---------------------------------------------------------------------------
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, vendor_id)
);

-- ---------------------------------------------------------------------------
-- messages — belongs to a conversation; sender_id is whichever profile
-- (customer or vendor owner) sent it.
-- ---------------------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on messages (conversation_id);

-- Keep conversations.updated_at current so "most recent" ordering in
-- chatService.getConversations() reflects the latest message.
create or replace function touch_conversation_on_message()
returns trigger as $$
begin
  update conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists messages_touch_conversation on messages;
create trigger messages_touch_conversation
  after insert on messages
  for each row execute function touch_conversation_on_message();

-- ---------------------------------------------------------------------------
-- notifications — one row per user (customer or vendor). notificationService.js
-- writes to this table for order/payment events and reads it back filtered
-- by the signed-in user.
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null default 'general',
  title text not null,
  body text,
  read boolean not null default false,
  dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table conversations enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;

-- conversations: visible to the customer who started it, the owning vendor
-- (via current_vendor_id(), same helper the orders tables already use), or
-- an admin.
drop policy if exists "conversations_select_participant_or_admin" on conversations;
create policy "conversations_select_participant_or_admin" on conversations
  for select using (
    customer_id = auth.uid()
    or vendor_id = current_vendor_id()
    or is_admin()
  );
drop policy if exists "conversations_insert_customer" on conversations;
create policy "conversations_insert_customer" on conversations
  for insert with check (customer_id = auth.uid());
drop policy if exists "conversations_update_participant_or_admin" on conversations;
create policy "conversations_update_participant_or_admin" on conversations
  for update using (
    customer_id = auth.uid()
    or vendor_id = current_vendor_id()
    or is_admin()
  );

-- messages: visible/writable only to the two participants of the parent
-- conversation (or an admin); you can only send as yourself.
drop policy if exists "messages_select_participant_or_admin" on messages;
create policy "messages_select_participant_or_admin" on messages
  for select using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.customer_id = auth.uid() or c.vendor_id = current_vendor_id() or is_admin())
    )
  );
drop policy if exists "messages_insert_participant" on messages;
create policy "messages_insert_participant" on messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.customer_id = auth.uid() or c.vendor_id = current_vendor_id())
    )
  );
drop policy if exists "messages_update_participant_or_admin" on messages;
create policy "messages_update_participant_or_admin" on messages
  for update using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.customer_id = auth.uid() or c.vendor_id = current_vendor_id() or is_admin())
    )
  );

-- notifications: fully private to the owning user; admins (and the backend,
-- via createNotificationForUser in orderService.js) can create notifications
-- for any user — e.g. an admin verifying payment needs to notify the
-- customer and vendor, not themselves.
drop policy if exists "notifications_select_own_or_admin" on notifications;
create policy "notifications_select_own_or_admin" on notifications
  for select using (user_id = auth.uid() or is_admin());
drop policy if exists "notifications_insert_own_or_admin" on notifications;
create policy "notifications_insert_own_or_admin" on notifications
  for insert with check (user_id = auth.uid() or is_admin());
drop policy if exists "notifications_update_own_or_admin" on notifications;
create policy "notifications_update_own_or_admin" on notifications
  for update using (user_id = auth.uid() or is_admin());


-- ---------------------------------------------------------------------------
-- Secure payment-proof submission.
-- The client must not receive a general UPDATE policy on orders: that would
-- let a customer/guest change totals or statuses. This function validates the
-- order owner (or guest ticket number) and the storage path before changing
-- only the payment fields.
-- ---------------------------------------------------------------------------
create or replace function submit_payment_proof(
  p_order_id uuid,
  p_proof_path text,
  p_ticket_number text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status order_status;
  order_customer uuid;
  order_ticket text;
begin
  if p_proof_path is null or p_proof_path not like p_order_id::text || '/%' then
    raise exception 'Invalid payment proof path';
  end if;

  select status, customer_id, ticket_number
    into current_status, order_customer, order_ticket
  from orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if not (
    order_customer = auth.uid()
    or (order_customer is null and p_ticket_number is not null and order_ticket = p_ticket_number)
  ) then
    raise exception 'You are not allowed to submit payment for this order';
  end if;

  if current_status <> 'pending_payment' then
    raise exception 'Payment can only be submitted for an order awaiting payment';
  end if;

  update orders
  set payment_proof_url = p_proof_path,
      status = 'payment_submitted'
  where id = p_order_id;

  update order_suborders
  set status = 'payment_submitted',
      payment_status = 'verifying'
  where order_id = p_order_id;
end;
$$;

grant execute on function submit_payment_proof(uuid, text, text) to anon, authenticated;
