-- Local pre-migration production archive only. No production DSN is accepted.
BEGIN READ ONLY;
DO $$ BEGIN
 IF host(inet_server_addr()) IS DISTINCT FROM '127.0.0.1'
 OR inet_server_port() IS DISTINCT FROM 55443
 OR current_setting('data_directory')<>'/restore/data'
 OR current_database() !~ '^officebites_production_restore_disposable_[0-9]+$'
 THEN RAISE EXCEPTION 'Offline disposable production-archive restore required'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>38
 OR (SELECT max(version) FROM supabase_migrations.schema_migrations)<>'20261010101910'
 THEN RAISE EXCEPTION 'Reviewed pre-migration archive expected; reconcile any legitimate drift'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF public.is_admin() THEN RAISE EXCEPTION 'Empty claims obtained admin'; END IF;
 IF EXISTS(SELECT 1 FROM public.orders) OR EXISTS(SELECT 1 FROM public.profiles)
 THEN RAISE EXCEPTION 'Empty identity can read protected orders/profiles'; END IF;
END $$;
ROLLBACK;
