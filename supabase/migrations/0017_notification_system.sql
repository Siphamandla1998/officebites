-- ============================================================================
-- OfficeBites — Notification System
--
-- Adds:
--   1. Notification navigation metadata
--   2. Automatic customer <-> vendor chat notifications
--   3. Automatic support-agent reply notifications
--   4. notifications table to Supabase Realtime
--
-- Existing order-status notifications remain handled by
-- update_suborder_status_and_notify().
--
-- Existing triggers:
--   messages_touch_conversation
--   support_ticket_message_touch
-- are intentionally left untouched.
-- ============================================================================


-- ============================================================================
-- 1. NOTIFICATION NAVIGATION DATA
-- ============================================================================

alter table public.notifications
  add column if not exists action_url text;

alter table public.notifications
  add column if not exists metadata jsonb not null default '{}'::jsonb;


-- ============================================================================
-- 2. CHAT MESSAGE NOTIFICATIONS
--
-- conversations.vendor_id identifies the vendor BUSINESS.
-- vendors.owner_id identifies the authenticated vendor USER.
--
-- Therefore:
--
-- customer sends message
--     -> notify vendors.owner_id
--
-- vendor owner sends message
--     -> notify conversations.customer_id
--
-- Any unexpected sender is ignored defensively.
-- ============================================================================

create or replace function public.notify_chat_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_customer_id uuid;
  v_vendor_id uuid;
  v_vendor_owner_id uuid;
  v_vendor_name text;
  v_recipient_id uuid;
  v_sender_name text;
begin

  select
    c.customer_id,
    c.vendor_id,
    v.owner_id,
    v.name
  into
    v_customer_id,
    v_vendor_id,
    v_vendor_owner_id,
    v_vendor_name
  from public.conversations c
  join public.vendors v
    on v.id = c.vendor_id
  where c.id = new.conversation_id;


  -- Conversation disappeared or vendor relationship is invalid.
  if v_customer_id is null or v_vendor_id is null then
    return new;
  end if;


  -- Customer -> vendor.
  if new.sender_id = v_customer_id then

    v_recipient_id := v_vendor_owner_id;


  -- Vendor -> customer.
  elsif new.sender_id = v_vendor_owner_id then

    v_recipient_id := v_customer_id;


  -- Sender isn't one of the conversation participants.
  else

    return new;

  end if;


  -- Vendor may theoretically have no owner_id.
  if v_recipient_id is null then
    return new;
  end if;


  -- Never notify the sender about their own message.
  if v_recipient_id = new.sender_id then
    return new;
  end if;


  select coalesce(p.name, 'OfficeBites user')
  into v_sender_name
  from public.profiles p
  where p.id = new.sender_id;


  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    action_url,
    metadata
  )
  values (
    v_recipient_id,

    'message',

    case
      when new.sender_id = v_customer_id
        then 'New customer message'
      else 'New message from ' || coalesce(v_vendor_name, 'your vendor')
    end,

    case
      when new.sender_id = v_customer_id
        then coalesce(v_sender_name, 'A customer') || ' sent you a message'
      else coalesce(v_vendor_name, 'A vendor') || ' sent you a message'
    end,

    '/chat/' || new.conversation_id::text,

    jsonb_build_object(
      'conversationId', new.conversation_id,
      'senderId', new.sender_id,
      'vendorId', v_vendor_id
    )
  );


  return new;

end;
$function$;


drop trigger if exists messages_notify_recipient
  on public.messages;

create trigger messages_notify_recipient
  after insert on public.messages
  for each row
  execute function public.notify_chat_recipient();


-- ============================================================================
-- 3. SUPPORT REPLY NOTIFICATIONS
--
-- support_ticket_messages.sender_role:
--
--   user  = customer/requester
--   agent = OfficeBites support/admin
--
-- Only agent replies notify the customer.
--
-- Guest support tickets have requester_id = NULL and therefore cannot receive
-- authenticated in-app notifications.
-- ============================================================================

create or replace function public.notify_support_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_requester_id uuid;
  v_ticket_number text;
begin

  if new.sender_role <> 'agent' then
    return new;
  end if;


  select
    t.requester_id,
    t.ticket_number
  into
    v_requester_id,
    v_ticket_number
  from public.support_tickets t
  where t.id = new.ticket_id;


  -- Guest tickets do not have an authenticated notification recipient.
  if v_requester_id is null then
    return new;
  end if;


  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    action_url,
    metadata
  )
  values (
    v_requester_id,

    'support',

    'Support replied',

    'OfficeBites Support replied to ticket ' ||
      coalesce(v_ticket_number, ''),

    '/help/tickets',

    jsonb_build_object(
      'ticketId', new.ticket_id,
      'ticketNumber', v_ticket_number
    )
  );


  return new;

end;
$function$;


drop trigger if exists support_messages_notify_requester
  on public.support_ticket_messages;

create trigger support_messages_notify_requester
  after insert on public.support_ticket_messages
  for each row
  execute function public.notify_support_reply();


-- ============================================================================
-- 4. REALTIME
--
-- Publish ONLY notifications for now.
--
-- We deliberately do not publish orders/messages/etc. globally. The
-- notification stream becomes the lightweight event channel for the
-- authenticated OfficeBites user.
-- ============================================================================

do $$
begin

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then

    alter publication supabase_realtime
      add table public.notifications;

  end if;

end
$$;