-- REVIEW ALTERNATIVE ONLY. Replaces P4; never apply alongside original P4.
-- No bucket metadata DML: create and verify the private bucket through Storage API first.
-- Uses provider-installed supautils delegation, never role membership/ownership changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';
DO $$ BEGIN
 IF current_user <> 'postgres' OR session_user <> 'postgres'
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND NOT rolsuper)
 OR NOT EXISTS(SELECT 1 FROM pg_settings WHERE name='supautils.policy_grants'
   AND context='sighup' AND source='configuration file'
   AND (setting::jsonb->'postgres') ? 'storage.objects')
 OR NOT EXISTS(SELECT 1 FROM pg_settings WHERE name='session_preload_libraries'
   AND context='superuser' AND source='configuration file'
   AND 'supautils'=ANY(regexp_split_to_array(setting,E'\\s*,\\s*')))
 THEN RAISE EXCEPTION 'Provider-installed Storage policy delegation required'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>41
 OR (SELECT max(version) FROM supabase_migrations.schema_migrations)<>'20261027112437'
 OR (SELECT count(*) FROM supabase_migrations.schema_migrations WHERE
   (version,name) IN (('20261027093453','production_launch_browser_grants'),
    ('20261027112327','production_minimum_manual_legal_foundation'),
    ('20261027112437','production_checked_settings')))<>3
 OR (SELECT md5(string_agg(version||':'||coalesce(name,''),E'\n' ORDER BY version))
   FROM supabase_migrations.schema_migrations WHERE version<'20261027093453')
   IS DISTINCT FROM 'ffa2bc5fbcf4470b5f0d0277d6d2bfa1'
 THEN RAISE EXCEPTION 'Reviewed P1-P3 migration history required'; END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='storage' AND c.relname IN('objects','buckets') AND c.relrowsecurity
   AND pg_get_userbyid(c.relowner)='supabase_storage_admin')<>2
 OR to_regprocedure('private.compliance_storage_access(text,boolean)') IS NULL
 OR EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
   AND policyname LIKE 'compliance_%')
 THEN RAISE EXCEPTION 'Managed Storage ownership, RLS, foundation and absent compliance policies required'; END IF;
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled)
 OR EXISTS(SELECT 1 FROM private.commercial_settings WHERE customer_legal_enabled
   OR vendor_clickwrap_enabled OR legal_publication_enabled OR acquisition_enabled)
 THEN RAISE EXCEPTION 'Release controls must remain closed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='vendor-compliance'
   AND name='vendor-compliance' AND NOT public AND file_size_limit=5242880
   AND allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png'])
 OR EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='vendor-compliance')
 THEN RAISE EXCEPTION 'API-created private empty compliance bucket with reviewed limits required'; END IF;
 IF NOT has_schema_privilege('authenticated','private','USAGE')
 OR NOT has_function_privilege('authenticated','private.compliance_storage_access(text,boolean)','EXECUTE')
 OR NOT has_function_privilege('anon','private.compliance_storage_access(text,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'Scoped predicate permissions required'; END IF;
END $$;
CREATE POLICY compliance_object_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='vendor-compliance' AND private.compliance_storage_access(name,true));
CREATE POLICY compliance_object_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='vendor-compliance' AND private.compliance_storage_access(name,false));
-- Intersect permissive legacy storage policies; evidence cannot be replaced/deleted by clients.
CREATE POLICY compliance_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK(bucket_id<>'vendor-compliance' OR private.compliance_storage_access(name,true));
CREATE POLICY compliance_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(bucket_id<>'vendor-compliance' OR private.compliance_storage_access(name,false));
CREATE POLICY compliance_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(bucket_id<>'vendor-compliance') WITH CHECK(bucket_id<>'vendor-compliance');
CREATE POLICY compliance_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(bucket_id<>'vendor-compliance');
COMMIT;
