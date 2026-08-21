-- ============================================================================
-- OfficeBites — split guest phone/email (Post-launch-test fix)
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- Found via friend-testing (DEF-CUST-004): checkout had one combined
-- "phone or email" field. The original requirements always listed these as
-- two separate items — mobile number required, email optional — the "one
-- simple field" guidance was specifically about delivery location, not
-- contact info. guest_contact (existing column) now holds the phone number
-- specifically, since that's the required field used for order tracking
-- (ticket code + mobile number). guest_email is new and optional.
-- ============================================================================

alter table orders add column if not exists guest_email text;
