-- ============================================================================
-- OfficeBites — support schema (Phase 3 of Supabase migration)
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- src/services/supportService.js previously kept tickets, FAQs, guides, and
-- feedback in a plain in-memory array (ticketStore/feedbackStore/faqs/guides)
-- — meaning every ticket, FAQ, and guide vanished on every server restart or
-- redeploy, and admins had no way to see or reply to a ticket at all. This
-- migration gives all four a real home so they survive deploys and are
-- actually visible to your support/admin team.
-- ============================================================================

do $$ begin create type ticket_status as enum ('open', 'pending', 'resolved'); exception when duplicate_object then null; end $$;
do $$ begin create type ticket_priority as enum ('low', 'medium', 'high'); exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- support_tickets — one row per contact-support / report-a-problem submission.
-- requester_id is null for a guest submission (name/email captured directly).
-- ---------------------------------------------------------------------------
create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  requester_id uuid references profiles(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  subject text not null,
  category text not null,
  priority ticket_priority not null default 'medium',
  status ticket_status not null default 'open',
  meta jsonb not null default '{}'::jsonb, -- device/browser/os for bug reports, etc.
  attachment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_requester_id_idx on support_tickets (requester_id);

-- ---------------------------------------------------------------------------
-- support_ticket_messages — the back-and-forth thread on a ticket.
-- sender_role distinguishes the requester's own messages from support/admin
-- replies, independent of whether sender_id can be resolved to a profile.
-- ---------------------------------------------------------------------------
create table if not exists support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  sender_role text not null default 'user' check (sender_role in ('user', 'agent')),
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_ticket_messages_ticket_id_idx on support_ticket_messages (ticket_id);

create or replace function touch_ticket_on_message()
returns trigger as $$
begin
  update support_tickets set updated_at = now() where id = new.ticket_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists support_ticket_messages_touch_ticket on support_ticket_messages;
create trigger support_ticket_messages_touch_ticket
  after insert on support_ticket_messages
  for each row execute function touch_ticket_on_message();

-- ---------------------------------------------------------------------------
-- faqs — admin-authored help content.
-- ---------------------------------------------------------------------------
create table if not exists faqs (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  answer text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (category, question)
);

-- ---------------------------------------------------------------------------
-- guides — longer-form help articles.
-- ---------------------------------------------------------------------------
create table if not exists guides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  content text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (title)
);

-- ---------------------------------------------------------------------------
-- feedback — general app feedback (not a support ticket, no reply thread).
-- ---------------------------------------------------------------------------
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  comment text,
  recommend boolean,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table support_tickets enable row level security;
alter table support_ticket_messages enable row level security;
alter table faqs enable row level security;
alter table guides enable row level security;
alter table feedback enable row level security;

-- support_tickets: the signed-in requester sees their own; admins see/update
-- all. Guests can create a ticket (requester_id null) same trust model as
-- guest orders, but can't list tickets back — matches "guest order" pattern.
drop policy if exists "tickets_select_own_or_admin" on support_tickets;
create policy "tickets_select_own_or_admin" on support_tickets
  for select using (requester_id = auth.uid() or is_admin());
drop policy if exists "tickets_insert_own_or_guest" on support_tickets;
create policy "tickets_insert_own_or_guest" on support_tickets
  for insert with check (requester_id = auth.uid() or requester_id is null);
drop policy if exists "tickets_update_admin_only" on support_tickets;
create policy "tickets_update_admin_only" on support_tickets
  for update using (is_admin());

-- support_ticket_messages: visible to the ticket's own requester or an admin;
-- the requester can only post as themselves, an admin can reply as 'agent'.
drop policy if exists "ticket_messages_select_own_or_admin" on support_ticket_messages;
create policy "ticket_messages_select_own_or_admin" on support_ticket_messages
  for select using (
    is_admin()
    or exists (select 1 from support_tickets t where t.id = ticket_id and t.requester_id = auth.uid())
  );
drop policy if exists "ticket_messages_insert_own_or_admin" on support_ticket_messages;
create policy "ticket_messages_insert_own_or_admin" on support_ticket_messages
  for insert with check (
    is_admin()
    or (
      sender_role = 'user'
      and exists (select 1 from support_tickets t where t.id = ticket_id and t.requester_id = auth.uid())
    )
  );

-- faqs / guides: public read (including guests); only admins manage content.
drop policy if exists "faqs_select_public" on faqs;
create policy "faqs_select_public" on faqs for select using (true);
drop policy if exists "faqs_write_admin_only" on faqs;
create policy "faqs_write_admin_only" on faqs for all using (is_admin()) with check (is_admin());

drop policy if exists "guides_select_public" on guides;
create policy "guides_select_public" on guides for select using (true);
drop policy if exists "guides_write_admin_only" on guides;
create policy "guides_write_admin_only" on guides for all using (is_admin()) with check (is_admin());

-- feedback: anyone can submit (including guests, user_id null); only the
-- author or an admin can read it back.
drop policy if exists "feedback_insert_any" on feedback;
create policy "feedback_insert_any" on feedback
  for insert with check (user_id = auth.uid() or user_id is null);
drop policy if exists "feedback_select_own_or_admin" on feedback;
create policy "feedback_select_own_or_admin" on feedback
  for select using (user_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- Storage bucket for ticket attachments (screenshots, proof for bug reports).
-- Same trust model as payment-proofs: anyone (including guests) can attach
-- one when filing a ticket, but only the ticket's own requester or an admin
-- can read it back.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;

drop policy if exists "anyone_can_upload_support_attachment" on storage.objects;
create policy "anyone_can_upload_support_attachment" on storage.objects
  for insert with check (bucket_id = 'support-attachments');
drop policy if exists "owner_or_admin_read_support_attachments" on storage.objects;
create policy "owner_or_admin_read_support_attachments" on storage.objects
  for select using (
    bucket_id = 'support-attachments'
    and (is_admin() or (auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text))
  );

-- ---------------------------------------------------------------------------
-- Seed a starter set of FAQs and guides so the Help pages aren't empty on
-- day one — edit/expand these directly in the table once you're live.
-- ---------------------------------------------------------------------------
insert into faqs (category, question, answer, sort_order) values
  ('Orders', 'How do I place an order?', 'Browse vendors, add meals to your cart, then check out. You can order from multiple vendors in one checkout — we split it into separate tickets per vendor automatically.', 1),
  ('Orders', 'Can I order without creating an account?', 'Yes — guest checkout is available. You''ll get a ticket link to track your order; creating an account lets you save order history and favourites across devices.', 2),
  ('Payments', 'What payment methods are supported?', 'Upload proof of payment after checkout (e.g. an EFT screenshot). Our team verifies it and confirms your order once payment is checked.', 1),
  ('Payments', 'How long does payment verification take?', 'Most payments are verified within a few hours during business hours. You''ll get a notification the moment it''s confirmed.', 2),
  ('Account', 'How do I reset my password?', 'Use the "Forgot password" link on the sign-in page to receive a reset email.', 1),
  ('Vendor Support', 'How do I become a vendor on OfficeBites?', 'Register with a vendor account — our admin team reviews and approves new vendors before your storefront goes live.', 1),
  ('Technical Issues', 'The app isn''t loading properly, what should I do?', 'Try refreshing the page or clearing your browser cache. If the issue continues, use Report a Problem so our team can investigate.', 1)
on conflict do nothing;

insert into guides (title, summary, content, sort_order) values
  ('Getting started as a customer', 'How to browse vendors, order lunch, and track your ticket.', 'Create an account or continue as a guest, browse vendors near your building, add meals to your cart, and check out. After checkout, upload proof of payment — once verified, you''ll get a ticket number to track your order right through to collection.', 1),
  ('Getting started as a vendor', 'Setting up your storefront after admin approval.', 'Once your vendor account is approved by an OfficeBites admin, head to your Vendor dashboard to add menu items, set your operating hours, and start receiving orders. New orders appear in Orders — move each through the pipeline from Confirmed to Completed as you prepare and hand it over.', 2),
  ('Understanding order statuses', 'What each stage of the order pipeline means.', 'Orders move through: Pending payment → Payment submitted → Confirmed → Accepted → Preparing → Ready → Collected → Completed. Each step only allows moving forward one stage at a time, so you always know exactly where an order stands.', 3)
on conflict do nothing;
