-- ============================================================================
-- OfficeBites — meal day-of-week scheduling ("food timetable")
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- Vendors don't cook every dish every day. This lets a meal be scheduled to
-- specific weekdays (e.g. grilled chicken only on Fridays) instead of being
-- orderable every day by default.
--
-- available_days is an array of ints, 0=Sunday..6=Saturday. NULL or an empty
-- array means "every day" — this is the backward-compatible default, so
-- every existing meal keeps working exactly as before until a vendor
-- deliberately schedules it.
-- ============================================================================

alter table meals add column if not exists available_days smallint[];
