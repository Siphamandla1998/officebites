-- Executed ONLY against eyhmarmekioovcjibcbr on 2026-10-27.
-- SELECT catalog/settings/count inspection only. No application RPC invocation.

SELECT jsonb_build_object(
'observed_utc',clock_timestamp(),'executor',current_user,'database',current_database(),'server_version',current_setting('server_version'),
'history',(SELECT jsonb_agg(jsonb_build_object('version',version,'name',name) ORDER BY version) FROM supabase_migrations.schema_migrations),
'history_count',(SELECT count(*) FROM supabase_migrations.schema_migrations),
'history_md5',(SELECT md5(string_agg(version||':'||coalesce(name,''),E'\n' ORDER BY version)) FROM supabase_migrations.schema_migrations),
'ledger_columns',(SELECT jsonb_agg(jsonb_build_object('name',column_name,'type',data_type,'nullable',is_nullable) ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='supabase_migrations' AND table_name='schema_migrations'),
'gateways',(SELECT jsonb_agg(jsonb_build_object('provider',provider,'enabled',enabled,'ready',ready,'maintenance',maintenance) ORDER BY provider) FROM private.gateway_settings),
'manual_settings',(SELECT jsonb_agg(jsonb_build_object('deadline_minutes',deadline_minutes,'review_threshold',review_threshold)) FROM private.manual_payment_settings WHERE singleton),
'commercial',(SELECT jsonb_agg(jsonb_build_object('onboarding_enforced',onboarding_enforced,'acquisition_enabled',acquisition_enabled,'standard_breakdown_enabled',standard_breakdown_enabled)) FROM private.commercial_settings),
'phase_roots',(SELECT jsonb_object_agg(feature,to_regclass(name) IS NOT NULL) FROM (VALUES('B','private.vendor_activation_requirements'),('C','private.vendor_legal_assignments'),('D','private.vendor_compliance_events'),('E','private.order_legal_acceptances'))t(feature,name)),
'checked_settings_exists',to_regprocedure('public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text)') IS NOT NULL,
'legal_counts',(SELECT jsonb_build_object('versions',count(*),'approved',count(*) FILTER(WHERE approved_at IS NOT NULL)) FROM private.legal_versions),
'bank_counts',(SELECT jsonb_build_object('profiles',count(*),'approved',count(*) FILTER(WHERE approved_at IS NOT NULL)) FROM private.vendor_payment_profiles)
) evidence;

SELECT jsonb_build_object(
'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','private') AND c.relkind IN('r','p','v')),
'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl,'md5',md5(pg_get_functiondef(p.oid))) ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private') AND p.prokind='f'),
'policies',(SELECT jsonb_agg(to_jsonb(x) ORDER BY schemaname,tablename,policyname) FROM (SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN('public','private')) x),
'default_acl',(SELECT jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'type',d.defaclobjtype,'acl',d.defaclacl)) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname IN('public','private') OR d.defaclnamespace=0),
'schema_acl',(SELECT jsonb_agg(jsonb_build_object('schema',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl)) FROM pg_namespace WHERE nspname IN('public','private','storage'))
) evidence;

SELECT jsonb_build_object(
'storage_tables',(SELECT jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'acl',c.relacl) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relname IN('objects','buckets')),
'storage_policies',(SELECT jsonb_agg(to_jsonb(x) ORDER BY policyname) FROM (SELECT policyname,permissive,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects')x),
'compliance_bucket',(SELECT jsonb_agg(jsonb_build_object('id',id,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types)) FROM storage.buckets WHERE id='vendor-compliance'),
'declared_supautils_version',current_setting('supautils.version',true),
'declared_policy_grants',current_setting('supautils.policy_grants',true),
'declared_role_api_settings',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'setting',s.setting)) FROM pg_roles r CROSS JOIN LATERAL unnest(r.rolconfig)s(setting) WHERE split_part(s.setting,'=',1) IN('pgrst.db_schemas','pgrst.db_pre_request','pgrst.db_pre_config','pgrst.db_extra_search_path')),
'declared_db_role_api_settings',(SELECT jsonb_agg(jsonb_build_object('role',r.rolname,'database',d.datname,'setting',s.setting)) FROM pg_db_role_setting x LEFT JOIN pg_roles r ON r.oid=x.setrole LEFT JOIN pg_database d ON d.oid=x.setdatabase CROSS JOIN LATERAL unnest(x.setconfig)s(setting) WHERE split_part(s.setting,'=',1) IN('pgrst.db_schemas','pgrst.db_pre_request','pgrst.db_pre_config','pgrst.db_extra_search_path')),
'cron_relation',to_regclass('cron.job')::text,'http_queue_relation',to_regclass('net.http_request_queue')::text,
'triggers',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'trigger',t.tgname,'function',p.oid::regprocedure::text,'enabled',t.tgenabled,'md5',md5(pg_get_functiondef(p.oid)),'channel_review_required',pg_get_functiondef(p.oid) ~* '(http_post|net[.]http|notifications|pg_notify)') ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN('public','private','auth'))
) evidence;

SELECT jsonb_build_object(
'role_attributes',(SELECT jsonb_agg(jsonb_build_object('role',rolname,'superuser',rolsuper,'bypass_rls',rolbypassrls,'inherit',rolinherit,'login',rolcanlogin)) FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','authenticator','supabase_storage_admin','service_role')),
'role_memberships',(SELECT jsonb_agg(jsonb_build_object('member',m.rolname,'role',r.rolname,'admin_option',x.admin_option)) FROM pg_auth_members x JOIN pg_roles m ON m.oid=x.member JOIN pg_roles r ON r.oid=x.roleid WHERE m.rolname IN('anon','authenticated','authenticator','postgres')),
'private_direct_privileges',(SELECT jsonb_agg(jsonb_build_object('role',r.role,'table',n.nspname||'.'||c.relname,'select',has_table_privilege(r.role,c.oid,'SELECT'),'insert',has_table_privilege(r.role,c.oid,'INSERT'),'update',has_table_privilege(r.role,c.oid,'UPDATE'),'delete',has_table_privilege(r.role,c.oid,'DELETE'),'truncate',has_table_privilege(r.role,c.oid,'TRUNCATE'))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN (VALUES('anon'),('authenticated'))r(role) WHERE n.nspname='private' AND c.relkind IN('r','p','v') AND (has_table_privilege(r.role,c.oid,'SELECT') OR has_table_privilege(r.role,c.oid,'INSERT') OR has_table_privilege(r.role,c.oid,'UPDATE') OR has_table_privilege(r.role,c.oid,'DELETE') OR has_table_privilege(r.role,c.oid,'TRUNCATE'))),
'unsafe_table_privileges',(SELECT jsonb_agg(jsonb_build_object('role',r.role,'table',n.nspname||'.'||c.relname,'truncate',has_table_privilege(r.role,c.oid,'TRUNCATE'),'trigger',has_table_privilege(r.role,c.oid,'TRIGGER'),'references',has_table_privilege(r.role,c.oid,'REFERENCES'))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN (VALUES('anon'),('authenticated'))r(role) WHERE n.nspname IN('public','private') AND c.relkind IN('r','p') AND (has_table_privilege(r.role,c.oid,'TRUNCATE') OR has_table_privilege(r.role,c.oid,'TRIGGER') OR has_table_privilege(r.role,c.oid,'REFERENCES'))),
'ledger_privileges',jsonb_build_object('insert',has_table_privilege('postgres','supabase_migrations.schema_migrations','INSERT'),'select',has_table_privilege('postgres','supabase_migrations.schema_migrations','SELECT')),
'columns',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY n.nspname,c.relname,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname IN('public','private') AND c.relkind IN('r','p') AND a.attnum>0 AND NOT a.attisdropped),
'constraints',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',x.conname,'definition',pg_get_constraintdef(x.oid)) ORDER BY n.nspname,c.relname,x.conname) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','private')),
'indexes',(SELECT jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',indexname,'definition',indexdef) ORDER BY schemaname,tablename,indexname) FROM pg_indexes WHERE schemaname IN('public','private'))
) evidence;

SELECT jsonb_build_object(
'observed_utc',clock_timestamp(),
'singleton_counts',jsonb_build_object('manual_settings',(SELECT count(*) FROM private.manual_payment_settings),'commercial_settings',(SELECT count(*) FROM private.commercial_settings),'gateway_rows',(SELECT count(*) FROM private.gateway_settings)),
'rpc_contract',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'arguments',pg_get_function_arguments(p.oid),'returns',pg_get_function_result(p.oid),'owner',pg_get_userbyid(p.proowner),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) ORDER BY p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN('get_vendor_manual_methods','get_payment_gateways','manual_payment_workspace','admin_manual_settings','create_manual_order','get_manual_payment','report_manual_payment','verify_manual_payment','submit_vendor_payment_profile','approve_vendor_payment_profile','become_vendor','create_order_with_legal','accept_assigned_vendor_agreement','get_vendor_compliance')),
'ledger_constraints',(SELECT jsonb_agg(jsonb_build_object('name',conname,'definition',pg_get_constraintdef(oid))) FROM pg_constraint WHERE conrelid='supabase_migrations.schema_migrations'::regclass),
'ledger_triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid))) FROM pg_trigger WHERE tgrelid='supabase_migrations.schema_migrations'::regclass AND NOT tgisinternal),
'storage_delegation',jsonb_build_object('shared_preload_supautils',position('supautils' in current_setting('shared_preload_libraries'))>0,'postgres_configured_for_objects',coalesce((current_setting('supautils.policy_grants',true)::jsonb->'postgres')?'storage.objects',false)),
'private_ungranted_functions',(SELECT jsonb_agg(p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND (has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE')))
) evidence;

SELECT jsonb_build_object(
'observed_utc',clock_timestamp(),
'policy_grants_registered',(SELECT jsonb_agg(jsonb_build_object('name',name,'context',context,'source',source,'pending_restart',pending_restart,'vartype',vartype)) FROM pg_settings WHERE name='supautils.policy_grants'),
'preload_declared',jsonb_build_object('session_has_supautils',position('supautils' in current_setting('session_preload_libraries'))>0,'local_has_supautils',position('supautils' in current_setting('local_preload_libraries'))>0,'shared_has_supautils',position('supautils' in current_setting('shared_preload_libraries'))>0),
'privileged_private_execute',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'definer',p.prosecdef,'acl',p.proacl)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname IN('account_removal_preview','accept_vendor_legal','prepare_vendor_consent','commercial_admin_action','commercial_workspace','commercial_report','respond_corporate_agreement','reject_inactive_write','snapshot_paid_commission'))
) evidence;

