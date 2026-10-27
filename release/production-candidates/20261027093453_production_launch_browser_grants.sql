-- LOCAL REVIEW CANDIDATE ONLY. Not the EFT/legal installer.
-- Generated with Supabase CLI 2.121.0; target identity and installation approval
-- must be independently verified. SQL settings are not project identity proof.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $guard$
DECLARE expected record; actual text; relation_name text;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed postgres ownership required'; END IF;
 IF to_regclass('supabase_migrations.schema_migrations') IS NULL THEN RAISE EXCEPTION 'Production migration ledger required'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>38
 OR (SELECT max(version) FROM supabase_migrations.schema_migrations)<>'20261010101910'
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261010101910' AND name='production_audit_cleanup')
 THEN RAISE EXCEPTION 'Production history changed; re-review before installation'; END IF;
 FOR expected IN SELECT * FROM (VALUES
 ('public.handle_new_user()','086649c1a17a57fbcfde261ea7bdba6a'),
 ('public.guard_vendor_privileged_fields()','405aaa6295945413607a5413a8d965a3'),
 ('public.guard_profile_privileged_fields()','389319aa4e0b30ada46bc315e97afbad')
 ) x(signature,hash) LOOP
  SELECT md5(pg_get_functiondef(to_regprocedure(expected.signature))) INTO actual;
  IF actual IS DISTINCT FROM expected.hash THEN RAISE EXCEPTION 'Production security function changed: %',expected.signature; END IF;
 END LOOP;
 FOREACH relation_name IN ARRAY ARRAY['profiles','vendors','orders','order_suborders','order_items'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=relation_name AND c.relrowsecurity
    AND pg_get_userbyid(c.relowner)='postgres')
  THEN RAISE EXCEPTION 'Unexpected ownership or missing RLS: %',relation_name; END IF;
 END LOOP;
END
$guard$;
-- RLS does not protect whole-table operations. Browser roles do not administer schema.
REVOKE TRUNCATE,TRIGGER,REFERENCES ON ALL TABLES IN SCHEMA public,private FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public,private
 REVOKE TRUNCATE,TRIGGER,REFERENCES ON TABLES FROM PUBLIC,anon,authenticated;
-- Existing onboarding uses definer RPCs/triggers. Revoke BOTH table and column
-- INSERT grants so future permissive policies cannot reopen direct provisioning.
REVOKE INSERT ON public.profiles,public.vendors FROM PUBLIC,anon,authenticated;
DO $columns$
DECLARE r record;
BEGIN
 FOR r IN SELECT n.nspname,c.relname,a.attname FROM pg_attribute a
 JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN('profiles','vendors') AND a.attnum>0 AND NOT a.attisdropped LOOP
  EXECUTE format('REVOKE INSERT (%I) ON %I.%I FROM PUBLIC,anon,authenticated',r.attname,r.nspname,r.relname);
 END LOOP;
END
$columns$;
-- No rows, financial snapshots, owners, policies, functions, gateway settings,
-- document versions, vendor statuses or legal rollout settings are changed.
COMMIT;

