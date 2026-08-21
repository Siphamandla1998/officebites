-- ============================================================================
-- OfficeBites — admin chat monitoring + deletion
-- Run this in the Supabase SQL editor, or via `supabase db push`.
--
-- conversations already has SELECT/INSERT/UPDATE policies covering admin
-- (see the chat-and-notifications migration), but no DELETE policy exists
-- at all — meaning nobody, including admin, can currently delete a
-- conversation through the client; Postgres RLS defaults to deny for any
-- command with no matching policy. This adds admin-only delete access.
-- messages already cascade-delete when their parent conversation is
-- removed (on delete cascade from the original schema), so deleting the
-- conversation row is enough to erase the whole thread.
-- ============================================================================

create policy "conversations_delete_admin_only" on conversations
  for delete using (is_admin());

-- ---------------------------------------------------------------------------
-- Optional: true automatic erasure instead of admin-triggered. This function
-- deletes any conversation whose most recent message is 5+ days old
-- (messages cascade-delete with their conversation automatically).
--
-- To actually run this on a schedule, enable the pg_cron extension in your
-- Supabase project (Database → Extensions) and schedule it — e.g. daily at
-- 3am:
--
--   select cron.schedule(
--     'erase-old-chats',
--     '0 3 * * *',
--     $$ select erase_old_conversations(); $$
--   );
--
-- I can't enable extensions or schedule jobs from here — that's a dashboard
-- action only you can take. Until you do, chats stay exactly as the admin
-- page above already handles them: visible and manually erasable once
-- 5+ days old, nothing deleted automatically.
-- ---------------------------------------------------------------------------

create or replace function erase_old_conversations()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Not authorised to erase old conversations';
  end if;

  delete from conversations c
  where c.id in (
    select c2.id
    from conversations c2
    left join messages m on m.conversation_id = c2.id
    group by c2.id, c2.updated_at
    having coalesce(max(m.created_at), c2.updated_at) < now() - interval '5 days'
  );
end;
$$;

revoke all on function erase_old_conversations() from public;
grant execute on function erase_old_conversations() to authenticated;
