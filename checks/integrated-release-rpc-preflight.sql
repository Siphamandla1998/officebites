-- SELECT ONLY. Run only after independent control-plane target verification.
-- Missing OPTIONAL functions do not justify installing excluded features.
SELECT clock_timestamp() observed_utc, current_user observer, current_setting('server_version') engine;
SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;
WITH expected(signature,classification) AS (VALUES
 ('public.get_vendor_manual_methods(uuid)','essential: availability'),
 ('public.manual_payment_workspace(boolean)','essential: admin/vendor payments'),
 ('public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text)','essential: settings CAS'),
 ('public.submit_vendor_payment_profile(uuid,jsonb,boolean,boolean)','essential: pending banking'),
 ('public.approve_vendor_payment_profile(uuid,text)','essential: independent banking review'),
 ('public.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid)','essential: guarded order creation'),
 ('public.create_order_with_legal(jsonb,jsonb)','essential: checkout plus immutable receipt'),
 ('public.get_manual_payment(uuid,uuid)','essential: protected instructions'),
 ('public.report_manual_payment(uuid,uuid)','essential: customer report only'),
 ('public.verify_manual_payment(uuid,numeric,text,boolean)','essential: server paid transition'),
 ('public.get_customer_legal_state()','essential: approved public versions'),
 ('public.get_order_legal_receipt(uuid,uuid)','essential: guest/member legal receipt'),
 ('public.get_vendor_agreement_state()','essential: assigned documents'),
 ('public.accept_assigned_vendor_agreement(uuid,boolean)','essential: unchecked assent'),
 ('public.get_vendor_compliance(uuid)','essential: scoped compliance'),
 ('public.admin_vendor_compliance(uuid,text,jsonb)','essential: independent review/activation'),
 ('public.get_payment_gateways()','compatibility: safe flag read; not checkout eligibility'),
 ('public.get_collection_options()','excluded: collection'),
 ('public.get_delivery_settings()','excluded: new distance-based delivery'),
 ('public.get_order_assistance_options()','excluded: assisted orders'),
 ('public.admin_delivery_origin_queue()','excluded: new delivery-origin workflow')
) SELECT e.*,p.oid IS NOT NULL installed,pg_get_function_identity_arguments(p.oid) arguments,
 pg_get_function_result(p.oid) result_type,pg_get_userbyid(p.proowner) owner,p.prosecdef security_definer,p.proconfig,p.proacl,
 CASE WHEN p.oid IS NOT NULL THEN has_function_privilege('anon',p.oid,'EXECUTE') END anon_execute,
 CASE WHEN p.oid IS NOT NULL THEN has_function_privilege('authenticated',p.oid,'EXECUTE') END authenticated_execute
 FROM expected e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature) ORDER BY classification,signature;
-- These are declared values only; obtain EFFECTIVE managed service evidence separately.
SELECT rolname,setting FROM pg_roles CROSS JOIN LATERAL unnest(rolconfig) setting
 WHERE split_part(setting,'=',1) IN('pgrst.db_schemas','pgrst.db_pre_request','pgrst.db_pre_config','pgrst.db_extra_search_path');
