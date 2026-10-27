-- LOCAL REVIEW ONLY. Separate managed Storage-owner executor required.
-- Ordinary application postgres MUST NOT acquire managed-role membership to run this.
-- Apply after the recorded three application steps, with all rollout flags closed.
BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s';
DO $$ BEGIN
 IF current_user<>'supabase_storage_admin' OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='storage' AND c.relname='objects' AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND c.relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname='compliance_storage_access')
 THEN RAISE EXCEPTION 'Approved managed Storage-owner execution and installed compliance foundation required'; END IF;
END $$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('vendor-compliance','vendor-compliance',false,5242880,ARRAY['application/pdf','image/jpeg','image/png']) ON CONFLICT(id) DO NOTHING;
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
