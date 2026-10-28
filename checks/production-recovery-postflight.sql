-- SELECT ONLY. NOT FOR EXECUTION BEFORE APPROVED INSTALLATION.
-- Expected history 42 applies ONLY to the original four-file package; revise this
-- check and the manifest if a reviewed Storage/API split replaces P4.
SELECT count(*) history_count,max(version) latest,
 count(*)=42 AND max(version)='20261027115843' original_four_file_history_matches
 FROM supabase_migrations.schema_migrations;
SELECT version,name FROM supabase_migrations.schema_migrations
 WHERE version IN('20261027093453','20261027112327','20261027112437','20261027115843') ORDER BY version;
-- Project original columns so additive P2 defaults do not create false drift.
SELECT count(*) order_count,count(*) FILTER(WHERE status='pending_payment') pending,
 count(*) FILTER(WHERE status='preparing') preparing,
 md5(string_agg((to_jsonb(o)-'checkout_revision'-'delivery_fee')::text,'' ORDER BY id)) original_order_digest
 FROM public.orders o;
SELECT md5(string_agg(to_jsonb(s)::text,'' ORDER BY id)) suborder_digest FROM public.order_suborders s;
SELECT md5(string_agg(to_jsonb(i)::text,'' ORDER BY id)) item_digest FROM public.order_items i;
SELECT md5(string_agg(jsonb_build_object('id',id,'owner_id',owner_id,'status',status,'archived_at',archived_at,
 'commission_rate',commission_rate)::text,'' ORDER BY id)) vendor_restrictions_digest FROM public.vendors;
SELECT md5(string_agg(jsonb_build_object('id',id,'role',role,'vendor_id',vendor_id,'suspended',suspended,
 'deleted_at',deleted_at)::text,'' ORDER BY id)) profile_restrictions_digest FROM public.profiles;
SELECT provider,enabled,ready,maintenance FROM private.gateway_settings ORDER BY provider;
SELECT customer_legal_enabled,vendor_clickwrap_enabled,legal_publication_enabled,acquisition_enabled
 FROM private.commercial_settings;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='vendor-compliance';
SELECT policyname,permissive,cmd,roles,qual,with_check FROM pg_policies
 WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'compliance_%' ORDER BY policyname;
SELECT r,relation,has_table_privilege(r,relation,'SELECT') direct_read,
 has_table_privilege(r,relation,'INSERT') direct_insert,has_table_privilege(r,relation,'UPDATE') direct_update,
 has_table_privilege(r,relation,'TRUNCATE') truncate
 FROM unnest(ARRAY['anon','authenticated']) r CROSS JOIN unnest(ARRAY[
 'private.vendor_payment_profiles','private.manual_order_payments','private.order_legal_acceptances']) relation;
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,
 pg_get_userbyid(proowner) owner,prosecdef security_definer,proconfig,proacl,
 md5(pg_get_functiondef(p.oid)) definition_md5 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('public','private') AND proname IN('get_legal_portal','get_commercial_workspace',
 'get_customer_legal_state','create_order_with_legal','get_vendor_manual_methods','manual_payment_workspace',
 'submit_vendor_payment_profile','approve_vendor_payment_profile','get_manual_payment','report_manual_payment',
 'verify_manual_payment','get_vendor_compliance','admin_vendor_compliance','compliance_storage_access') ORDER BY 1,2;
SELECT n.nspname,c.relname,relrowsecurity,relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='private' AND relname IN('vendor_payment_profiles','manual_order_payments','legal_versions',
 'vendor_compliance_events','order_legal_acceptances');
-- Also compare column-level grants, exact policy definitions, role memberships,
-- trigger definitions and full final catalog with the approved native/managed
-- rehearsal manifest. Counts and these samples alone are not a security PASS.
