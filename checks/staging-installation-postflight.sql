-- PREPARED SELECT ONLY. After BOTH approved installation steps; do not run before.
SELECT clock_timestamp() observed_utc,count(*) history_count,max(version) last_version FROM supabase_migrations.schema_migrations;
SELECT version,name,cardinality(statements) recorded_statements FROM supabase_migrations.schema_migrations
 WHERE version IN('20261027123110','20261027123115') ORDER BY version;
SELECT provider,enabled,ready,maintenance FROM private.gateway_settings ORDER BY provider;
SELECT customer_legal_enabled,vendor_clickwrap_enabled,legal_publication_enabled,acquisition_enabled FROM private.commercial_settings;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='vendor-compliance';
SELECT policyname,permissive,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'compliance_%' ORDER BY policyname;
SELECT n.nspname,c.relname,c.relrowsecurity rls,c.relacl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='private' AND c.relkind='r' AND c.relname IN('vendor_legal_acceptances','vendor_legal_assignments','vendor_compliance_events','order_legal_acceptances','vendor_payment_profiles','manual_order_payments','manual_receivables') ORDER BY 2;
SELECT role_name,table_name,has_table_privilege(role_name,table_name,'SELECT') direct_read,has_table_privilege(role_name,table_name,'TRUNCATE') truncate_privilege
 FROM (VALUES('anon'),('authenticated')) r(role_name)
 CROSS JOIN (VALUES('private.vendor_payment_profiles'),('private.manual_order_payments'),('private.order_legal_acceptances')) t(table_name);
SELECT p.oid::regprocedure signature,pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer,p.proconfig,p.proacl,md5(pg_get_functiondef(p.oid)) definition_md5
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private')
 AND p.proname IN('create_order_with_legal','create_manual_order','get_vendor_manual_methods','manual_payment_workspace','admin_manual_settings_checked','get_vendor_agreement_state','accept_assigned_vendor_agreement','get_vendor_compliance','admin_vendor_compliance','manual_contract_snapshot','snapshot_paid_commission') ORDER BY 1;
SELECT tgname,tgdeferrable,tginitdeferred,pg_get_triggerdef(oid) definition FROM pg_trigger
 WHERE NOT tgisinternal AND (tgname LIKE '%legal%' OR tgname LIKE '%manual%' OR tgname LIKE '%activation%') ORDER BY tgname;
-- Compare original-record digests from the approved operator preimage, not just counts.
-- No actor identity, timestamp, content hash, bank destination or approval is supplied by clients.
