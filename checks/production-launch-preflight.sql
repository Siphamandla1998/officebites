-- READ ONLY. Select gfzhdkitdyqftealgqfi using independently verified control-plane
-- identity BEFORE running. current_database()/SQL markers do not prove project identity.
-- This produces evidence; it does not authorize or install anything.
SELECT clock_timestamp() AS observed_utc, current_database() AS database_name,
       current_user AS observer_role, current_setting('server_version') AS server_version;

SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

SELECT n.nspname AS schema_name, c.relname AS object_name,
       pg_get_userbyid(c.relowner) AS owner, c.relkind,
       c.relrowsecurity AS rls, c.relforcerowsecurity AS force_rls, c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p','v','m','S')
ORDER BY 1,2;

-- TRUNCATE bypasses RLS. Any browser-role row here needs reviewed remediation.
SELECT n.nspname AS schema_name, c.relname AS table_name, role_name
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('anon'),('authenticated')) AS roles(role_name)
WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p')
AND has_table_privilege(role_name,c.oid,'TRUNCATE') ORDER BY 1,2,3;

SELECT n.nspname AS schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner, p.prosecdef AS security_definer,
       p.proacl, p.proconfig, md5(pg_get_functiondef(p.oid)) AS definition_md5
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private') AND p.prokind='f' ORDER BY 1,2,3;

SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname IN ('public','private','storage') ORDER BY 1,2,3;

SELECT n.nspname AS schema_name,c.relname AS table_name,t.tgname,
       pg_get_triggerdef(t.oid,true) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','private','storage') AND NOT t.tgisinternal ORDER BY 1,2,3;

SELECT grantee,table_schema,table_name,column_name,privilege_type
FROM information_schema.column_privileges
WHERE table_schema IN ('public','private') AND grantee IN ('anon','authenticated','PUBLIC')
ORDER BY 2,3,4,1,5;

SELECT pg_get_userbyid(d.defaclrole) AS owner,n.nspname,d.defaclobjtype,d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace ORDER BY 1,2,3;
SELECT r.rolname,r.rolsuper,r.rolinherit,r.rolcreaterole,r.rolcreatedb,r.rolcanlogin,r.rolbypassrls
FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role','authenticator','postgres') ORDER BY 1;
SELECT parent.rolname AS role_name,member.rolname AS member_name,m.admin_option
FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid
JOIN pg_roles member ON member.oid=m.member ORDER BY 1,2;

-- Only explicitly allowlisted, non-secret settings; declared values are NOT proof
-- of managed PostgREST effective runtime, reload state, Storage or Auth behavior.
SELECT r.rolname,split_part(value,'=',1) AS setting_name,
       substring(value FROM position('=' IN value)+1) AS declared_value
FROM pg_roles r CROSS JOIN LATERAL unnest(r.rolconfig) value
WHERE split_part(value,'=',1) IN ('pgrst.db_schemas','pgrst.db_extra_search_path',
 'pgrst.db_pre_request','pgrst.db_pre_config') ORDER BY 1,2;

SELECT feature, to_regclass(object_name) IS NOT NULL AS installed
FROM (VALUES
 ('gateway settings','private.gateway_settings'),
 ('manual banking','private.vendor_payment_profiles'),
 ('manual instructions','private.manual_order_payments'),
 ('legal versions','private.legal_versions'),
 ('vendor acceptances','private.vendor_legal_acceptances'),
 ('activation requirements','private.vendor_activation_requirements'),
 ('agreement assignments','private.vendor_legal_assignments'),
 ('compliance events','private.vendor_compliance_events'),
 ('order legal receipts','private.order_legal_acceptances')
) f(feature,object_name) ORDER BY 1;

-- Aggregates only. Named/vendor-specific transition records belong in controlled
-- operator evidence, not this repository. Counts are not compliance verification.
SELECT status, count(*) AS vendor_count FROM public.vendors GROUP BY status ORDER BY status;
SELECT commission_rate,count(*) AS vendor_count FROM public.vendors GROUP BY commission_rate ORDER BY commission_rate;
