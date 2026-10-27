-- Supported policy-only executor: postgres via configured supautils delegation.
-- Fallback: provider-approved existing managed owner; no role/ownership escalation.
-- Bucket is created separately via approved Storage Dashboard/API, never direct metadata INSERT.
BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s';
DO $$ BEGIN
 IF current_user NOT IN('postgres','supabase_storage_admin') THEN RAISE EXCEPTION 'Approved policy executor required'; END IF;
 IF current_user='postgres' THEN
  IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261027123110' AND name='staging_integrated_vendor_legal_payments') THEN
   RAISE EXCEPTION 'Recorded staging application delta required'; END IF;
 END IF;
 IF to_regclass('private.vendor_compliance_events') IS NULL OR to_regprocedure('private.vendor_launch_ready(uuid)') IS NULL THEN RAISE EXCEPTION 'Integrated compliance foundation required'; END IF;
END $$;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='vendor-compliance' AND NOT public
 AND file_size_limit=5242880 AND allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png'])
 THEN RAISE EXCEPTION 'Unexpected compliance bucket configuration; review before applying'; END IF; END $$;
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
