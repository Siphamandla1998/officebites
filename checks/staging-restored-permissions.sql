-- PREPARED LOCAL DISPOSABLE RESTORE TEST ONLY. Never run on hosted Supabase.
-- psql must use --no-psqlrc --set ON_ERROR_STOP=1; no ignored errors.
BEGIN READ ONLY;
DO $$ BEGIN
 IF host(inet_server_addr()) IS DISTINCT FROM '127.0.0.1' OR inet_server_port() IS DISTINCT FROM 55443
 OR current_database() !~ '^officebites_restore_disposable_[0-9]+$'
 THEN RAISE EXCEPTION 'Verified disposable loopback restore required'; END IF;
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled)
 THEN RAISE EXCEPTION 'Restored payment control unexpectedly open'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.is_admin() THEN RAISE EXCEPTION 'Empty claims obtained admin'; END IF;
 IF has_table_privilege(current_user,'private.vendor_payment_profiles','SELECT')
 OR has_table_privilege(current_user,'private.manual_order_payments','UPDATE')
 THEN RAISE EXCEPTION 'Private records directly accessible'; END IF;
 BEGIN
  PERFORM 1 FROM private.vendor_payment_profiles LIMIT 1;
  RAISE EXCEPTION 'Expected private-table permission denial';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.orders) THEN RAISE EXCEPTION 'Empty-identity customer can see orders'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF has_function_privilege(current_user,'public.verify_manual_payment(uuid,numeric,text,boolean)','EXECUTE')
 OR has_function_privilege(current_user,'public.approve_vendor_payment_profile(uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous privileged RPC execution'; END IF;
 BEGIN
  PERFORM 1 FROM private.manual_order_payments LIMIT 1;
  RAISE EXCEPTION 'Expected anonymous private-table denial';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
-- A clean exit is the expected result. No orders, payment events or acceptance created.
