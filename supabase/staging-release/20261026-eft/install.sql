-- STAGING ONLY. Apply only as ONE approved Supabase apply_migration transaction.
-- The control-plane project_id MUST be eyhmarmekioovcjibcbr. SQL settings alone do not prove target identity.
-- No Auth/REST/Vercel configuration, actor provisioning, activation or notifications are authorised by this file.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(hashtextextended('officebites-staging-eft-install-20261026',0));
SELECT set_config('officebites.verified_project_ref','eyhmarmekioovcjibcbr',true);
DO $$ DECLARE expected jsonb:=$eft_baseline${"roots":{"uat":false,"phaseB":false,"phaseC":false,"phaseD":false,"phaseE":false,"collection":false,"fullInstall":false},"counts":{"items":15,"orders":15,"suborders":15,"bankProfiles":0,"manualEvents":18,"manualPayments":0},"manual":{"minutes":15,"threshold":500},"tables":[{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"gateway_settings","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"manual_order_payments","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"manual_payment_settings","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"vendor_payment_profiles","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"name":"orders","owner":"postgres","schema":"public"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=rw/postgres}","rls":true,"name":"profiles","owner":"postgres","schema":"public"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,anon=r/postgres,authenticated=rw/postgres}","rls":true,"name":"vendors","owner":"postgres","schema":"public"}],"delivery":{"fee":15,"enabled":false,"revision":2},"functions":[{"acl":"{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}","md5":"5bda4a148d4f52474014f31f90b49cdf","owner":"postgres","config":["search_path=\"\""],"signature":"private.active_account()","securityDefiner":true},{"acl":"{postgres=X/postgres}","md5":"d66dff3346ea0241a989a2c060227236","owner":"postgres","config":["search_path=public"],"signature":"private.create_order_core(uuid, text, text, text, date, text, jsonb)","securityDefiner":true},{"acl":"{postgres=X/postgres}","md5":"36d73e384b63626498cbe054c1d5da31","owner":"postgres","config":["search_path=\"\""],"signature":"private.create_order_with_delivery(uuid, text, text, text, date, text, jsonb, uuid)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","md5":"7c0a398be18ece9e1940840fe692ea6c","owner":"postgres","config":["search_path=\"\""],"signature":"public.admin_manual_settings(boolean, boolean, integer, numeric, text)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}","md5":"6a52338e78c097c55bb8721bbcf451fe","owner":"postgres","config":["search_path=\"\""],"signature":"public.cancel_unpaid_order(uuid, text, text)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres,anon=X/postgres}","md5":"c4dc553530f2998f26e91475b7503a5e","owner":"postgres","config":["search_path=\"\""],"signature":"public.create_manual_order(uuid, text, text, text, date, text, jsonb, uuid, text, uuid)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres,anon=X/postgres}","md5":"52ac2c375a04a31aa46470456260c929","owner":"postgres","config":["search_path=\"\""],"signature":"public.get_vendor_manual_methods(uuid)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","md5":"1185d494ac41ab09d2b83f3e263582cd","owner":"postgres","config":["search_path=public"],"signature":"public.order_to_json(orders)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","md5":"7996f9c65a3cf770c3eb91f7a2b650a2","owner":"postgres","config":["search_path=\"\""],"signature":"public.record_manual_refund_status(uuid, text, numeric, numeric, text)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","md5":"c35b9e7c3fecb979f70c81cda16938cb","owner":"postgres","config":["search_path=\"\""],"signature":"public.verify_manual_payment(uuid, numeric, text, boolean)","securityDefiner":true}],"observedUtc":"2026-10-26T13:20:08.96871+00:00","gatewayFlags":[{"ready":true,"enabled":false,"provider":"manual_eft","maintenance":false},{"ready":true,"enabled":false,"provider":"manual_payshap","maintenance":false},{"ready":false,"enabled":false,"provider":"ozow","maintenance":true},{"ready":true,"enabled":false,"provider":"payfast","maintenance":false}],"project":"eyhmarmekioovcjibcbr","projectName":"officebites-staging","scope":"read-only metadata; not approval"}$eft_baseline$::jsonb;actual jsonb; BEGIN
 SELECT jsonb_build_object('gatewayFlags',(SELECT jsonb_agg(jsonb_build_object('provider',provider,'enabled',enabled,'ready',ready,'maintenance',maintenance) ORDER BY provider) FROM private.gateway_settings),'manual',(SELECT jsonb_build_object('minutes',deadline_minutes,'threshold',review_threshold) FROM private.manual_payment_settings WHERE singleton),'delivery',(SELECT jsonb_build_object('enabled',enabled,'fee',paid_fee,'revision',revision) FROM private.delivery_settings)) INTO actual;
 IF actual IS DISTINCT FROM jsonb_build_object('gatewayFlags',expected->'gatewayFlags','manual',expected->'manual','delivery',expected->'delivery') OR EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled) THEN RAISE EXCEPTION 'Payment/settings/ready/maintenance baseline drift; no changes authorised'; END IF;
END $$;
DO $package$ DECLARE original text; restored text; functions jsonb; recorded jsonb; digest text; BEGIN
 IF to_regclass('private.officebites_eft_release_installations') IS NOT NULL THEN
  EXECUTE 'SELECT payload_sha256,functions FROM private.officebites_eft_release_installations WHERE name=$1' INTO digest,recorded USING 'officebites_eft_20261026';
  IF digest IS DISTINCT FROM '0f65603281048631d437ef436272762b232763d1af57dabf094a97ae6f22deac' THEN RAISE EXCEPTION 'Different or partial package installed';END IF;
  SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),md5(pg_get_functiondef(p.oid)),p.proowner,p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private') AND p.prokind='f' INTO functions;
  IF functions IS DISTINCT FROM recorded THEN RAISE EXCEPTION 'Installed function/ACL drift';END IF;
  RETURN;
 END IF;
 LOCK TABLE public.orders,public.order_suborders,public.order_items,public.profiles,public.vendors,private.manual_receivables,private.manual_receivable_entries,private.manual_payment_events,private.manual_order_payments,private.vendor_payment_profiles,private.payment_attempts,private.ozow_attempts,private.standard_fee_ledger,private.acquisition_ledger,private.gateway_settings,private.manual_payment_settings,private.delivery_settings IN SHARE ROW EXCLUSIVE MODE;
 EXECUTE $baseline$DO $$ DECLARE expected jsonb:=$eft_baseline${"roots":{"uat":false,"phaseB":false,"phaseC":false,"phaseD":false,"phaseE":false,"collection":false,"fullInstall":false},"counts":{"items":15,"orders":15,"suborders":15,"bankProfiles":0,"manualEvents":18,"manualPayments":0},"manual":{"minutes":15,"threshold":500},"tables":[{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"gateway_settings","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"manual_order_payments","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"manual_payment_settings","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"vendor_payment_profiles","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"name":"orders","owner":"postgres","schema":"public"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=rw/postgres}","rls":true,"name":"profiles","owner":"postgres","schema":"public"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,anon=r/postgres,authenticated=rw/postgres}","rls":true,"name":"vendors","owner":"postgres","schema":"public"}],"delivery":{"fee":15,"enabled":false,"revision":2},"functions":[{"acl":"{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}","md5":"5bda4a148d4f52474014f31f90b49cdf","owner":"postgres","config":["search_path=\"\""],"signature":"private.active_account()","securityDefiner":true},{"acl":"{postgres=X/postgres}","md5":"d66dff3346ea0241a989a2c060227236","owner":"postgres","config":["search_path=public"],"signature":"private.create_order_core(uuid, text, text, text, date, text, jsonb)","securityDefiner":true},{"acl":"{postgres=X/postgres}","md5":"36d73e384b63626498cbe054c1d5da31","owner":"postgres","config":["search_path=\"\""],"signature":"private.create_order_with_delivery(uuid, text, text, text, date, text, jsonb, uuid)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","md5":"7c0a398be18ece9e1940840fe692ea6c","owner":"postgres","config":["search_path=\"\""],"signature":"public.admin_manual_settings(boolean, boolean, integer, numeric, text)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}","md5":"6a52338e78c097c55bb8721bbcf451fe","owner":"postgres","config":["search_path=\"\""],"signature":"public.cancel_unpaid_order(uuid, text, text)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres,anon=X/postgres}","md5":"c4dc553530f2998f26e91475b7503a5e","owner":"postgres","config":["search_path=\"\""],"signature":"public.create_manual_order(uuid, text, text, text, date, text, jsonb, uuid, text, uuid)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres,anon=X/postgres}","md5":"52ac2c375a04a31aa46470456260c929","owner":"postgres","config":["search_path=\"\""],"signature":"public.get_vendor_manual_methods(uuid)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","md5":"1185d494ac41ab09d2b83f3e263582cd","owner":"postgres","config":["search_path=public"],"signature":"public.order_to_json(orders)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","md5":"7996f9c65a3cf770c3eb91f7a2b650a2","owner":"postgres","config":["search_path=\"\""],"signature":"public.record_manual_refund_status(uuid, text, numeric, numeric, text)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","md5":"c35b9e7c3fecb979f70c81cda16938cb","owner":"postgres","config":["search_path=\"\""],"signature":"public.verify_manual_payment(uuid, numeric, text, boolean)","securityDefiner":true}],"observedUtc":"2026-10-26T13:20:08.96871+00:00","gatewayFlags":[{"ready":true,"enabled":false,"provider":"manual_eft","maintenance":false},{"ready":true,"enabled":false,"provider":"manual_payshap","maintenance":false},{"ready":false,"enabled":false,"provider":"ozow","maintenance":true},{"ready":true,"enabled":false,"provider":"payfast","maintenance":false}],"project":"eyhmarmekioovcjibcbr","projectName":"officebites-staging","scope":"read-only metadata; not approval"}$eft_baseline$::jsonb;actual jsonb;k text;BEGIN
 SELECT jsonb_build_object(
'gatewayFlags',(SELECT jsonb_agg(jsonb_build_object('provider',provider,'enabled',enabled,'ready',ready,'maintenance',maintenance) ORDER BY provider) FROM private.gateway_settings),
'manual',(SELECT jsonb_build_object('minutes',deadline_minutes,'threshold',review_threshold) FROM private.manual_payment_settings WHERE singleton),
'delivery',(SELECT jsonb_build_object('enabled',enabled,'fee',paid_fee,'revision',revision) FROM private.delivery_settings),
'functions',(SELECT jsonb_agg(jsonb_build_object('signature',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')','owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'md5',md5(pg_get_functiondef(p.oid)),'securityDefiner',p.prosecdef,'config',p.proconfig) ORDER BY n.nspname,p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND ((n.nspname='private' AND p.proname IN('active_account','create_order_core','create_order_with_delivery')) OR(n.nspname='public' AND p.proname IN('admin_manual_settings','cancel_unpaid_order','create_manual_order','get_vendor_manual_methods','order_to_json','record_manual_refund_status','verify_manual_payment')))),
 'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='private' AND c.relname IN('gateway_settings','manual_payment_settings','vendor_payment_profiles','manual_order_payments')) OR(n.nspname='public' AND c.relname IN('orders','profiles','vendors'))),
 'counts',jsonb_build_object('orders',(SELECT count(*) FROM public.orders),'suborders',(SELECT count(*) FROM public.order_suborders),'items',(SELECT count(*) FROM public.order_items),'manualEvents',(SELECT count(*) FROM private.manual_payment_events),'manualPayments',(SELECT count(*) FROM private.manual_order_payments),'bankProfiles',(SELECT count(*) FROM private.vendor_payment_profiles))) INTO actual;
 FOREACH k IN ARRAY ARRAY['functions','tables','counts','gatewayFlags','manual','delivery'] LOOP
 IF actual->k IS DISTINCT FROM expected->k THEN RAISE EXCEPTION 'Baseline % drift; recapture and review, never bypass',k;END IF;END LOOP;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['private.uat_security','private.pilot_policy','private.officebites_release_installations','private.assisted_controls','private.vendor_activation_requirements','private.vendor_legal_assignments','private.vendor_compliance_events','private.order_legal_acceptances']) n WHERE to_regclass(n) IS NOT NULL) THEN RAISE EXCEPTION 'Partial/full/legal installation conflict; integrated review required';END IF;
 IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261020100740') OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261021100655') THEN RAISE EXCEPTION 'Hosted semantic migration dependency missing';END IF;
END $$;$baseline$;
 SELECT md5(jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.orders o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.order_suborders o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.order_items o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY order_id) FROM private.manual_receivables o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM private.manual_receivable_entries o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM private.manual_payment_events o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.profiles o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.vendors o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY order_id) FROM private.manual_order_payments o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM private.vendor_payment_profiles o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.payment_attempts o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.ozow_attempts o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.standard_fee_ledger o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.acquisition_ledger o),
 (SELECT to_jsonb(o) FROM private.manual_payment_settings o),
 (SELECT to_jsonb(o) FROM private.delivery_settings o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY provider) FROM private.gateway_settings o)
 )::text) INTO original;
 EXECUTE $release_sql$-- SOURCE checks/uat/staging-security.sql
-- OPERATOR REVIEW ARTIFACT: staging only; NOT part of production migration chain.
-- Execute only via a verified eyhmarmekioovcjibcbr connection, after approval.
-- Caller must BEGIN and SET LOCAL officebites.verified_project_ref to that ref.
DO $$ BEGIN IF current_setting('officebites.verified_project_ref',true) IS DISTINCT FROM 'eyhmarmekioovcjibcbr' THEN RAISE EXCEPTION 'Verified staging target required';END IF;END $$;

CREATE TABLE private.uat_security (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 project_ref text NOT NULL CHECK(project_ref='eyhmarmekioovcjibcbr'),
 run text NOT NULL CHECK(run='OB-UAT-20261020'),
 capability_hash text CHECK(capability_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz,
 capture_salt uuid NOT NULL DEFAULT gen_random_uuid()
);
INSERT INTO private.uat_security(project_ref,run) VALUES('eyhmarmekioovcjibcbr','OB-UAT-20261020');
CREATE TABLE private.uat_actors (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 fixture text NOT NULL UNIQUE CHECK(fixture IN('vendorA','vendorB','customer','admin'))
);
CREATE TABLE private.uat_message_capture (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),
 run text NOT NULL CHECK(run='OB-UAT-20261020'),channel text NOT NULL CHECK(channel='email'),
 action text NOT NULL,recipient_hash text NOT NULL,suppressed boolean NOT NULL CHECK(suppressed)
);
ALTER TABLE private.uat_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.uat_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.uat_message_capture ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.uat_security,private.uat_actors,private.uat_message_capture FROM PUBLIC,anon,authenticated,service_role;

-- Intersect the existing account helper and restrictive public/Storage policies.
-- Retain its OID/grants for callers; preserve the exact prior definition for rollback.
CREATE FUNCTION private.uat_actor_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.uat_security s JOIN private.uat_actors a ON a.user_id=auth.uid()
 WHERE s.project_ref='eyhmarmekioovcjibcbr' AND s.expires_at>now())
$$;
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('private.active_account()'::regprocedure);
 EXECUTE replace(d,'FUNCTION private.active_account()','FUNCTION private.uat_original_active_account()');
END $$;
CREATE OR REPLACE FUNCTION private.active_account() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.uat_actor_allowed() AND private.uat_original_active_account()
$$;
REVOKE ALL ON FUNCTION private.uat_actor_allowed(),private.uat_original_active_account() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.uat_pre_request() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.uat_security%rowtype;h text;
BEGIN
 -- JWT role is validated by PostgREST, never supplied by an arbitrary HTTP header.
 IF auth.role()='service_role' THEN RETURN; END IF;
 SELECT * INTO STRICT s FROM private.uat_security;
 h:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-officebites-uat','');
 IF s.expires_at IS NULL OR s.expires_at<=now() OR s.capability_hash IS NULL
 OR length(h)<>64 OR encode(sha256(convert_to(h,'UTF8')),'hex')<>s.capability_hash
 OR (auth.uid() IS NOT NULL AND NOT private.active_account()) THEN
  RAISE EXCEPTION 'Staging UAT access required' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.uat_pre_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.uat_pre_request() TO anon,authenticated,service_role;

-- Private Postgres Auth hook: deliberately no HTTP/SMTP sender or raw payload capture.
CREATE FUNCTION private.uat_send_email(event jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.uat_security%rowtype;a text;
BEGIN
 SELECT * INTO STRICT s FROM private.uat_security;
 a:=event->'email_data'->>'email_action_type';
 -- Fixed enum prevents a malicious action/body from smuggling secrets into capture.
 IF a IS NULL OR a NOT IN('signup','recovery','invite','magiclink','email_change','email_change_new','reauthentication') THEN a:='other';END IF;
 INSERT INTO private.uat_message_capture(run,channel,action,recipient_hash,suppressed)
 VALUES(s.run,'email',a,encode(sha256(convert_to(s.capture_salt::text||coalesce(event->'user'->>'email',''),'UTF8')),'hex'),true);
 RETURN '{}'::jsonb;
END $$;
REVOKE ALL ON FUNCTION private.uat_send_email(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.uat_send_email(jsonb) TO supabase_auth_admin;
CREATE TRIGGER uat_capture_immutable BEFORE UPDATE OR DELETE ON private.uat_message_capture FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();

-- Deliberately does not enable a hook, select actors, set a secret or activate payments.
-- Separate reviewed configuration step must attach private.uat_pre_request to
-- authenticator's pgrst.db_pre_request, and attach uat_send_email in Auth dashboard.

-- SOURCE checks/pilot/booking-candidate.sql
-- LOCAL PROTOTYPE ONLY. Not a migration or a hosted installation script.
-- No public RPCs/grants; checkout integration and staging attestation are required
-- before generating a reviewed forward migration. Existing R15 policy untouched.

DO $$ BEGIN IF current_setting('officebites.verified_project_ref',true) IS DISTINCT FROM 'eyhmarmekioovcjibcbr' THEN RAISE EXCEPTION 'Verified staging target required';END IF;END $$;
CREATE TABLE private.pilot_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 hub text NOT NULL DEFAULT 'Eduvos, Umhlanga',
 collection_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK(collection_fee=0),
 delivery_fee numeric(12,2) NOT NULL DEFAULT 10 CHECK(delivery_fee>=0),
 delivery_settlement_approved boolean NOT NULL DEFAULT false,
 delivery_recipient text,
 CHECK(NOT delivery_settlement_approved OR (delivery_recipient IS NOT NULL AND length(btrim(delivery_recipient))>0))
);
INSERT INTO private.pilot_policy DEFAULT VALUES;
CREATE TABLE private.pilot_destinations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mode text NOT NULL CHECK(mode IN('collection','delivery')),
 label text NOT NULL CHECK(length(btrim(label))>0),
 approved boolean NOT NULL DEFAULT false,
 area text NOT NULL CHECK(area IN('Eduvos pickup','Umhlanga','Gateway')),
 CHECK((mode='collection' AND area='Eduvos pickup') OR
       (mode='delivery' AND area IN('Umhlanga','Gateway')))
);
CREATE TABLE private.pilot_windows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 mode text NOT NULL CHECK(mode IN('collection','delivery')),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 cutoff_at timestamptz NOT NULL,
 preparation_minutes integer NOT NULL CHECK(preparation_minutes BETWEEN 1 AND 10080),
 capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 10000),
 available boolean NOT NULL DEFAULT false,
 CHECK(ends_at>starts_at AND cutoff_at<starts_at)
);
CREATE TABLE private.pilot_bookings (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id),
 request_id uuid NOT NULL UNIQUE,
 window_id uuid NOT NULL REFERENCES private.pilot_windows(id),
 destination_id uuid NOT NULL REFERENCES private.pilot_destinations(id),
 snapshot jsonb NOT NULL,
 hold_until timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'held' CHECK(state IN('held','confirmed','released'))
);
CREATE INDEX pilot_booking_capacity ON private.pilot_bookings(window_id,state,hold_until);
ALTER TABLE private.pilot_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.pilot_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.pilot_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.pilot_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.pilot_policy,private.pilot_destinations,private.pilot_windows,
 private.pilot_bookings FROM PUBLIC,anon,authenticated,service_role;

-- Internal only. A future authenticated wrapper must check active admin,
-- independent approval, expected revision, reason and idempotency for config writes.
-- No activation or configuration writer is exposed by this candidate.
CREATE FUNCTION private.pilot_quote(p_vendor uuid,p_window uuid,p_destination uuid,p_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p private.pilot_policy%rowtype; w private.pilot_windows%rowtype;
 d private.pilot_destinations%rowtype; fee numeric;
BEGIN
 SELECT * INTO STRICT p FROM private.pilot_policy WHERE singleton=true FOR SHARE;
 IF NOT p.enabled OR p.revision IS DISTINCT FROM p_revision THEN
  RAISE EXCEPTION 'Pilot unavailable or policy changed'; END IF;
 SELECT * INTO STRICT w FROM private.pilot_windows WHERE id=p_window FOR UPDATE;
 SELECT * INTO STRICT d FROM private.pilot_destinations WHERE id=p_destination FOR SHARE;
 IF NOT w.available OR w.vendor_id<>p_vendor OR NOT d.approved OR d.mode<>w.mode THEN
  RAISE EXCEPTION 'Window or destination unavailable'; END IF;
 IF clock_timestamp()>=least(w.cutoff_at,w.starts_at-make_interval(mins=>w.preparation_minutes))
    OR clock_timestamp()>=w.starts_at THEN RAISE EXCEPTION 'Booking cutoff passed'; END IF;
 -- Keep the current previous-day 19:00 SAST rule until separately approved.
 IF clock_timestamp()>=(((w.starts_at AT TIME ZONE 'Africa/Johannesburg')::date-1)::timestamp
    +interval '19 hours') AT TIME ZONE 'Africa/Johannesburg' THEN
  RAISE EXCEPTION 'Ordering cutoff passed'; END IF;
 IF d.mode='delivery' AND (NOT p.delivery_settlement_approved OR p.delivery_recipient IS NULL) THEN
  RAISE EXCEPTION 'Delivery settlement approval required'; END IF;
 IF (SELECT count(*) FROM private.pilot_bookings WHERE window_id=w.id
     AND (state='confirmed' OR (state='held' AND hold_until>clock_timestamp())))>=w.capacity THEN
  RAISE EXCEPTION 'Window full'; END IF;
 fee:=CASE WHEN d.mode='collection' THEN p.collection_fee ELSE p.delivery_fee END;
 RETURN jsonb_build_object('policyRevision',p.revision,'hub',p.hub,'originMode','CENTRAL',
  'vendorId',w.vendor_id,'windowId',w.id,'mode',d.mode,'startsAt',w.starts_at,'endsAt',w.ends_at,
  'cutoffAt',w.cutoff_at,'preparationMinutes',w.preparation_minutes,'destinationId',d.id,
  'destinationLabel',d.label,'area',d.area,'fee',fee,'currency','ZAR',
  'deliveryRecipient',CASE WHEN d.mode='delivery' THEN p.delivery_recipient ELSE NULL END);
END $$;

-- Call only from the future atomic order creator, before returning instructions.
-- It MUST price the order/manual payment with the quoted fee in that transaction.
-- This function verifies that invariant; it never patches an immutable payment.
CREATE FUNCTION private.pilot_reserve(p_order uuid,p_window uuid,p_destination uuid,
 p_revision bigint,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE o public.orders%rowtype; m private.manual_order_payments%rowtype;
 b private.pilot_bookings%rowtype; s jsonb; food numeric; deadline timestamptz;
BEGIN
 IF p_request IS NULL THEN RAISE EXCEPTION 'Request key required'; END IF;
 -- Common lock order with payment verification: order, then manual payment.
 SELECT * INTO STRICT o FROM public.orders WHERE id=p_order FOR UPDATE;
 SELECT * INTO STRICT m FROM private.manual_order_payments WHERE order_id=p_order FOR UPDATE;
 SELECT * INTO b FROM private.pilot_bookings WHERE order_id=p_order;
 IF FOUND THEN
  IF b.request_id<>p_request OR b.window_id<>p_window OR b.destination_id<>p_destination
     OR (b.snapshot->>'policyRevision')::bigint IS DISTINCT FROM p_revision THEN
   RAISE EXCEPTION 'Booking request changed'; END IF;
  RETURN b.snapshot;
 END IF;
 IF o.status::text<>'pending_payment' OR m.state<>'awaiting_payment' OR m.deadline<=clock_timestamp() THEN
  RAISE EXCEPTION 'Unpaid active order required'; END IF;
 IF m.method NOT IN('manual_eft','manual_payshap') OR
    NOT coalesce((public.get_vendor_manual_methods(m.vendor_id)->>m.method)::boolean,false) THEN
  RAISE EXCEPTION 'Approved vendor payment method required'; END IF;
 s:=private.pilot_quote(m.vendor_id,p_window,p_destination,p_revision);
 IF (SELECT count(*) FROM public.order_suborders WHERE order_id=p_order)<>1 OR
    EXISTS(SELECT 1 FROM public.order_suborders WHERE order_id=p_order AND vendor_id<>m.vendor_id) THEN
  RAISE EXCEPTION 'One matching vendor required'; END IF;
 SELECT sum(subtotal) INTO food FROM public.order_suborders WHERE order_id=p_order;
 IF food IS NULL OR m.amount IS DISTINCT FROM food+(s->>'fee')::numeric
    OR o.total IS DISTINCT FROM m.amount THEN RAISE EXCEPTION 'Order fee snapshot mismatch'; END IF;
 IF o.delivery_date IS DISTINCT FROM ((s->>'startsAt')::timestamptz AT TIME ZONE 'Africa/Johannesburg')::date THEN
  RAISE EXCEPTION 'Order date and window differ'; END IF;
 deadline:=least(m.deadline,(s->>'cutoffAt')::timestamptz,
  (s->>'startsAt')::timestamptz-make_interval(mins=>(s->>'preparationMinutes')::integer));
 INSERT INTO private.pilot_bookings(order_id,request_id,window_id,destination_id,snapshot,hold_until)
 VALUES(p_order,p_request,p_window,p_destination,s,deadline);
 RETURN s;
END $$;

CREATE FUNCTION private.pilot_snapshot_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Booking history is immutable'; END IF;
 IF (to_jsonb(NEW)-'state') IS DISTINCT FROM (to_jsonb(OLD)-'state') OR
    (OLD.state='released' AND NEW.state<>'released') OR
    (OLD.state='confirmed' AND NEW.state='held') THEN
  RAISE EXCEPTION 'Booking snapshot is immutable; controlled rescheduling required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pilot_snapshot_guard BEFORE UPDATE OR DELETE ON private.pilot_bookings
 FOR EACH ROW EXECUTE FUNCTION private.pilot_snapshot_guard();

-- Runs in the payment transaction: a late receipt cannot overbook a released hold.
CREATE FUNCTION private.pilot_payment_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b private.pilot_bookings%rowtype;
BEGIN
 IF NEW.state='paid' AND OLD.state IS DISTINCT FROM 'paid' THEN
  SELECT * INTO b FROM private.pilot_bookings WHERE order_id=NEW.order_id FOR UPDATE;
  IF FOUND THEN
   IF b.state<>'held' OR b.hold_until<=clock_timestamp() THEN
    RAISE EXCEPTION 'Booking expired; reconcile receipt and reschedule or refund independently'; END IF;
   UPDATE private.pilot_bookings SET state='confirmed' WHERE order_id=NEW.order_id;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pilot_payment_guard BEFORE UPDATE OF state ON private.manual_order_payments
 FOR EACH ROW EXECUTE FUNCTION private.pilot_payment_guard();
CREATE FUNCTION private.pilot_cancel_release() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status::text='cancelled' THEN
  UPDATE private.pilot_bookings SET state='released' WHERE order_id=NEW.id AND state<>'released';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pilot_cancel_release AFTER UPDATE OF status ON public.orders
 FOR EACH ROW EXECUTE FUNCTION private.pilot_cancel_release();
-- Expired holds stop counting immediately even if cleanup is delayed. No scheduler
-- is installed. Payment reports and disputes never extend the reservation TTL.
REVOKE ALL ON FUNCTION private.pilot_quote(uuid,uuid,uuid,bigint),
 private.pilot_reserve(uuid,uuid,uuid,bigint,uuid),private.pilot_snapshot_guard(),
 private.pilot_payment_guard(),private.pilot_cancel_release() FROM PUBLIC,anon,authenticated,service_role;

-- SOURCE checks/pilot/atomic-collection-candidate.sql
-- LOCAL ONLY. Depends on booking-candidate.sql and existing manual-payment SQL.
-- Not a hosted migration. No delivery activation, price changes or accounts.

DO $$ BEGIN IF current_setting('officebites.verified_project_ref',true) IS DISTINCT FROM 'eyhmarmekioovcjibcbr' THEN RAISE EXCEPTION 'Verified staging target required';END IF;END $$;
ALTER TABLE private.pilot_windows ADD COLUMN revision bigint NOT NULL DEFAULT 1;
CREATE TABLE private.collection_activation (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 eft_until timestamptz, approval_reference text,
 CHECK(eft_until IS NULL OR (approval_reference IS NOT NULL AND length(btrim(approval_reference))>=15))
);
INSERT INTO private.collection_activation DEFAULT VALUES;
CREATE TABLE private.collection_agreements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vendor_id uuid NOT NULL REFERENCES public.vendors,
 version text NOT NULL CHECK(length(btrim(version)) BETWEEN 1 AND 100),
 revision bigint NOT NULL CHECK(revision>0),
 rate numeric NOT NULL CHECK(rate BETWEEN 0 AND 1),
 approved_by uuid NOT NULL, evidence text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(vendor_id,version)
);
CREATE TABLE private.collection_financials (
 order_id uuid PRIMARY KEY REFERENCES public.orders, vendor_id uuid NOT NULL REFERENCES public.vendors,
 vendor_name text NOT NULL,
 agreement_id uuid NOT NULL REFERENCES private.collection_agreements,
 agreement_version text NOT NULL, agreement_revision bigint NOT NULL, rate numeric NOT NULL, eligible_food numeric(12,2) NOT NULL,
 commission numeric(12,2) NOT NULL, collection_fee numeric(12,2) NOT NULL CHECK(collection_fee=0),
 profile_id uuid NOT NULL REFERENCES private.vendor_payment_profiles,
 reference text NOT NULL
);
CREATE TABLE private.collection_requests (
 request_id uuid PRIMARY KEY, payload jsonb NOT NULL, order_id uuid NOT NULL UNIQUE REFERENCES public.orders
);
CREATE TABLE private.collection_config_requests (
 request_id uuid PRIMARY KEY, actor_id uuid NOT NULL, payload jsonb NOT NULL, result jsonb NOT NULL
);
CREATE TABLE private.collection_refund_requests (
 order_id uuid NOT NULL REFERENCES public.orders, action_key text NOT NULL,
 payload jsonb NOT NULL, PRIMARY KEY(order_id,action_key)
);
-- Durable, transactionally captured events ONLY. No transport/worker is installed.
-- No contact, bank data or notification recipient is stored in this outbox.
CREATE TABLE private.collection_outbox (
 order_id uuid NOT NULL REFERENCES public.orders, event text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(order_id,event)
);
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['collection_agreements','collection_financials','collection_requests','collection_config_requests','collection_outbox','collection_refund_requests'] LOOP
  EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated,service_role',n);
  EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON private.%I FOR EACH ROW EXECUTE FUNCTION private.manual_immutable()',n);
 END LOOP;
END $$;
ALTER TABLE private.collection_activation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.collection_activation FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.collection_activation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.enabled AND NEW.provider IN('manual_eft','manual_payshap') AND
 (NEW.provider<>'manual_eft' OR NOT EXISTS(SELECT 1 FROM private.collection_activation a
 CROSS JOIN private.pilot_policy p WHERE a.singleton=true AND p.singleton=true AND p.enabled AND a.eft_until>clock_timestamp())) THEN
  RAISE EXCEPTION 'Separately authorised collection EFT unlock required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER collection_activation_guard BEFORE INSERT OR UPDATE ON private.gateway_settings FOR EACH ROW EXECUTE FUNCTION private.collection_activation_guard();
ALTER FUNCTION public.get_vendor_manual_methods(uuid) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.get_vendor_manual_methods(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.get_vendor_manual_methods(p_vendor_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.get_vendor_manual_methods(p_vendor_id)||jsonb_build_object('manual_payshap',false,'manual_eft',
 coalesce((private.get_vendor_manual_methods(p_vendor_id)->>'manual_eft')::boolean,false)
 AND EXISTS(SELECT 1 FROM private.collection_activation a CROSS JOIN private.pilot_policy p
 WHERE a.singleton=true AND p.singleton=true AND p.enabled AND a.eft_until>clock_timestamp()))
$$;
REVOKE ALL ON FUNCTION public.get_vendor_manual_methods(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_manual_methods(uuid) TO anon,authenticated;

-- Reuse the entire existing manual-order lifecycle privately. Legacy callers
-- cannot bypass a collection reservation when collection enforcement is enabled.
ALTER FUNCTION public.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.create_manual_order(p_customer_id uuid,p_guest_name text,p_guest_contact text,p_guest_email text,p_delivery_date date,p_delivery_location text,p_items jsonb,p_quote_id uuid,p_method text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE enabled boolean;
BEGIN
 SELECT p.enabled INTO STRICT enabled FROM private.pilot_policy p WHERE singleton=true FOR SHARE;
 IF enabled THEN RAISE EXCEPTION 'Refresh checkout and select an approved collection window'; END IF;
 RETURN private.create_manual_order(p_customer_id,p_guest_name,p_guest_contact,p_guest_email,p_delivery_date,p_delivery_location,p_items,p_quote_id,p_method,p_request_id);
END $$;

CREATE FUNCTION public.get_collection_options(p_vendor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p private.pilot_policy%rowtype;
BEGIN
 SELECT * INTO STRICT p FROM private.pilot_policy WHERE singleton=true;
 RETURN jsonb_build_object('enabled',p.enabled,'revision',p.revision,'fee',0,'hub',p.hub,
 'windows',CASE WHEN p.enabled THEN (SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',w.id,'revision',w.revision,'startsAt',w.starts_at,'endsAt',w.ends_at,
  'destinationId',d.id,'destinationLabel',d.label,'remaining',w.capacity-(SELECT count(*) FROM private.pilot_bookings b
    WHERE b.window_id=w.id AND (b.state='confirmed' OR (b.state='held' AND b.hold_until>clock_timestamp())))) ORDER BY w.starts_at,d.id),'[]')
 FROM private.pilot_windows w CROSS JOIN private.pilot_destinations d
 WHERE w.vendor_id=p_vendor_id AND w.mode='collection' AND w.available AND d.mode='collection' AND d.approved
 AND w.starts_at>clock_timestamp() AND least(w.cutoff_at,w.starts_at-make_interval(mins=>w.preparation_minutes))>clock_timestamp()
 AND (((w.starts_at AT TIME ZONE 'Africa/Johannesburg')::date-1)::timestamp+interval '19 hours') AT TIME ZONE 'Africa/Johannesburg'>clock_timestamp()
 AND EXISTS(SELECT 1 FROM private.collection_agreements a WHERE a.vendor_id=w.vendor_id)
 AND (SELECT count(*) FROM private.pilot_bookings b WHERE b.window_id=w.id
   AND (b.state='confirmed' OR (b.state='held' AND b.hold_until>clock_timestamp())))<w.capacity)
 ELSE '[]'::jsonb END);
END $$;

CREATE FUNCTION public.create_collection_order(p_customer_id uuid,p_guest_name text,p_guest_contact text,
 p_items jsonb,p_method text,p_request_id uuid,p_window_id uuid,p_destination_id uuid,
 p_policy_revision bigint,p_window_revision bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE payload jsonb; previous private.collection_requests%rowtype;
 w private.pilot_windows%rowtype; a private.collection_agreements%rowtype;
 snapshot jsonb; r jsonb; v uuid; food numeric; m private.manual_order_payments%rowtype;
BEGIN
 IF p_request_id IS NULL OR p_customer_id IS DISTINCT FROM auth.uid()
 OR (auth.uid() IS NOT NULL AND NOT private.active_account()) THEN
  RAISE EXCEPTION 'Checkout identity and request key required' USING ERRCODE='42501'; END IF;
 IF p_method IS DISTINCT FROM 'manual_eft' THEN RAISE EXCEPTION 'Collection EFT only; PayShap requires separate UAT'; END IF;
 IF auth.uid() IS NULL AND (NOT coalesce(public.valid_sa_mobile(p_guest_contact),false) OR nullif(btrim(p_guest_name),'') IS NULL) THEN
  RAISE EXCEPTION 'Valid guest name and mobile required'; END IF;
 payload:=jsonb_build_array(p_customer_id,p_guest_name,p_guest_contact,p_items,p_method,p_window_id,p_destination_id,p_policy_revision,p_window_revision);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO previous FROM private.collection_requests WHERE request_id=p_request_id;
 IF FOUND THEN
  IF previous.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Checkout request changed'; END IF;
  SELECT public.order_to_json(o)||jsonb_build_object('payment_token',mp.token,'collection',b.snapshot) INTO r
   FROM public.orders o JOIN private.manual_order_payments mp ON mp.order_id=o.id
   JOIN private.pilot_bookings b ON b.order_id=o.id WHERE o.id=previous.order_id;
  RETURN r;
 END IF;
 IF EXISTS(SELECT 1 FROM private.manual_order_payments WHERE request_id=p_request_id) THEN
  RAISE EXCEPTION 'Request key belongs to another checkout'; END IF;
 -- All new collection transactions acquire policy -> window before creating an
 -- order. Existing order mutations acquire order -> payment -> booking only.
 PERFORM 1 FROM private.pilot_policy WHERE singleton=true AND enabled AND revision=p_policy_revision FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Collection unavailable or policy changed'; END IF;
 PERFORM 1 FROM private.collection_activation WHERE singleton=true AND eft_until>clock_timestamp() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Collection EFT unlock required'; END IF;
 SELECT * INTO STRICT w FROM private.pilot_windows WHERE id=p_window_id FOR UPDATE;
 IF w.mode<>'collection' OR w.revision IS DISTINCT FROM p_window_revision THEN
  RAISE EXCEPTION 'Collection window changed'; END IF;
 v:=w.vendor_id;
 snapshot:=private.pilot_quote(v,w.id,p_destination_id,p_policy_revision);
 IF (snapshot->>'fee')::numeric<>0 THEN RAISE EXCEPTION 'Paid collection is not authorised'; END IF;
 SELECT * INTO a FROM private.collection_agreements WHERE vendor_id=v ORDER BY revision DESC,id DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Approved commission agreement required'; END IF;
 -- Never alter or reinterpret the legacy R15 policy. Avoid conflicting origin
 -- snapshots and quotes: collection requires legacy delivery enforcement OFF.
 PERFORM 1 FROM private.delivery_settings WHERE enabled FOR SHARE;
 IF FOUND OR EXISTS(SELECT 1 FROM private.vendor_delivery_origins WHERE vendor_id=v AND mode='VENDOR') THEN
  RAISE EXCEPTION 'Collection requires inactive delivery and central origin'; END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Cart required'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x JOIN public.meals meal ON meal.id=(x->>'mealId')::uuid WHERE meal.vendor_id<>v) THEN
  RAISE EXCEPTION 'Cart vendor and window differ'; END IF;
 r:=private.create_manual_order(p_customer_id,p_guest_name,p_guest_contact,NULL,
  (w.starts_at AT TIME ZONE 'Africa/Johannesburg')::date,snapshot->>'destinationLabel',p_items,NULL,p_method,p_request_id);
 SELECT * INTO STRICT m FROM private.manual_order_payments WHERE order_id=(r->>'id')::uuid;
 SELECT sum(subtotal) INTO food FROM public.order_suborders WHERE order_id=m.order_id;
 INSERT INTO private.collection_financials(order_id,vendor_id,vendor_name,agreement_id,agreement_version,agreement_revision,rate,eligible_food,commission,collection_fee,profile_id,reference)
 VALUES(m.order_id,v,(SELECT name FROM public.vendors WHERE id=v),a.id,a.version,a.revision,a.rate,food,round(food*a.rate,2),0,m.profile_id,r->>'ticket_number');
 snapshot:=private.pilot_reserve(m.order_id,w.id,p_destination_id,p_policy_revision,p_request_id);
 INSERT INTO private.collection_requests VALUES(p_request_id,payload,m.order_id);
 INSERT INTO private.collection_outbox(order_id,event) VALUES(m.order_id,'collection_created');
 RETURN r||jsonb_build_object('collection',snapshot);
END $$;

-- Snapshot the agreed rate at checkout; retain historical paid function/guards.
DO $$ DECLARE definition text; needle text:='SELECT commission_rate,name INTO NEW.commission_rate_snapshot,NEW.vendor_name_snapshot FROM public.vendors WHERE id=NEW.vendor_id FOR SHARE;'; BEGIN
 SELECT pg_get_functiondef('private.snapshot_paid_commission()'::regprocedure) INTO definition;
 IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unexpected commission function drift'; END IF;
 definition:=replace(definition,needle,'SELECT coalesce((SELECT f.rate FROM private.collection_financials f WHERE f.order_id=NEW.order_id),v.commission_rate),v.name INTO NEW.commission_rate_snapshot,NEW.vendor_name_snapshot FROM public.vendors v WHERE v.id=NEW.vendor_id FOR SHARE;');
 EXECUTE definition;
END $$;
CREATE FUNCTION private.collection_food_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM private.collection_financials f WHERE f.order_id=OLD.order_id)
 AND (NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id OR NEW.subtotal IS DISTINCT FROM OLD.subtotal) THEN
  RAISE EXCEPTION 'Collection financial snapshots are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER collection_food_guard BEFORE UPDATE ON public.order_suborders FOR EACH ROW EXECUTE FUNCTION private.collection_food_guard();
CREATE FUNCTION private.collection_commit_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM private.collection_financials WHERE order_id=NEW.order_id) AND
 (NEW.hold_until<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM private.collection_activation WHERE singleton=true AND eft_until>clock_timestamp())) THEN
  RAISE EXCEPTION 'Collection reservation expired before commit'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER collection_commit_guard AFTER INSERT ON private.pilot_bookings
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.collection_commit_guard();
CREATE FUNCTION private.collection_event_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oid uuid; event_name text;
BEGIN
 IF TG_TABLE_NAME='orders' THEN
  IF NEW.status::text<>'cancelled' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  oid:=NEW.id;event_name:='cancelled';
 ELSE
  IF NEW.state IS NOT DISTINCT FROM OLD.state OR NEW.state NOT IN('paid','payment_reported') THEN RETURN NEW; END IF;
  oid:=NEW.order_id;event_name:=NEW.state;
 END IF;
 IF EXISTS(SELECT 1 FROM private.collection_financials WHERE order_id=oid) THEN
  INSERT INTO private.collection_outbox(order_id,event) VALUES(oid,event_name) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER collection_event_capture AFTER UPDATE OF state ON private.manual_order_payments FOR EACH ROW EXECUTE FUNCTION private.collection_event_capture();
CREATE TRIGGER collection_event_capture AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION private.collection_event_capture();
-- Keep the existing authorised lifecycle. Tighten natural-key replay for NEW
-- collection orders only; historical orders retain their original behaviour.
DO $$ DECLARE definition text; needle text; BEGIN
 SELECT pg_get_functiondef('public.verify_manual_payment(uuid,numeric,text,boolean)'::regprocedure) INTO definition;
 needle:='IF m.state=''paid'' THEN RETURN ''paid'';END IF;';
 IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unexpected receipt function drift'; END IF;
 EXECUTE replace(definition,needle,'IF m.state=''paid'' THEN IF EXISTS(SELECT 1 FROM private.collection_financials WHERE order_id=p_order_id) AND (m.verified_amount IS DISTINCT FROM p_amount OR m.bank_reference IS DISTINCT FROM btrim(p_bank_reference) OR coalesce(p_suspicious,true)) THEN RAISE EXCEPTION ''Receipt replay payload changed''; END IF; RETURN ''paid'';END IF;');
 SELECT pg_get_functiondef('public.record_manual_refund_status(uuid,text,numeric,numeric,text)'::regprocedure) INTO definition;
 needle:='IF EXISTS(SELECT 1 FROM private.manual_refund_events WHERE order_id=p_order_id AND evidence=p_evidence AND status=p_status) THEN RETURN;END IF;';
 IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unexpected refund function drift'; END IF;
 EXECUTE replace(definition,needle,'IF EXISTS(SELECT 1 FROM private.collection_financials WHERE order_id=p_order_id) THEN
 IF EXISTS(SELECT 1 FROM private.collection_refund_requests WHERE order_id=p_order_id AND action_key=p_status||md5(p_evidence)) THEN
 IF NOT EXISTS(SELECT 1 FROM private.collection_refund_requests WHERE order_id=p_order_id AND action_key=p_status||md5(p_evidence) AND payload=jsonb_build_array(p_evidence,p_amount,p_product_refund)) THEN RAISE EXCEPTION ''Refund replay payload changed''; END IF; RETURN; END IF;
 INSERT INTO private.collection_refund_requests VALUES(p_order_id,p_status||md5(p_evidence),jsonb_build_array(p_evidence,p_amount,p_product_refund)); END IF; '||needle);
 SELECT pg_get_functiondef('public.admin_cancel_refunded_manual_order(uuid,text)'::regprocedure) INTO definition;
 needle:='SELECT * INTO STRICT m FROM private.manual_order_payments WHERE order_id=p_order_id FOR UPDATE;';
 IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unexpected refund cancellation drift'; END IF;
 EXECUTE replace(definition,needle,needle||' IF EXISTS(SELECT 1 FROM private.collection_financials WHERE order_id=p_order_id) AND (SELECT status::text FROM public.orders WHERE id=p_order_id)=''cancelled'' THEN RETURN; END IF;');
END $$;
DO $$ DECLARE definition text; needle text:='''disputed'',m.disputed_at IS NOT NULL,'; BEGIN
 SELECT pg_get_functiondef('public.get_manual_payment(uuid,uuid)'::regprocedure) INTO definition;
 IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unexpected payment read contract drift'; END IF;
 definition:=replace(definition,needle,'''collection'',(SELECT b.snapshot||jsonb_build_object(''state'',CASE WHEN b.state=''held'' AND b.hold_until<=clock_timestamp() THEN ''expired'' ELSE b.state END,''holdUntil'',b.hold_until) FROM private.pilot_bookings b WHERE b.order_id=m.order_id),''disputed'',m.disputed_at IS NOT NULL,');
 EXECUTE definition;
END $$;

CREATE FUNCTION public.get_order_collection(p_order_id uuid,p_token uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 SELECT b.snapshot||jsonb_build_object('state',CASE WHEN b.state='held' AND b.hold_until<=clock_timestamp() THEN 'expired' ELSE b.state END,'holdUntil',b.hold_until)
 INTO result FROM private.pilot_bookings b JOIN public.orders o ON o.id=b.order_id
 JOIN private.manual_order_payments m ON m.order_id=o.id
 WHERE o.id=p_order_id AND ((auth.uid() IS NOT NULL AND private.active_account() AND
 (o.customer_id=auth.uid() OR private.manual_operator(m.vendor_id))) OR (auth.uid() IS NULL AND m.token=p_token));
 IF result IS NULL THEN RAISE EXCEPTION 'Order access required' USING ERRCODE='42501'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.admin_collection_workspace() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('policy',(SELECT to_jsonb(p) FROM private.pilot_policy p),
 'destinations',(SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]') FROM private.pilot_destinations d WHERE mode='collection'),
 'windows',(SELECT coalesce(jsonb_agg(to_jsonb(w) ORDER BY starts_at),'[]') FROM private.pilot_windows w WHERE mode='collection'));
END $$;
CREATE FUNCTION public.admin_collection_config(p_change jsonb,p_revision bigint,p_request_id uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous private.collection_config_requests%rowtype; payload jsonb; result jsonb; key uuid;
 current_revision bigint; used_capacity integer; w private.pilot_windows%rowtype;
BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 15 AND 1000 THEN RAISE EXCEPTION 'Request and audit reason required'; END IF;
 payload:=jsonb_build_array(p_change,p_revision,p_reason);
 IF (p_change->>'kind'='window' AND p_change-ARRAY['kind','id','vendorId','startsAt','endsAt','cutoffAt','preparationMinutes','capacity','available']<>'{}'::jsonb)
 OR (p_change->>'kind'='destination' AND p_change-ARRAY['kind','id','label','approved']<>'{}'::jsonb)
 OR (p_change->>'kind'='agreement' AND p_change-ARRAY['kind','id','vendorId','version','rate']<>'{}'::jsonb) THEN RAISE EXCEPTION 'Unexpected configuration fields'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO previous FROM private.collection_config_requests WHERE request_id=p_request_id;
 IF FOUND THEN
  IF previous.actor_id<>auth.uid() OR previous.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Configuration request changed'; END IF;
  RETURN previous.result;
 END IF;
 SELECT revision INTO STRICT current_revision FROM private.pilot_policy WHERE singleton=true FOR UPDATE;
 IF current_revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Configuration revision changed'; END IF;
 key:=coalesce((p_change->>'id')::uuid,gen_random_uuid());
 CASE p_change->>'kind'
 WHEN 'destination' THEN
  INSERT INTO private.pilot_destinations(id,mode,label,approved,area) VALUES(key,'collection',p_change->>'label',coalesce((p_change->>'approved')::boolean,false),'Eduvos pickup')
  ON CONFLICT(id) DO UPDATE SET label=excluded.label,approved=excluded.approved WHERE pilot_destinations.mode='collection';
  IF NOT FOUND THEN RAISE EXCEPTION 'Collection destination required'; END IF;
 WHEN 'window' THEN
  SELECT * INTO w FROM private.pilot_windows WHERE id=key FOR UPDATE;
  IF FOUND AND w.mode<>'collection' THEN RAISE EXCEPTION 'Collection window required'; END IF;
  SELECT count(*) INTO used_capacity FROM private.pilot_bookings WHERE window_id=key
   AND (state='confirmed' OR (state='held' AND hold_until>clock_timestamp()));
  IF used_capacity>(p_change->>'capacity')::integer THEN RAISE EXCEPTION 'Capacity below active reservations'; END IF;
  IF EXISTS(SELECT 1 FROM private.pilot_bookings WHERE window_id=key) AND
   (w.vendor_id IS DISTINCT FROM (p_change->>'vendorId')::uuid OR w.starts_at IS DISTINCT FROM (p_change->>'startsAt')::timestamptz OR w.ends_at IS DISTINCT FROM (p_change->>'endsAt')::timestamptz) THEN
   RAISE EXCEPTION 'Booked window requires controlled rescheduling'; END IF;
  INSERT INTO private.pilot_windows(id,vendor_id,mode,starts_at,ends_at,cutoff_at,preparation_minutes,capacity,available)
  VALUES(key,(p_change->>'vendorId')::uuid,'collection',(p_change->>'startsAt')::timestamptz,(p_change->>'endsAt')::timestamptz,(p_change->>'cutoffAt')::timestamptz,(p_change->>'preparationMinutes')::integer,(p_change->>'capacity')::integer,coalesce((p_change->>'available')::boolean,false))
  ON CONFLICT(id) DO UPDATE SET vendor_id=excluded.vendor_id,starts_at=excluded.starts_at,ends_at=excluded.ends_at,cutoff_at=excluded.cutoff_at,preparation_minutes=excluded.preparation_minutes,capacity=excluded.capacity,available=excluded.available,revision=pilot_windows.revision+1;
 WHEN 'agreement' THEN
  IF EXISTS(SELECT 1 FROM public.vendors WHERE id=(p_change->>'vendorId')::uuid AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Independent agreement approver required'; END IF;
  INSERT INTO private.collection_agreements(id,vendor_id,version,revision,rate,approved_by,evidence)
  VALUES(key,(p_change->>'vendorId')::uuid,p_change->>'version',current_revision+1,(p_change->>'rate')::numeric,auth.uid(),p_reason);
 ELSE RAISE EXCEPTION 'Only collection destination, window or agreement configuration is supported';
 END CASE;
 UPDATE private.pilot_policy SET revision=revision+1 WHERE singleton=true RETURNING revision INTO current_revision;
 result:=jsonb_build_object('id',key,'revision',current_revision);
 INSERT INTO private.business_audit(actor_id,action,reason,details) VALUES(auth.uid(),'collection_config',p_reason,jsonb_build_object('requestId',p_request_id,'change',p_change,'revision',current_revision));
 INSERT INTO private.collection_config_requests VALUES(p_request_id,auth.uid(),payload,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.collection_food_guard(),private.collection_commit_guard(),private.collection_activation_guard(),private.collection_event_capture() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid),public.get_collection_options(uuid),
 public.create_collection_order(uuid,text,text,jsonb,text,uuid,uuid,uuid,bigint,bigint),public.get_order_collection(uuid,uuid),public.admin_collection_workspace(),public.admin_collection_config(jsonb,bigint,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid),public.get_collection_options(uuid),
 public.create_collection_order(uuid,text,text,jsonb,text,uuid,uuid,uuid,bigint,bigint),public.get_order_collection(uuid,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_collection_workspace(),public.admin_collection_config(jsonb,bigint,uuid,text) TO authenticated;
$release_sql$;
 SELECT md5(jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.orders o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.order_suborders o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.order_items o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY order_id) FROM private.manual_receivables o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM private.manual_receivable_entries o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM private.manual_payment_events o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.profiles o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.vendors o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY order_id) FROM private.manual_order_payments o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM private.vendor_payment_profiles o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.payment_attempts o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.ozow_attempts o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.standard_fee_ledger o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.acquisition_ledger o),
 (SELECT to_jsonb(o) FROM private.manual_payment_settings o),
 (SELECT to_jsonb(o) FROM private.delivery_settings o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY provider) FROM private.gateway_settings o)
 )::text) INTO restored;
 IF original IS DISTINCT FROM restored THEN RAISE EXCEPTION 'Historical financial/order data changed';END IF;
 CREATE TABLE private.officebites_eft_release_installations(name text PRIMARY KEY,payload_sha256 text NOT NULL,functions jsonb NOT NULL,historical_fingerprint text NOT NULL,installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
 ALTER TABLE private.officebites_eft_release_installations ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON private.officebites_eft_release_installations FROM PUBLIC,anon,authenticated,service_role;
 CREATE TRIGGER eft_installation_immutable BEFORE UPDATE OR DELETE ON private.officebites_eft_release_installations FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();
 SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),md5(pg_get_functiondef(p.oid)),p.proowner,p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private') AND p.prokind='f' INTO functions;
 INSERT INTO private.officebites_eft_release_installations(name,payload_sha256,functions,historical_fingerprint) VALUES('officebites_eft_20261026','0f65603281048631d437ef436272762b232763d1af57dabf094a97ae6f22deac',functions,original);
END $package$;
DO $$ DECLARE expected jsonb:=$eft_baseline${"roots":{"uat":false,"phaseB":false,"phaseC":false,"phaseD":false,"phaseE":false,"collection":false,"fullInstall":false},"counts":{"items":15,"orders":15,"suborders":15,"bankProfiles":0,"manualEvents":18,"manualPayments":0},"manual":{"minutes":15,"threshold":500},"tables":[{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"gateway_settings","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"manual_order_payments","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"manual_payment_settings","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres}","rls":true,"name":"vendor_payment_profiles","owner":"postgres","schema":"private"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}","rls":true,"name":"orders","owner":"postgres","schema":"public"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=rw/postgres}","rls":true,"name":"profiles","owner":"postgres","schema":"public"},{"acl":"{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,anon=r/postgres,authenticated=rw/postgres}","rls":true,"name":"vendors","owner":"postgres","schema":"public"}],"delivery":{"fee":15,"enabled":false,"revision":2},"functions":[{"acl":"{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}","md5":"5bda4a148d4f52474014f31f90b49cdf","owner":"postgres","config":["search_path=\"\""],"signature":"private.active_account()","securityDefiner":true},{"acl":"{postgres=X/postgres}","md5":"d66dff3346ea0241a989a2c060227236","owner":"postgres","config":["search_path=public"],"signature":"private.create_order_core(uuid, text, text, text, date, text, jsonb)","securityDefiner":true},{"acl":"{postgres=X/postgres}","md5":"36d73e384b63626498cbe054c1d5da31","owner":"postgres","config":["search_path=\"\""],"signature":"private.create_order_with_delivery(uuid, text, text, text, date, text, jsonb, uuid)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","md5":"7c0a398be18ece9e1940840fe692ea6c","owner":"postgres","config":["search_path=\"\""],"signature":"public.admin_manual_settings(boolean, boolean, integer, numeric, text)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}","md5":"6a52338e78c097c55bb8721bbcf451fe","owner":"postgres","config":["search_path=\"\""],"signature":"public.cancel_unpaid_order(uuid, text, text)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres,anon=X/postgres}","md5":"c4dc553530f2998f26e91475b7503a5e","owner":"postgres","config":["search_path=\"\""],"signature":"public.create_manual_order(uuid, text, text, text, date, text, jsonb, uuid, text, uuid)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres,anon=X/postgres}","md5":"52ac2c375a04a31aa46470456260c929","owner":"postgres","config":["search_path=\"\""],"signature":"public.get_vendor_manual_methods(uuid)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","md5":"1185d494ac41ab09d2b83f3e263582cd","owner":"postgres","config":["search_path=public"],"signature":"public.order_to_json(orders)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","md5":"7996f9c65a3cf770c3eb91f7a2b650a2","owner":"postgres","config":["search_path=\"\""],"signature":"public.record_manual_refund_status(uuid, text, numeric, numeric, text)","securityDefiner":true},{"acl":"{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}","md5":"c35b9e7c3fecb979f70c81cda16938cb","owner":"postgres","config":["search_path=\"\""],"signature":"public.verify_manual_payment(uuid, numeric, text, boolean)","securityDefiner":true}],"observedUtc":"2026-10-26T13:20:08.96871+00:00","gatewayFlags":[{"ready":true,"enabled":false,"provider":"manual_eft","maintenance":false},{"ready":true,"enabled":false,"provider":"manual_payshap","maintenance":false},{"ready":false,"enabled":false,"provider":"ozow","maintenance":true},{"ready":true,"enabled":false,"provider":"payfast","maintenance":false}],"project":"eyhmarmekioovcjibcbr","projectName":"officebites-staging","scope":"read-only metadata; not approval"}$eft_baseline$::jsonb;actual jsonb; BEGIN
 SELECT jsonb_build_object('gatewayFlags',(SELECT jsonb_agg(jsonb_build_object('provider',provider,'enabled',enabled,'ready',ready,'maintenance',maintenance) ORDER BY provider) FROM private.gateway_settings),'manual',(SELECT jsonb_build_object('minutes',deadline_minutes,'threshold',review_threshold) FROM private.manual_payment_settings WHERE singleton),'delivery',(SELECT jsonb_build_object('enabled',enabled,'fee',paid_fee,'revision',revision) FROM private.delivery_settings)) INTO actual;
 IF actual IS DISTINCT FROM jsonb_build_object('gatewayFlags',expected->'gatewayFlags','manual',expected->'manual','delivery',expected->'delivery') OR EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled) THEN RAISE EXCEPTION 'Payment/settings/ready/maintenance baseline drift; no changes authorised'; END IF;
END $$;DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.uat_security WHERE expires_at IS NOT NULL OR capability_hash IS NOT NULL) OR EXISTS(SELECT 1 FROM private.uat_actors) THEN RAISE EXCEPTION 'UAT actor/window not closed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.pilot_policy WHERE singleton AND NOT enabled AND collection_fee=0 AND NOT delivery_settlement_approved AND delivery_recipient IS NULL) OR EXISTS(SELECT 1 FROM private.collection_activation WHERE eft_until IS NOT NULL) THEN RAISE EXCEPTION 'Collection/settlement gate not closed';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND (c.relname LIKE 'pilot_%' OR c.relname LIKE 'collection_%' OR c.relname LIKE 'uat_%' OR c.relname='officebites_eft_release_installations') AND c.relkind='r' AND (NOT c.relrowsecurity OR pg_get_userbyid(c.relowner)<>'postgres' OR has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) THEN RAISE EXCEPTION 'Private table/RLS/ACL violation';END IF;
 IF has_function_privilege('authenticated','private.uat_send_email(jsonb)','EXECUTE') OR has_function_privilege('anon','public.admin_collection_config(jsonb,bigint,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'RPC privilege violation';END IF;
 IF to_regclass('private.assisted_controls') IS NOT NULL OR to_regclass('private.cash_custody_policy') IS NOT NULL THEN RAISE EXCEPTION 'Unexpected cash/assisted scope';END IF;
END $$;