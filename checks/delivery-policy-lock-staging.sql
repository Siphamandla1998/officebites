-- Receiver for the staging-only two-session lock check. No rows are written.
BEGIN;
SET LOCAL lock_timeout='500ms';
DO $$ DECLARE blocked boolean:=false; BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='officebites-central-origin-lock-check' AND wait_event='PgSleep') THEN RAISE EXCEPTION 'Lock-holder session is not ready; test not performed'; END IF;
 BEGIN PERFORM public.quote_delivery('{}','[]',NULL); EXCEPTION WHEN lock_not_available THEN blocked:=true; END;
 PERFORM set_config('officebites.origin_lock_qa',jsonb_build_object('passed',blocked,'test','Quote waits for concurrent policy editor; timeout caught, no data writes')::text,true);
END $$;
SELECT current_setting('officebites.origin_lock_qa')::jsonb policy_lock_result;
ROLLBACK;
