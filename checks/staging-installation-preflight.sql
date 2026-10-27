-- PREPARED SELECT-ONLY evidence collection. NOT executed against hosted projects.
-- Operator: independently select eyhmarmekioovcjibcbr before separately approved use.
SELECT clock_timestamp() observed_utc,current_user executor,current_database() database_name,current_setting('server_version') server_version;
SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;
SELECT count(*) history_count,md5(string_agg(version||':'||coalesce(name,''),E'\n' ORDER BY version)) history_md5 FROM supabase_migrations.schema_migrations;
SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema='supabase_migrations' AND table_name='schema_migrations' ORDER BY ordinal_position;
SELECT provider,enabled,ready,maintenance FROM private.gateway_settings ORDER BY provider;
SELECT deadline_minutes,review_threshold FROM private.manual_payment_settings WHERE singleton;
SELECT onboarding_enforced,acquisition_enabled,standard_breakdown_enabled FROM private.commercial_settings;
SELECT feature,to_regclass(name) IS NOT NULL installed FROM (VALUES
 ('B','private.vendor_activation_requirements'),('C','private.vendor_legal_assignments'),
 ('D','private.vendor_compliance_events'),('E','private.order_legal_acceptances')) t(feature,name);
SELECT n.nspname,c.relname,pg_get_userbyid(c.relowner) owner,c.relrowsecurity rls,c.relacl
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE (n.nspname IN('public','private') AND c.relkind IN('r','p')) OR (n.nspname='storage' AND c.relname IN('buckets','objects')) ORDER BY 1,2;
SELECT n.nspname,p.oid::regprocedure signature,pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer,p.proconfig,p.proacl,md5(pg_get_functiondef(p.oid)) definition_md5
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN('public','private') AND p.proname IN('active_account','create_order_core','create_order_with_delivery','admin_manual_settings','cancel_unpaid_order','create_manual_order','get_vendor_manual_methods','order_to_json','record_manual_refund_status','verify_manual_payment','handle_new_user','guard_vendor_privileged_fields','guard_profile_privileged_fields','snapshot_paid_commission') ORDER BY 1,2;
-- Safe allowlisted declared values only. Not proof of loaded/effective service settings.
SELECT current_setting('supautils.version',true) declared_supautils_version,current_setting('supautils.policy_grants',true) declared_policy_delegation;
SELECT r.rolname,setting FROM pg_roles r CROSS JOIN LATERAL unnest(r.rolconfig) setting
 WHERE split_part(setting,'=',1) IN('pgrst.db_schemas','pgrst.db_pre_request','pgrst.db_pre_config','pgrst.db_extra_search_path');
SELECT policyname,permissive,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname;
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='vendor-compliance';
SELECT count(*) legal_versions,count(*) FILTER(WHERE approved_at IS NOT NULL) approved_versions FROM private.legal_versions;
SELECT count(*) banking_profiles,count(*) FILTER(WHERE approved_at IS NOT NULL) approved_profiles FROM private.vendor_payment_profiles;
-- Channel inventory: report identifiers/hashes, never embedded commands/URLs/secrets.
SELECT to_regclass('cron.job') cron_jobs,to_regclass('net.http_request_queue') pending_http;
SELECT n.nspname,c.relname,t.tgname,p.proname,md5(pg_get_functiondef(p.oid)) definition_md5,
 pg_get_functiondef(p.oid) ~* '(http_post|net[.]http|notifications|pg_notify)' channel_review_required
 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE NOT t.tgisinternal AND n.nspname IN('public','private','auth') ORDER BY 1,2,3;
-- If cron.job exists, separately approve: SELECT jobid,jobname,schedule,active,md5(command) FROM cron.job;
-- Private config, SMTP values, JWT secrets, bank destinations and customer data are not requested.
