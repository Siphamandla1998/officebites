-- STAGING ONLY. Apply only as ONE approved Supabase apply_migration transaction.
-- The control-plane project_id MUST be eyhmarmekioovcjibcbr. SQL settings alone do not prove target identity.
-- No Auth/REST/Vercel configuration, actor provisioning, activation or notifications are authorised by this file.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(hashtextextended('officebites-staging-install-20261023',0));
SELECT set_config('officebites.verified_project_ref','eyhmarmekioovcjibcbr',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled) THEN RAISE EXCEPTION 'Payment method enabled';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.manual_payment_settings WHERE singleton AND deadline_minutes=15 AND review_threshold=500) THEN RAISE EXCEPTION 'Settings baseline differs';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.delivery_settings WHERE NOT enabled AND paid_fee=15) THEN RAISE EXCEPTION 'Delivery baseline differs';END IF;
END $$;

DO $package$ DECLARE original text; restored text; functions jsonb; recorded jsonb; digest text; BEGIN
 IF to_regclass('private.officebites_release_installations') IS NOT NULL THEN
  EXECUTE 'SELECT payload_sha256,functions FROM private.officebites_release_installations WHERE name=$1' INTO digest,recorded USING 'officebites_20261023';
  IF digest IS DISTINCT FROM 'bfece8414f6578896aff42fc96ee01e3a3847e8a46bb3d284fc896dd89eb525d' THEN RAISE EXCEPTION 'Different or partial package installed';END IF;
  SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),md5(pg_get_functiondef(p.oid)),p.proowner,p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private') AND p.prokind='f' INTO functions;
  IF functions IS DISTINCT FROM recorded THEN RAISE EXCEPTION 'Installed function/ACL drift';END IF;
  RETURN;
 END IF;
 EXECUTE $baseline$-- Read-only baseline assertion; use the verified staging connection only.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM (VALUES ('private.active_account()','5bda4a148d4f52474014f31f90b49cdf','{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}'),('public.admin_manual_settings(boolean,boolean,integer,numeric,text)','7c0a398be18ece9e1940840fe692ea6c','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),('public.cancel_unpaid_order(uuid,text,text)','6a52338e78c097c55bb8721bbcf451fe','{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}'),('public.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid)','c4dc553530f2998f26e91475b7503a5e','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres,anon=X/postgres}'),('private.create_order_core(uuid,text,text,text,date,text,jsonb)','d66dff3346ea0241a989a2c060227236','{postgres=X/postgres}'),('private.create_order_with_delivery(uuid,text,text,text,date,text,jsonb,uuid)','36d73e384b63626498cbe054c1d5da31','{postgres=X/postgres}'),('public.get_vendor_manual_methods(uuid)','52ac2c375a04a31aa46470456260c929','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres,anon=X/postgres}'),('public.order_to_json(public.orders)','1185d494ac41ab09d2b83f3e263582cd','{postgres=X/postgres,service_role=X/postgres}'),('public.record_manual_refund_status(uuid,text,numeric,numeric,text)','7996f9c65a3cf770c3eb91f7a2b650a2','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}'),('public.verify_manual_payment(uuid,numeric,text,boolean)','c35b9e7c3fecb979f70c81cda16938cb','{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}')) x(signature,digest,acl) WHERE to_regprocedure(signature) IS NULL OR md5(pg_get_functiondef(to_regprocedure(signature)))<>digest OR (SELECT pg_get_userbyid(proowner)<>'postgres' OR proacl::text IS DISTINCT FROM x.acl FROM pg_proc WHERE oid=to_regprocedure(signature))) THEN RAISE EXCEPTION 'Baseline function/owner/ACL drift; stop and review';END IF;
 IF (SELECT count(*) FROM public.orders)<>15 OR (SELECT count(*) FROM public.order_suborders)<>15 OR (SELECT count(*) FROM public.order_items)<>15 OR (SELECT count(*) FROM private.manual_payment_events)<>18 OR (SELECT count(*) FROM private.manual_order_payments)<>0 OR (SELECT count(*) FROM private.vendor_payment_profiles)<>0 THEN RAISE EXCEPTION 'Baseline record counts changed';END IF;
 IF to_regclass('private.uat_security') IS NOT NULL OR to_regclass('private.pilot_policy') IS NOT NULL THEN RAISE EXCEPTION 'Partial or previous installation requires reconciliation';END IF;
 IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261021100655') THEN RAISE EXCEPTION 'Singleton migration dependency missing';END IF;
END $$;
$baseline$;
 LOCK TABLE public.orders,public.order_suborders,public.order_items,public.profiles,public.vendors,private.manual_receivables,private.manual_receivable_entries,private.manual_payment_events,private.manual_order_payments,private.vendor_payment_profiles,private.payment_attempts,private.ozow_attempts,private.standard_fee_ledger,private.acquisition_ledger,private.gateway_settings,private.manual_payment_settings IN SHARE ROW EXCLUSIVE MODE;
 SELECT md5(jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(o)-'order_source' ORDER BY id) FROM public.orders o),
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
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.acquisition_ledger o)
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

-- SOURCE checks/pilot/assisted-cash-candidate.sql
-- LOCAL CANDIDATE ONLY. Depends on atomic-collection-candidate.sql.
-- No new gateway, no delivery policy changes, no enabled runtime defaults.

DO $$ BEGIN IF current_setting('officebites.verified_project_ref',true) IS DISTINCT FROM 'eyhmarmekioovcjibcbr' THEN RAISE EXCEPTION 'Verified staging target required';END IF;END $$;
CREATE TABLE private.assisted_controls(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),assisted_until timestamptz,cash_until timestamptz,requests_until timestamptz);
INSERT INTO private.assisted_controls DEFAULT VALUES;
CREATE TABLE private.assisted_context(transaction_id bigint PRIMARY KEY,actor_id uuid NOT NULL,vendor_id uuid NOT NULL,metadata jsonb NOT NULL);
CREATE TABLE private.order_origins(order_id uuid PRIMARY KEY REFERENCES public.orders,source text NOT NULL,actor_id uuid,metadata jsonb NOT NULL);
CREATE TABLE private.service_dates(vendor_id uuid NOT NULL REFERENCES public.vendors,service_date date NOT NULL,enabled boolean NOT NULL,revision bigint NOT NULL DEFAULT 1,PRIMARY KEY(vendor_id,service_date));
CREATE TABLE private.service_date_actions(request_id uuid PRIMARY KEY,actor_id uuid NOT NULL,payload jsonb NOT NULL,result jsonb NOT NULL);
CREATE TABLE private.cash_authorisations(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,vendor_id uuid NOT NULL REFERENCES public.vendors,receiver_id uuid NOT NULL REFERENCES public.profiles,approved_by uuid NOT NULL,action text NOT NULL CHECK(action IN('approve','revoke')),evidence text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE private.cash_events(request_id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES public.orders,vendor_id uuid NOT NULL REFERENCES public.vendors,kind text NOT NULL CHECK(kind IN('report','receipt','refund')),amount numeric(12,2) NOT NULL CHECK(amount>0),receipt_identifier text NOT NULL,actor_id uuid NOT NULL,received_at timestamptz NOT NULL DEFAULT clock_timestamp(),payload jsonb NOT NULL,UNIQUE(vendor_id,kind,receipt_identifier));
CREATE INDEX cash_order_events ON private.cash_events(order_id);
CREATE TABLE private.receipt_context(transaction_id bigint PRIMARY KEY,order_id uuid NOT NULL,actor_id uuid NOT NULL,evidence text NOT NULL);
CREATE TABLE private.eft_verifications(vendor_id uuid NOT NULL REFERENCES public.vendors,reference text NOT NULL,order_id uuid NOT NULL REFERENCES public.orders,payload jsonb NOT NULL,result text NOT NULL,PRIMARY KEY(vendor_id,reference));
CREATE TABLE private.profile_revisions(profile_id uuid PRIMARY KEY REFERENCES private.vendor_payment_profiles,revision bigint GENERATED ALWAYS AS IDENTITY UNIQUE);
INSERT INTO private.profile_revisions(profile_id) SELECT id FROM private.vendor_payment_profiles ORDER BY created_at,id;
CREATE TABLE private.profile_revocations(profile_id uuid PRIMARY KEY REFERENCES private.vendor_payment_profiles,actor_id uuid NOT NULL,evidence text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE private.customer_order_requests(id uuid PRIMARY KEY,vendor_id uuid NOT NULL REFERENCES public.vendors,customer_id uuid,token uuid NOT NULL DEFAULT gen_random_uuid(),name text NOT NULL,phone text NOT NULL,items jsonb NOT NULL,service_date date NOT NULL,note text NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),converted_order_id uuid UNIQUE REFERENCES public.orders);
CREATE INDEX request_rate_limit ON private.customer_order_requests(vendor_id,phone,created_at);
CREATE TABLE private.order_request_events(request_id uuid NOT NULL REFERENCES private.customer_order_requests,action text NOT NULL,actor_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(request_id,action));
DO $$ DECLARE n text; BEGIN
 FOREACH n IN ARRAY ARRAY['assisted_controls','assisted_context','order_origins','service_dates','service_date_actions','cash_authorisations','cash_events','receipt_context','eft_verifications','profile_revisions','profile_revocations','customer_order_requests','order_request_events'] LOOP
 EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated,service_role',n);
 END LOOP;
 FOREACH n IN ARRAY ARRAY['order_origins','service_date_actions','cash_authorisations','cash_events','eft_verifications','profile_revisions','profile_revocations','order_request_events'] LOOP
 EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON private.%I FOR EACH ROW EXECUTE FUNCTION private.manual_immutable()',n);
 END LOOP;
END $$;
ALTER TABLE public.orders ADD COLUMN order_source text NOT NULL DEFAULT 'customer_web' CHECK(order_source IN('customer_web','admin_assisted','vendor_assisted'));
ALTER TABLE public.orders DROP CONSTRAINT orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK(payment_method IN('manual_eft','manual_payshap','payfast','ozow','cash'));
ALTER TABLE private.manual_order_payments DROP CONSTRAINT manual_order_payments_method_check;
ALTER TABLE private.manual_order_payments ADD CONSTRAINT manual_order_payments_method_check CHECK(method IN('manual_eft','manual_payshap','cash'));
ALTER TABLE private.manual_order_payments ALTER COLUMN profile_id DROP NOT NULL;
ALTER TABLE private.manual_order_payments ADD CONSTRAINT eft_profile_required CHECK(method='cash' OR profile_id IS NOT NULL);
ALTER TABLE private.manual_order_payments DROP CONSTRAINT manual_order_payments_confirmation_source_check;
ALTER TABLE private.manual_order_payments ADD CONSTRAINT manual_order_payments_confirmation_source_check CHECK(confirmation_source IN('vendor_bank_receipt','admin_bank_receipt','vendor_cash_receipt','admin_cash_receipt'));
ALTER TABLE private.collection_financials ALTER COLUMN profile_id DROP NOT NULL;

CREATE FUNCTION private.assisted_metadata() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT metadata||jsonb_build_object('actorId',actor_id,'vendorId',vendor_id) FROM private.assisted_context WHERE transaction_id=txid_current() AND actor_id=auth.uid()
$$;
CREATE FUNCTION private.checkout_customer() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT CASE WHEN private.assisted_metadata() IS NOT NULL THEN NULL ELSE auth.uid() END $$;
CREATE FUNCTION private.can_assist(v uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT private.active_account() AND (private.is_admin() OR EXISTS(SELECT 1 FROM public.vendors WHERE id=v AND owner_id=auth.uid() AND status='approved' AND archived_at IS NULL)) $$;
CREATE FUNCTION private.cash_receiver(v uuid,u uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT action='approve' FROM private.cash_authorisations WHERE vendor_id=v AND receiver_id=u ORDER BY id DESC LIMIT 1),false)
$$;
CREATE FUNCTION private.cash_vendor(v uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.vendors WHERE id=v AND status='approved' AND archived_at IS NULL AND private.cash_receiver(v,owner_id)) $$;
CREATE FUNCTION private.phase_unlocked(method text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT CASE WHEN method='cash' THEN EXISTS(SELECT 1 FROM private.assisted_controls WHERE singleton AND cash_until>clock_timestamp()) ELSE EXISTS(SELECT 1 FROM private.collection_activation WHERE singleton AND eft_until>clock_timestamp()) END $$;
CREATE FUNCTION private.profile_revision_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO private.profile_revisions(profile_id) VALUES(NEW.id);RETURN NEW;END $$;
CREATE TRIGGER phase_profile_revision AFTER INSERT ON private.vendor_payment_profiles FOR EACH ROW EXECUTE FUNCTION private.profile_revision_capture();
CREATE OR REPLACE FUNCTION private.get_vendor_manual_methods(p_vendor_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT jsonb_build_object('manual_eft',p.eft AND EXISTS(SELECT 1 FROM private.gateway_settings WHERE provider='manual_eft' AND enabled AND ready AND NOT maintenance),'manual_payshap',false)
 FROM private.vendor_payment_profiles p JOIN public.vendors v ON v.id=p.vendor_id JOIN public.profiles u ON u.id=v.owner_id
 WHERE p.id=(SELECT pr.profile_id FROM private.profile_revisions pr JOIN private.vendor_payment_profiles pp ON pp.id=pr.profile_id WHERE pp.vendor_id=p_vendor_id ORDER BY pr.revision DESC LIMIT 1)
 AND p.approved_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM private.profile_revocations r WHERE r.profile_id=p.id)
 AND v.status='approved' AND v.archived_at IS NULL AND NOT u.suspended AND u.deleted_at IS NULL),'{}'::jsonb)
$$;
CREATE FUNCTION private.cash_net(o uuid) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce(sum(CASE kind WHEN 'receipt' THEN amount WHEN 'refund' THEN -amount ELSE 0 END),0) FROM private.cash_events WHERE order_id=o $$;
CREATE FUNCTION private.origin_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE meta jsonb:=private.assisted_metadata(); BEGIN
 IF TG_OP='UPDATE' THEN IF NEW.order_source IS DISTINCT FROM OLD.order_source THEN RAISE EXCEPTION 'Order source immutable';END IF;RETURN NEW;END IF;
 INSERT INTO private.order_origins(order_id,source,actor_id,metadata) VALUES(NEW.id,coalesce(meta->>'source','customer_web'),auth.uid(),coalesce(meta,'{}'));
 RETURN NEW;
END $$;
CREATE TRIGGER phase_origin_capture AFTER INSERT OR UPDATE OF order_source ON public.orders FOR EACH ROW EXECUTE FUNCTION private.origin_capture();
-- Drift-checked edits of existing functions; no parallel order creation engine.
CREATE FUNCTION private.phase_replace(signature regprocedure,needle text,replacement text) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$ DECLARE definition text;BEGIN SELECT pg_get_functiondef(signature) INTO definition;IF position(needle IN definition)=0 THEN RAISE EXCEPTION 'Unexpected definition drift: %',signature;END IF;definition:=replace(definition,needle,replacement); IF needle='PERFORM 1 FROM private.gateway_settings WHERE provider=p_method AND enabled AND ready AND NOT maintenance FOR SHARE;' THEN definition:=replace(definition,'r:=private.create_order_with_delivery(', 'END IF; IF p_method=''cash'' THEN p.id:=NULL; p.destination:=jsonb_build_object(''vendorId'',v,''cashRecipient'',(SELECT name FROM public.vendors WHERE id=v));END IF; r:=private.create_order_with_delivery(');END IF; EXECUTE definition;END $$;
REVOKE ALL ON FUNCTION private.phase_replace(regprocedure,text,text) FROM PUBLIC,anon,authenticated,service_role;
SELECT private.phase_replace('public.order_to_json(public.orders)', '''id'',o.id,', '''order_source'',o.order_source,''id'',o.id,');
SELECT private.phase_replace('private.create_order_core(uuid,text,text,text,date,text,jsonb)','v_customer_id uuid := auth.uid();','v_customer_id uuid := private.checkout_customer();');
SELECT private.phase_replace('private.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid)','p_customer_id IS DISTINCT FROM auth.uid()','p_customer_id IS DISTINCT FROM private.checkout_customer()');
SELECT private.phase_replace('public.create_collection_order(uuid,text,text,jsonb,text,uuid,uuid,uuid,bigint,bigint)','p_customer_id IS DISTINCT FROM auth.uid()','p_customer_id IS DISTINCT FROM private.checkout_customer()');
SELECT private.phase_replace('public.create_collection_order(uuid,text,text,jsonb,text,uuid,uuid,uuid,bigint,bigint)','IF auth.uid() IS NULL AND','IF private.checkout_customer() IS NULL AND');
SELECT private.phase_replace('public.create_collection_order(uuid,text,text,jsonb,text,uuid,uuid,uuid,bigint,bigint)','IF p_method IS DISTINCT FROM ''manual_eft'' THEN','IF p_method IS DISTINCT FROM ''manual_eft'' AND NOT(p_method=''cash'' AND private.assisted_metadata() IS NOT NULL) THEN');
SELECT private.phase_replace('public.create_collection_order(uuid,text,text,jsonb,text,uuid,uuid,uuid,bigint,bigint)','p_policy_revision,p_window_revision);','p_policy_revision,p_window_revision,private.assisted_metadata());');
SELECT private.phase_replace('public.create_collection_order(uuid,text,text,jsonb,text,uuid,uuid,uuid,bigint,bigint)','PERFORM 1 FROM private.collection_activation WHERE singleton=true AND eft_until>clock_timestamp() FOR SHARE;','PERFORM 1 WHERE private.phase_unlocked(p_method);');
SELECT private.phase_replace('public.create_collection_order(uuid,text,text,jsonb,text,uuid,uuid,uuid,bigint,bigint)','v:=w.vendor_id;','v:=w.vendor_id; IF NOT EXISTS(SELECT 1 FROM private.service_dates WHERE vendor_id=v AND service_date=(w.starts_at AT TIME ZONE ''Africa/Johannesburg'')::date AND enabled FOR SHARE) THEN RAISE EXCEPTION ''Vendor has not enabled this service date''; END IF; IF private.assisted_metadata() IS NOT NULL AND (private.assisted_metadata()->>''vendorId'')::uuid<>v THEN RAISE EXCEPTION ''Assisted vendor mismatch'';END IF;');
SELECT private.phase_replace('public.create_collection_order(uuid,text,text,jsonb,text,uuid,uuid,uuid,bigint,bigint)','private.create_manual_order(p_customer_id,p_guest_name,p_guest_contact,NULL,','private.create_manual_order(p_customer_id,p_guest_name,p_guest_contact,private.assisted_metadata()->>''email'',');
SELECT private.phase_replace('private.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid)','p_method NOT IN(''manual_eft'',''manual_payshap'')','p_method NOT IN(''manual_eft'',''manual_payshap'',''cash'')');
SELECT private.phase_replace('private.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid)',
 'PERFORM 1 FROM private.gateway_settings WHERE provider=p_method AND enabled AND ready AND NOT maintenance FOR SHARE;',
 'IF p_method=''cash'' THEN IF private.assisted_metadata() IS NULL OR NOT private.phase_unlocked(''cash'') OR NOT private.cash_vendor(v) THEN RAISE EXCEPTION ''Approved assisted cash vendor required'';END IF; ELSE PERFORM 1 FROM private.gateway_settings WHERE provider=p_method AND enabled AND ready AND NOT maintenance FOR SHARE;');
SELECT private.phase_replace('private.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid)',
 'SELECT * INTO p FROM private.vendor_payment_profiles WHERE vendor_id=v AND approved_at IS NOT NULL ORDER BY approved_at DESC,id DESC LIMIT 1 FOR SHARE;',
 'SELECT * INTO p FROM private.vendor_payment_profiles WHERE vendor_id=v AND approved_at IS NOT NULL ORDER BY (SELECT revision FROM private.profile_revisions WHERE profile_id=vendor_payment_profiles.id) DESC LIMIT 1 FOR SHARE;');
SELECT private.phase_replace('private.pilot_reserve(uuid,uuid,uuid,bigint,uuid)','m.method NOT IN(''manual_eft'',''manual_payshap'')','m.method NOT IN(''manual_eft'',''manual_payshap'',''cash'')');
SELECT private.phase_replace('public.get_vendor_manual_methods(uuid)',
 'private.get_vendor_manual_methods(p_vendor_id)||jsonb_build_object(',
 'private.get_vendor_manual_methods(p_vendor_id)||jsonb_build_object(''cash'',private.phase_unlocked(''cash'') AND private.cash_vendor(p_vendor_id),');
SELECT private.phase_replace('private.collection_commit_guard()',
 'NOT EXISTS(SELECT 1 FROM private.collection_activation WHERE singleton=true AND eft_until>clock_timestamp())',
 'NOT private.phase_unlocked((SELECT method FROM private.manual_order_payments WHERE order_id=NEW.order_id))');
SELECT private.phase_replace('public.get_collection_options(uuid)','AND w.starts_at>clock_timestamp()',
 'AND EXISTS(SELECT 1 FROM private.service_dates sd WHERE sd.vendor_id=w.vendor_id AND sd.service_date=(w.starts_at AT TIME ZONE ''Africa/Johannesburg'')::date AND sd.enabled) AND w.starts_at>clock_timestamp()');
SELECT private.phase_replace('public.verify_manual_payment(uuid,numeric,text,boolean)',
 'IF NOT private.manual_operator(m.vendor_id) THEN',
 'IF NOT private.manual_operator(m.vendor_id) AND NOT (m.method=''cash'' AND private.active_account() AND private.cash_receiver(m.vendor_id,auth.uid())) THEN');
SELECT private.phase_replace('public.verify_manual_payment(uuid,numeric,text,boolean)',
 'a:=private.is_admin();',
 'IF EXISTS(SELECT 1 FROM private.order_origins WHERE order_id=p_order_id) THEN IF m.method=''cash'' AND private.cash_net(p_order_id)<>m.amount THEN RAISE EXCEPTION ''Full verified cash receipts required''; END IF; IF m.method=''manual_eft'' AND NOT EXISTS(SELECT 1 FROM private.receipt_context WHERE transaction_id=txid_current() AND order_id=p_order_id AND actor_id=auth.uid()) THEN RAISE EXCEPTION ''Independent bank verification evidence required''; END IF; END IF; a:=private.is_admin();');
SELECT private.phase_replace('public.verify_manual_payment(uuid,numeric,text,boolean)',
 'confirmation_source=CASE WHEN a THEN ''admin_bank_receipt'' ELSE ''vendor_bank_receipt'' END',
 'confirmation_source=CASE WHEN m.method=''cash'' THEN CASE WHEN a THEN ''admin_cash_receipt'' ELSE ''vendor_cash_receipt'' END ELSE CASE WHEN a THEN ''admin_bank_receipt'' ELSE ''vendor_bank_receipt'' END END');
SELECT private.phase_replace('public.verify_manual_payment(uuid,numeric,text,boolean)',
 'IF m.method=''cash'' AND private.cash_net(p_order_id)<>m.amount THEN',
 'IF m.method=''cash'' AND NOT private.cash_receiver(m.vendor_id,auth.uid()) AND NOT EXISTS(SELECT 1 FROM private.receipt_context WHERE transaction_id=txid_current() AND order_id=p_order_id AND actor_id=auth.uid()) THEN RAISE EXCEPTION ''Actual recipient or independently evidenced review required'';END IF; IF m.method=''cash'' AND private.cash_net(p_order_id)<>m.amount THEN');
SELECT private.phase_replace('public.record_manual_refund_status(uuid,text,numeric,numeric,text)',
 'IF p_status=''completed'' THEN',
 'IF p_status=''completed'' THEN IF m.method=''cash'' AND coalesce((SELECT sum(amount) FROM private.cash_events WHERE order_id=p_order_id AND kind=''refund''),0)<coalesce((SELECT sum(amount) FROM private.manual_receivable_entries WHERE order_id=p_order_id AND kind=''refund''),0)+coalesce(p_amount,0) THEN RAISE EXCEPTION ''Recorded actual cash refund required'';END IF;');
SELECT private.phase_replace('public.cancel_unpaid_order(uuid,text,text)',
 'IF o.status=''cancelled'' THEN RETURN public.order_to_json(o); END IF;',
 'IF EXISTS(SELECT 1 FROM private.manual_order_payments WHERE order_id=o.id AND method=''cash'') AND private.cash_net(o.id)>0 THEN RAISE EXCEPTION ''Cash received; refund and reconcile before cancelling'';END IF; IF o.status=''cancelled'' THEN RETURN public.order_to_json(o); END IF;');
DROP FUNCTION private.phase_replace(regprocedure,text,text);

CREATE FUNCTION public.vendor_set_service_date(p_vendor uuid,p_date date,p_enabled boolean,p_revision bigint,p_request uuid,p_reason text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous private.service_date_actions%rowtype; payload jsonb:=jsonb_build_array(p_vendor,p_date,p_enabled,p_revision,p_reason); version bigint; result jsonb;
BEGIN
 IF NOT private.active_account() OR NOT EXISTS(SELECT 1 FROM public.vendors WHERE id=p_vendor AND owner_id=auth.uid() AND status='approved' AND archived_at IS NULL) THEN RAISE EXCEPTION 'Vendor owner required';END IF;
 IF p_request IS NULL OR p_date<current_date OR length(btrim(coalesce(p_reason,'')))<15 THEN RAISE EXCEPTION 'Future date, request and evidence required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_vendor::text||p_date::text,0));
 SELECT * INTO previous FROM private.service_date_actions WHERE request_id=p_request;
 IF FOUND THEN IF previous.actor_id<>auth.uid() OR previous.payload<>payload THEN RAISE EXCEPTION 'Request changed';END IF;RETURN previous.result;END IF;
 SELECT revision INTO version FROM private.service_dates WHERE vendor_id=p_vendor AND service_date=p_date FOR UPDATE;
 IF coalesce(version,0) IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'Service date revision changed';END IF;
 INSERT INTO private.service_dates VALUES(p_vendor,p_date,p_enabled,1) ON CONFLICT(vendor_id,service_date) DO UPDATE SET enabled=excluded.enabled,revision=service_dates.revision+1 RETURNING revision INTO version;
 result:=jsonb_build_object('revision',version);INSERT INTO private.service_date_actions VALUES(p_request,auth.uid(),payload,result);
 INSERT INTO private.business_audit(actor_id,action,reason,details) VALUES(auth.uid(),'vendor_service_date',p_reason,payload);
 RETURN result;
END $$;
CREATE FUNCTION public.admin_cash_authorise(p_vendor uuid,p_receiver uuid,p_action text,p_evidence text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() OR auth.uid()=p_receiver OR EXISTS(SELECT 1 FROM public.vendors WHERE id=p_vendor AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Independent active admin required';END IF;
 IF length(btrim(coalesce(p_evidence,'')))<15 OR p_action NOT IN('approve','revoke') THEN RAISE EXCEPTION 'Approval evidence required';END IF;
 INSERT INTO private.cash_authorisations(vendor_id,receiver_id,approved_by,action,evidence) VALUES(p_vendor,p_receiver,auth.uid(),p_action,p_evidence);
 INSERT INTO private.business_audit(actor_id,action,reason,details) VALUES(auth.uid(),'cash_authorisation',p_evidence,jsonb_build_object('vendor',p_vendor,'receiver',p_receiver,'decision',p_action));
END $$;
CREATE FUNCTION public.admin_revoke_eft_profile(p_profile uuid,p_evidence text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() THEN RAISE EXCEPTION 'Active admin required';END IF;
 IF length(btrim(coalesce(p_evidence,'')))<15 THEN RAISE EXCEPTION 'Independent evidence required';END IF;
 INSERT INTO private.profile_revocations VALUES(p_profile,auth.uid(),p_evidence,clock_timestamp()) ON CONFLICT DO NOTHING;
 INSERT INTO private.business_audit(actor_id,action,reason,details) VALUES(auth.uid(),'eft_profile_revoked',p_evidence,jsonb_build_object('profile',p_profile));
END $$;
CREATE FUNCTION public.create_assisted_order(p_vendor uuid,p_customer jsonb,p_items jsonb,p_window uuid,p_destination uuid,p_policy_revision bigint,p_window_revision bigint,p_method text,p_request uuid,p_confirmed_total numeric,p_channel text,p_notes text,p_request_evidence text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; source text; receipt jsonb:=p_customer->'cashReceipt';
BEGIN
 IF NOT private.can_assist(p_vendor) THEN RAISE EXCEPTION 'Assigned vendor or active admin required';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.assisted_controls WHERE singleton AND assisted_until>clock_timestamp() FOR SHARE) THEN RAISE EXCEPTION 'Assisted orders locked';END IF;
 IF p_method IS NULL OR p_method NOT IN('manual_eft','cash') OR p_channel IS NULL OR p_channel NOT IN('in_person','phone','customer_request') OR length(btrim(coalesce(p_request_evidence,''))) NOT BETWEEN 15 AND 1000 OR length(coalesce(p_notes,''))>1000 THEN RAISE EXCEPTION 'Confirmed request evidence, channel and method required';END IF;
 IF nullif(p_customer->>'email','') IS NOT NULL AND (p_customer->>'email')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Valid optional email required';END IF;
 IF p_method='cash' THEN
  IF NOT private.cash_receiver(p_vendor,auth.uid()) OR NOT coalesce((receipt->>'personallyReceived')::boolean,false) OR (receipt->>'amount')::numeric IS DISTINCT FROM p_confirmed_total OR nullif(btrim(receipt->>'identifier'),'') IS NULL OR length(btrim(coalesce(receipt->>'evidence','')))<15 THEN RAISE EXCEPTION 'Full personally received cash and receipt evidence required before order creation';END IF;
 END IF;
 source:=CASE WHEN private.is_admin() THEN 'admin_assisted' ELSE 'vendor_assisted' END;
 INSERT INTO private.assisted_context VALUES(txid_current(),auth.uid(),p_vendor,jsonb_build_object('source',source,'channel',p_channel,'notes',p_notes,'email',p_customer->>'email','requestEvidence',p_request_evidence,'confirmedTotal',p_confirmed_total,'cashReceipt',receipt));
 r:=public.create_collection_order(NULL,p_customer->>'name',p_customer->>'phone',p_items,p_method,p_request,p_window,p_destination,p_policy_revision,p_window_revision);
 IF p_confirmed_total IS DISTINCT FROM (r->>'total')::numeric THEN RAISE EXCEPTION 'Price changed; confirm server total with customer';END IF;
 IF p_method='cash' THEN
  PERFORM public.record_cash_event((r->>'id')::uuid,p_request,'receipt',(receipt->>'amount')::numeric,receipt->>'identifier',receipt->>'evidence',true);
  IF NOT EXISTS(SELECT 1 FROM private.manual_order_payments WHERE order_id=(r->>'id')::uuid AND state='paid') THEN RAISE EXCEPTION 'Prepaid cash order could not be verified atomically';END IF;
  SELECT public.order_to_json(o)||jsonb_build_object('payment_token',r->>'payment_token','collection',r->'collection') INTO r FROM public.orders o WHERE o.id=(r->>'id')::uuid;
 END IF;
 UPDATE public.orders SET order_source=source WHERE id=(r->>'id')::uuid AND order_source=source;
 DELETE FROM private.assisted_context WHERE transaction_id=txid_current();
 RETURN r;
END $$;
-- Set source BEFORE insertion; private metadata is never added to the customer DTO.
CREATE FUNCTION private.assisted_source_stamp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN NEW.order_source:=coalesce(private.assisted_metadata()->>'source','customer_web');RETURN NEW;END $$;
CREATE TRIGGER assisted_source_stamp BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.assisted_source_stamp();
CREATE FUNCTION public.record_eft_receipt(p_order uuid,p_amount numeric,p_reference text,p_evidence text,p_independently_verified boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result text;v uuid;previous private.eft_verifications%rowtype;payload jsonb:=jsonb_build_array(p_order,p_amount,p_evidence); BEGIN
 SELECT vendor_id INTO STRICT v FROM private.manual_order_payments WHERE order_id=p_order AND method='manual_eft';
 IF NOT private.manual_operator(v) OR NOT coalesce(p_independently_verified,false) OR length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 15 AND 1000 THEN RAISE EXCEPTION 'Authorised independent bank verification and evidence required';END IF;
 IF length(btrim(coalesce(p_reference,''))) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Bank reference required';END IF;
 PERFORM 1 FROM public.orders WHERE id=p_order FOR UPDATE;
 PERFORM pg_advisory_xact_lock(hashtextextended(v::text||p_reference,0));
 SELECT * INTO previous FROM private.eft_verifications WHERE vendor_id=v AND reference=p_reference;
 IF FOUND THEN IF previous.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'EFT receipt replay changed';END IF;RETURN previous.result;END IF;
 INSERT INTO private.receipt_context VALUES(txid_current(),p_order,auth.uid(),p_evidence);
 result:=public.verify_manual_payment(p_order,p_amount,p_reference,false);
 INSERT INTO private.eft_verifications VALUES(v,p_reference,p_order,payload,result);
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) SELECT p_order,auth.uid(),'eft_verification_evidence',p_evidence WHERE NOT EXISTS(SELECT 1 FROM private.manual_payment_events WHERE order_id=p_order AND action='eft_verification_evidence' AND note=p_evidence);
 DELETE FROM private.receipt_context WHERE transaction_id=txid_current();RETURN result;
END $$;
CREATE FUNCTION public.record_cash_event(p_order uuid,p_request uuid,p_kind text,p_amount numeric,p_receipt text,p_evidence text,p_personally_received boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m private.manual_order_payments%rowtype; previous private.cash_events%rowtype; payload jsonb; net numeric; result text:='unpaid'; status text;
BEGIN
 PERFORM 1 FROM public.orders WHERE id=p_order FOR UPDATE;
 SELECT * INTO STRICT m FROM private.manual_order_payments WHERE order_id=p_order AND method='cash' FOR UPDATE;
 IF NOT private.active_account() OR (p_kind='report' AND NOT private.can_assist(m.vendor_id)) OR (p_kind<>'report' AND (NOT private.cash_receiver(m.vendor_id,auth.uid()) OR NOT coalesce(p_personally_received,false))) THEN RAISE EXCEPTION 'Authorised actual cash recipient required';END IF;
 IF p_request IS NULL OR p_kind IS NULL OR p_kind NOT IN('report','receipt','refund') OR p_amount IS NULL OR p_amount::text IN('NaN','Infinity','-Infinity') OR p_amount<=0 OR p_amount<>round(p_amount,2) OR length(btrim(coalesce(p_receipt,''))) NOT BETWEEN 3 AND 100 OR length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 15 AND 1000 THEN RAISE EXCEPTION 'Receipt ID, whole-cent amount and evidence required';END IF;
 payload:=jsonb_build_array(p_order,p_kind,p_amount,p_receipt,p_evidence,auth.uid(),p_personally_received);
 SELECT * INTO previous FROM private.cash_events WHERE request_id=p_request OR (vendor_id=m.vendor_id AND kind=p_kind AND receipt_identifier=p_receipt);
 IF FOUND THEN IF previous.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Cash receipt replay changed';END IF;ELSE
  IF p_kind='refund' AND p_amount>private.cash_net(p_order) THEN RAISE EXCEPTION 'Refund exceeds recorded cash';END IF;
  INSERT INTO private.cash_events VALUES(p_request,p_order,m.vendor_id,p_kind,p_amount,p_receipt,auth.uid(),clock_timestamp(),payload);
  INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) VALUES(p_order,auth.uid(),'cash_'||p_kind,p_receipt||': '||p_evidence);
 END IF;
 net:=private.cash_net(p_order);
 SELECT o.status::text INTO status FROM public.orders o WHERE id=p_order;
 result:=m.state;
 IF p_kind='receipt' AND net=m.amount AND status='pending_payment' AND m.deadline>clock_timestamp() AND EXISTS(SELECT 1 FROM private.pilot_bookings WHERE order_id=p_order AND state='held' AND hold_until>clock_timestamp()) THEN
  result:=public.verify_manual_payment(p_order,m.amount,'cash:'||p_order::text,false);
 ELSIF (net>m.amount OR (net>0 AND (m.deadline<=clock_timestamp() OR status='cancelled'))) AND m.state<>'paid' THEN
  UPDATE private.manual_order_payments SET state='under_review',review_required=true WHERE order_id=p_order;result:='under_review';
 ELSIF m.state='paid' THEN result:='paid';END IF;
 RETURN jsonb_build_object('state',result,'received',net,'balance',CASE WHEN result='paid' THEN 0 ELSE greatest(m.amount-net,0) END,'refundDue',CASE WHEN status='cancelled' OR (m.deadline<=clock_timestamp() AND m.state<>'paid') THEN greatest(net,0) ELSE greatest(net-m.amount,0) END);
END $$;
CREATE FUNCTION public.cancel_refunded_cash_order(p_order uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE m private.manual_order_payments%rowtype;status text;BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() OR length(btrim(coalesce(p_reason,'')))<15 THEN RAISE EXCEPTION 'Independent admin refund evidence required';END IF;
 SELECT o.status::text INTO STRICT status FROM public.orders o WHERE id=p_order FOR UPDATE;
 SELECT * INTO STRICT m FROM private.manual_order_payments WHERE order_id=p_order AND method='cash' FOR UPDATE;
 IF status='cancelled' THEN RETURN;END IF;
 IF m.state='paid' OR status<>'pending_payment' OR private.cash_net(p_order)<>0 OR NOT EXISTS(SELECT 1 FROM private.cash_events WHERE order_id=p_order AND kind='refund') THEN RAISE EXCEPTION 'Unpaid order and fully returned actual cash required';END IF;
 UPDATE public.order_suborders SET status='cancelled' WHERE order_id=p_order;
 UPDATE public.orders SET status='cancelled' WHERE id=p_order;
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) VALUES(p_order,auth.uid(),'cash_unpaid_refund_cancelled',p_reason);
END $$;

CREATE FUNCTION public.review_cash_receipts(p_order uuid,p_evidence text,p_independently_verified boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result text;amount numeric;BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() OR NOT coalesce(p_independently_verified,false) OR length(btrim(coalesce(p_evidence,'')))<15 THEN RAISE EXCEPTION 'Independent admin verification evidence required';END IF;
 SELECT m.amount INTO STRICT amount FROM private.manual_order_payments m WHERE order_id=p_order AND method='cash';
 INSERT INTO private.receipt_context VALUES(txid_current(),p_order,auth.uid(),p_evidence);
 result:=public.verify_manual_payment(p_order,amount,'cash:'||p_order::text,false);
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) SELECT p_order,auth.uid(),'cash_independent_review',p_evidence WHERE NOT EXISTS(SELECT 1 FROM private.manual_payment_events WHERE order_id=p_order AND action='cash_independent_review' AND note=p_evidence);
 DELETE FROM private.receipt_context WHERE transaction_id=txid_current(); RETURN result;
END $$;
CREATE FUNCTION public.get_order_assistance_options(p_vendor uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('requestsEnabled',EXISTS(SELECT 1 FROM private.assisted_controls WHERE singleton AND requests_until>clock_timestamp()),'dates',(SELECT coalesce(jsonb_agg(service_date ORDER BY service_date),'[]') FROM private.service_dates WHERE vendor_id=p_vendor AND enabled AND service_date>current_date))
$$;
CREATE FUNCTION public.submit_order_request(p_vendor uuid,p_name text,p_phone text,p_items jsonb,p_date date,p_note text,p_request uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing private.customer_order_requests%rowtype;payload jsonb:=jsonb_build_array(auth.uid(),p_vendor,p_name,p_phone,p_items,p_date,p_note); result uuid;
BEGIN
 IF p_request IS NULL OR NOT EXISTS(SELECT 1 FROM private.assisted_controls WHERE singleton AND requests_until>clock_timestamp() FOR SHARE) THEN RAISE EXCEPTION 'Order requests locked';END IF;
 IF auth.uid() IS NOT NULL AND NOT private.active_account() THEN RAISE EXCEPTION 'Active account required';END IF;
 IF NOT coalesce(public.valid_sa_mobile(p_phone),false) OR length(btrim(coalesce(p_name,''))) NOT BETWEEN 1 AND 200 OR length(coalesce(p_note,''))>1000 THEN RAISE EXCEPTION 'Valid customer contact and note required';END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 20 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i WHERE coalesce(i->>'qty','')!~'^[1-9][0-9]?$|^100$') THEN RAISE EXCEPTION 'Valid requested items and quantities required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT * INTO existing FROM private.customer_order_requests WHERE id=p_request;
 IF FOUND THEN IF existing.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Request payload changed';END IF;RETURN jsonb_build_object('id',existing.id,'token',existing.token);END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('requests:'||p_vendor::text,0));
 IF (SELECT count(*) FROM private.customer_order_requests WHERE vendor_id=p_vendor AND created_at>clock_timestamp()-interval '30 minutes' AND (phone=p_phone OR (auth.uid() IS NOT NULL AND customer_id=auth.uid())))>=5 OR
 (SELECT count(*) FROM private.customer_order_requests WHERE vendor_id=p_vendor AND created_at>clock_timestamp()-interval '30 minutes')>=50 THEN RAISE EXCEPTION 'Request rate limit reached';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.service_dates sd JOIN public.vendors v ON v.id=sd.vendor_id WHERE sd.vendor_id=p_vendor AND sd.service_date=p_date AND sd.enabled AND p_date>current_date AND v.status='approved' AND v.archived_at IS NULL) THEN RAISE EXCEPTION 'Vendor service date unavailable';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) i LEFT JOIN public.meals m ON m.id=(i->>'mealId')::uuid WHERE m.id IS NULL OR m.vendor_id<>p_vendor OR NOT m.available OR (cardinality(m.available_days)>0 AND NOT extract(dow FROM p_date)::integer=ANY(m.available_days))) THEN RAISE EXCEPTION 'Requested menu unavailable';END IF;
 INSERT INTO private.customer_order_requests(id,vendor_id,customer_id,name,phone,items,service_date,note,payload) VALUES(p_request,p_vendor,auth.uid(),p_name,p_phone,p_items,p_date,coalesce(p_note,''),payload) RETURNING token INTO result;
 INSERT INTO private.order_request_events VALUES(p_request,'created',auth.uid(),clock_timestamp());
 RETURN jsonb_build_object('id',p_request,'token',result);
END $$;
CREATE FUNCTION public.get_order_request(p_request uuid,p_token uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE result jsonb;BEGIN
 SELECT jsonb_build_object('id',id,'serviceDate',service_date,'convertedOrderId',converted_order_id,'state',CASE WHEN converted_order_id IS NULL THEN 'requested' ELSE 'converted' END) INTO result
 FROM private.customer_order_requests WHERE id=p_request AND (token=p_token OR (auth.uid() IS NOT NULL AND private.active_account() AND customer_id=auth.uid()) OR private.can_assist(vendor_id));
 IF result IS NULL THEN RAISE EXCEPTION 'Request access required';END IF;RETURN result;
END $$;
CREATE FUNCTION public.convert_order_request(p_request uuid,p_window uuid,p_destination uuid,p_policy_revision bigint,p_window_revision bigint,p_method text,p_operation uuid,p_confirmed_total numeric,p_evidence text,p_cash_receipt jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE request private.customer_order_requests%rowtype; result jsonb; date date;
BEGIN
 SELECT * INTO STRICT request FROM private.customer_order_requests WHERE id=p_request FOR UPDATE;
 IF NOT private.can_assist(request.vendor_id) THEN RAISE EXCEPTION 'Assigned vendor or admin required';END IF;
 IF request.converted_order_id IS NOT NULL THEN
  SELECT public.order_to_json(o) INTO result FROM public.orders o WHERE id=request.converted_order_id;
  IF (result->>'total')::numeric IS DISTINCT FROM p_confirmed_total OR result->>'payment_method' IS DISTINCT FROM p_method THEN RAISE EXCEPTION 'Converted order differs from requested confirmation';END IF;RETURN result;
 END IF;
 SELECT (starts_at AT TIME ZONE 'Africa/Johannesburg')::date INTO date FROM private.pilot_windows WHERE id=p_window;
 IF date IS DISTINCT FROM request.service_date THEN RAISE EXCEPTION 'Requested service date and window differ';END IF;
 result:=public.create_assisted_order(request.vendor_id,jsonb_build_object('name',request.name,'phone',request.phone,'cashReceipt',p_cash_receipt),request.items,p_window,p_destination,p_policy_revision,p_window_revision,p_method,p_operation,p_confirmed_total,'customer_request',request.note,p_evidence);
 UPDATE private.customer_order_requests SET converted_order_id=(result->>'id')::uuid WHERE id=p_request;
 INSERT INTO private.order_request_events VALUES(p_request,'converted',auth.uid(),clock_timestamp());RETURN result;
END $$;
CREATE FUNCTION public.assisted_order_workspace(p_vendor uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v uuid:=p_vendor;BEGIN
 IF NOT private.active_account() OR (v IS NULL AND NOT private.is_admin()) OR (v IS NOT NULL AND NOT private.can_assist(v)) THEN RAISE EXCEPTION 'Assigned vendor or active admin required';END IF;
 RETURN jsonb_build_object('enabled',EXISTS(SELECT 1 FROM private.assisted_controls WHERE singleton AND assisted_until>clock_timestamp()),'cashEnabled',private.phase_unlocked('cash'),
 'vendors',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') FROM public.vendors x WHERE status='approved' AND archived_at IS NULL AND (v IS NULL OR x.id=v)),
 'meals',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'vendorId',vendor_id,'name',name,'price',price)),'[]') FROM public.meals WHERE available AND (v IS NULL OR vendor_id=v)),
 'dates',(SELECT coalesce(jsonb_agg(to_jsonb(sd)),'[]') FROM private.service_dates sd WHERE v IS NULL OR vendor_id=v),
 'requests',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'vendorId',vendor_id,'name',name,'phone',phone,'items',items,'serviceDate',service_date,'note',note,'convertedOrderId',converted_order_id) ORDER BY created_at DESC),'[]') FROM private.customer_order_requests WHERE v IS NULL OR vendor_id=v),
 'orders',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',o.id,'reference',o.ticket_number,'vendorId',m.vendor_id,'customer',coalesce(o.guest_name,'Account customer'),'serviceDate',o.delivery_date,'source',o.order_source,'method',m.method,'paymentState',m.state,'total',m.amount,'cashNet',private.cash_net(o.id),'cashRefunded',(SELECT coalesce(sum(amount),0) FROM private.cash_events WHERE order_id=o.id AND kind='refund'),'balance',CASE WHEN m.state='paid' THEN 0 ELSE greatest(m.amount-private.cash_net(o.id),0) END,'metadata',origin.metadata) ORDER BY o.created_at DESC),'[]') FROM public.orders o JOIN private.manual_order_payments m ON m.order_id=o.id JOIN private.order_origins origin ON origin.order_id=o.id WHERE v IS NULL OR m.vendor_id=v));
END $$;

-- Revoke even private SECURITY DEFINER helpers explicitly. Public API grants are
-- added below; untrusted clients cannot establish an assisted/receipt context.
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='private'::regnamespace AND proname IN('assisted_metadata','checkout_customer','can_assist','cash_receiver','cash_vendor','phase_unlocked','profile_revision_capture','cash_net','origin_capture','assisted_source_stamp') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.sig);END LOOP;
 FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('vendor_set_service_date','admin_cash_authorise','admin_revoke_eft_profile','create_assisted_order','record_eft_receipt','record_cash_event','review_cash_receipts','cancel_refunded_cash_order','get_order_assistance_options','submit_order_request','get_order_request','convert_order_request','assisted_order_workspace') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.sig);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.get_order_assistance_options(uuid),public.submit_order_request(uuid,text,text,jsonb,date,text,uuid),public.get_order_request(uuid,uuid) TO anon;

-- SOURCE checks/pilot/cash-custody-candidate.sql
-- LOCAL ONLY, after assisted-cash-candidate.sql. Not a hosted installer.

DO $$ BEGIN IF current_setting('officebites.verified_project_ref',true) IS DISTINCT FROM 'eyhmarmekioovcjibcbr' THEN RAISE EXCEPTION 'Verified staging target required';END IF;END $$;
CREATE TABLE private.cash_custody_policy(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),admin_cash_until timestamptz,approval_reference text,partial_handovers boolean NOT NULL DEFAULT false,bank_handovers boolean NOT NULL DEFAULT false);
INSERT INTO private.cash_custody_policy DEFAULT VALUES;
CREATE TABLE private.cash_receipt_snapshots(order_id uuid PRIMARY KEY REFERENCES public.orders,receipt_id uuid UNIQUE NOT NULL REFERENCES private.cash_events,beneficiary uuid NOT NULL REFERENCES public.vendors,custodian_id uuid NOT NULL REFERENCES public.profiles,custody text NOT NULL CHECK(custody IN('vendor','admin')),amount numeric(12,2) NOT NULL CHECK(amount>0),currency text NOT NULL CHECK(currency='ZAR'),received_at timestamptz NOT NULL,campaign text);
CREATE TABLE private.cash_handovers(id uuid PRIMARY KEY,order_id uuid NOT NULL REFERENCES private.cash_receipt_snapshots,sender_id uuid NOT NULL,recipient_id uuid NOT NULL,amount numeric(12,2) NOT NULL CHECK(amount>0),method text NOT NULL CHECK(method IN('physical_cash','approved_bank_transfer')),evidence text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),payload jsonb NOT NULL,CHECK(sender_id<>recipient_id));
CREATE TABLE private.cash_handover_events(request_id uuid PRIMARY KEY,handover_id uuid NOT NULL REFERENCES private.cash_handovers,action text NOT NULL CHECK(action IN('acknowledged','disputed','reversed')),actor_id uuid NOT NULL,evidence text NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),payload jsonb NOT NULL);
CREATE INDEX cash_handover_order ON private.cash_handovers(order_id);
CREATE INDEX cash_handover_history ON private.cash_handover_events(handover_id,created_at);
DO $$ DECLARE n text;BEGIN
 FOREACH n IN ARRAY ARRAY['cash_custody_policy','cash_receipt_snapshots','cash_handovers','cash_handover_events'] LOOP
  EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',n);
  EXECUTE format('REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated,service_role',n);
  IF n<>'cash_custody_policy' THEN EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON private.%I FOR EACH ROW EXECUTE FUNCTION private.manual_immutable()',n);END IF;
 END LOOP;
END $$;
CREATE FUNCTION private.admin_cash_unlocked() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.cash_custody_policy WHERE singleton AND admin_cash_until>clock_timestamp() AND length(btrim(approval_reference))>=15)
$$;
-- Admin custody has its own lock even when the general vendor cash gate is open.
DO $$ DECLARE d text;needle text;BEGIN
 SELECT pg_get_functiondef('public.create_assisted_order(uuid,jsonb,jsonb,uuid,uuid,bigint,bigint,text,uuid,numeric,text,text,text)'::regprocedure) INTO d;
 needle:='IF p_method=''cash'' THEN';
 IF position(needle IN d)=0 THEN RAISE EXCEPTION 'Cash creation definition drift';END IF;
 d:=replace(d,needle,needle||' IF private.is_admin() AND NOT private.admin_cash_unlocked() THEN RAISE EXCEPTION ''Admin cash custody locked pending separately approved settlement policy'';END IF;');
 d:=replace(d,'''cashReceipt'',receipt)', '''cashReceipt'',receipt,''campaign'',p_customer->>''campaign'')');
 EXECUTE d;
 SELECT pg_get_functiondef('private.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid)'::regprocedure) INTO d;
 needle:='''cashRecipient'',(SELECT name FROM public.vendors WHERE id=v)';
 IF position(needle IN d)=0 THEN RAISE EXCEPTION 'Cash destination definition drift';END IF;
 EXECUTE replace(d,needle,'''cashRecipient'',CASE WHEN private.is_admin() THEN ''Authorised OfficeBites representative'' ELSE (SELECT name FROM public.vendors WHERE id=v) END,''custody'',CASE WHEN private.is_admin() THEN ''admin'' ELSE ''vendor'' END');
END $$;
CREATE FUNCTION private.handover_state(h uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM private.cash_handover_events WHERE handover_id=h AND action='reversed') THEN 'reversed'
 WHEN EXISTS(SELECT 1 FROM private.cash_handover_events WHERE handover_id=h AND action='disputed') THEN 'disputed'
 WHEN EXISTS(SELECT 1 FROM private.cash_handover_events WHERE handover_id=h AND action='acknowledged') THEN 'reconciled' ELSE 'awaiting_vendor_confirmation' END
$$;
CREATE FUNCTION private.cash_settled(o uuid) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(sum(amount),0) FROM private.cash_handovers WHERE order_id=o AND private.handover_state(id)='reconciled'
$$;
CREATE FUNCTION private.cash_admin_refunds(o uuid) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(sum(e.amount),0) FROM private.cash_events e JOIN private.cash_receipt_snapshots s ON s.order_id=e.order_id WHERE e.order_id=o AND e.kind='refund' AND e.actor_id=s.custodian_id AND s.custody='admin'
$$;
CREATE FUNCTION private.cash_receipt_capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE custody text;meta jsonb:=private.assisted_metadata();BEGIN
 IF NEW.kind<>'receipt' THEN RETURN NEW;END IF;
 IF EXISTS(SELECT 1 FROM private.cash_receipt_snapshots WHERE order_id=NEW.order_id) THEN RAISE EXCEPTION 'Initial prepaid cash receipt already recorded';END IF;
 IF meta IS NULL OR NEW.amount<>(SELECT amount FROM private.manual_order_payments WHERE order_id=NEW.order_id) THEN RAISE EXCEPTION 'Atomic full prepaid receipt required';END IF;
 custody:=CASE WHEN private.is_admin() THEN 'admin' ELSE 'vendor' END;
 IF custody='admin' AND NOT private.admin_cash_unlocked() THEN RAISE EXCEPTION 'Admin cash custody locked';END IF;
 IF length(coalesce(meta->>'campaign',''))>100 THEN RAISE EXCEPTION 'Campaign identifier too long';END IF;
 INSERT INTO private.cash_receipt_snapshots VALUES(NEW.order_id,NEW.request_id,NEW.vendor_id,NEW.actor_id,custody,NEW.amount,'ZAR',NEW.received_at,meta->>'campaign');
 RETURN NEW;
END $$;
CREATE TRIGGER cash_receipt_capture AFTER INSERT ON private.cash_events FOR EACH ROW EXECUTE FUNCTION private.cash_receipt_capture();
-- Order-row lock serialises refund, initiation and recipient acknowledgement.
DO $$ DECLARE d text;needle text;BEGIN
 SELECT pg_get_functiondef('public.assisted_order_workspace(uuid)'::regprocedure) INTO d;
 needle:='''cashEnabled'',private.phase_unlocked(''cash'')';
 IF position(needle IN d)=0 THEN RAISE EXCEPTION 'Workspace definition drift';END IF;
 EXECUTE replace(d,needle,needle||' AND (NOT private.is_admin() OR private.admin_cash_unlocked())');
 SELECT pg_get_functiondef('public.get_manual_payment(uuid,uuid)'::regprocedure) INTO d;
 needle:='RETURN r||jsonb_build_object(';
 IF position(needle IN d)=0 THEN RAISE EXCEPTION 'Protected payment definition drift';END IF;
 EXECUTE replace(d,needle,'RETURN r||jsonb_build_object(''cashReceipt'',(SELECT jsonb_build_object(''amount'',s.amount,''currency'',s.currency,''receivedAt'',s.received_at,''receiptIdentifier'',e.receipt_identifier,''receivedBy'',CASE WHEN s.custody=''admin'' THEN ''Authorised OfficeBites representative'' ELSE ''Authorised vendor recipient'' END) FROM private.cash_receipt_snapshots s JOIN private.cash_events e ON e.request_id=s.receipt_id WHERE s.order_id=m.order_id))||jsonb_build_object(');
 SELECT pg_get_functiondef('public.get_order_request(uuid,uuid)'::regprocedure) INTO d;
 needle:='''convertedOrderId'',converted_order_id,';
 IF position(needle IN d)=0 THEN RAISE EXCEPTION 'Request definition drift';END IF;
 EXECUTE replace(d,needle,needle||'''orderTicket'',(SELECT ticket_number FROM public.orders WHERE id=converted_order_id),');
END $$;
CREATE FUNCTION private.cash_refund_custody_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.cash_receipt_snapshots%rowtype;available numeric;BEGIN
 IF NEW.kind<>'refund' THEN RETURN NEW;END IF;
 PERFORM 1 FROM public.orders WHERE id=NEW.order_id FOR UPDATE;
 SELECT * INTO STRICT s FROM private.cash_receipt_snapshots WHERE order_id=NEW.order_id;
 IF s.custody='vendor' THEN
  IF NEW.actor_id<>s.custodian_id THEN RAISE EXCEPTION 'Original cash custodian must record refund';END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM private.cash_handovers WHERE order_id=NEW.order_id AND private.handover_state(id) IN('awaiting_vendor_confirmation','disputed')) THEN RAISE EXCEPTION 'Resolve outstanding cash handover before refund';END IF;
  IF NEW.actor_id=s.custodian_id THEN available:=s.amount-private.cash_settled(NEW.order_id)-private.cash_admin_refunds(NEW.order_id);
  ELSIF EXISTS(SELECT 1 FROM public.vendors WHERE id=s.beneficiary AND owner_id=NEW.actor_id) THEN
   SELECT private.cash_settled(NEW.order_id)-coalesce(sum(amount),0) INTO available FROM private.cash_events WHERE order_id=NEW.order_id AND kind='refund' AND actor_id=NEW.actor_id;
  ELSE RAISE EXCEPTION 'Actual current cash custodian required';END IF;
  IF NEW.amount>available THEN RAISE EXCEPTION 'Refund exceeds cash held by this custodian';END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER cash_refund_custody_guard BEFORE INSERT ON private.cash_events FOR EACH ROW EXECUTE FUNCTION private.cash_refund_custody_guard();
CREATE FUNCTION public.initiate_cash_handover(p_order uuid,p_request uuid,p_recipient uuid,p_amount numeric,p_method text,p_evidence text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.cash_receipt_snapshots%rowtype;previous private.cash_handovers%rowtype;payload jsonb:=jsonb_build_array(p_order,p_recipient,p_amount,p_method,p_evidence,auth.uid());remaining numeric;policy private.cash_custody_policy%rowtype;BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() OR NOT private.admin_cash_unlocked() THEN RAISE EXCEPTION 'Authorised approved cash custody policy required';END IF;
 IF p_request IS NULL OR p_amount IS NULL OR p_amount::text IN('NaN','Infinity','-Infinity') OR p_amount<=0 OR round(p_amount,2)<>p_amount OR length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 15 AND 1000 OR p_method IS NULL OR p_method NOT IN('physical_cash','approved_bank_transfer') THEN RAISE EXCEPTION 'Valid handover amount, method, request and evidence required';END IF;
 PERFORM 1 FROM public.orders WHERE id=p_order FOR UPDATE;
 SELECT * INTO STRICT s FROM private.cash_receipt_snapshots WHERE order_id=p_order;
 IF s.custody<>'admin' OR s.custodian_id<>auth.uid() OR NOT EXISTS(SELECT 1 FROM public.vendors v JOIN public.profiles u ON u.id=v.owner_id WHERE v.id=s.beneficiary AND v.owner_id=p_recipient AND p_recipient<>auth.uid() AND v.archived_at IS NULL AND v.status='approved' AND NOT u.suspended AND u.deleted_at IS NULL) THEN RAISE EXCEPTION 'Actual admin custodian and independent vendor recipient required';END IF;
 SELECT * INTO previous FROM private.cash_handovers WHERE id=p_request;
 IF FOUND THEN IF previous.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Handover replay changed';END IF;RETURN jsonb_build_object('id',previous.id,'state',private.handover_state(previous.id));END IF;
 SELECT * INTO STRICT policy FROM private.cash_custody_policy WHERE singleton FOR SHARE;
 IF p_method='approved_bank_transfer' AND NOT policy.bank_handovers THEN RAISE EXCEPTION 'Bank handovers not approved';END IF;
 SELECT s.amount-private.cash_admin_refunds(p_order)-coalesce(sum(amount),0) INTO remaining FROM private.cash_handovers WHERE order_id=p_order AND private.handover_state(id)<>'reversed';
 IF p_amount>remaining OR (p_amount<>remaining AND NOT policy.partial_handovers) THEN RAISE EXCEPTION 'Handover exceeds outstanding amount or partial handover not approved';END IF;
 INSERT INTO private.cash_handovers(id,order_id,sender_id,recipient_id,amount,method,evidence,payload) VALUES(p_request,p_order,auth.uid(),p_recipient,p_amount,p_method,p_evidence,payload);
 RETURN jsonb_build_object('id',p_request,'state','awaiting_vendor_confirmation');
END $$;
CREATE FUNCTION public.respond_cash_handover(p_handover uuid,p_request uuid,p_action text,p_evidence text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE h private.cash_handovers%rowtype;previous private.cash_handover_events%rowtype;payload jsonb:=jsonb_build_array(p_handover,p_action,p_evidence,auth.uid());state text;BEGIN
 IF NOT private.active_account() OR p_request IS NULL OR length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 15 AND 1000 OR p_action IS NULL OR p_action NOT IN('acknowledged','disputed','reversed') THEN RAISE EXCEPTION 'Active recipient, request, action and evidence required';END IF;
 SELECT * INTO STRICT h FROM private.cash_handovers WHERE id=p_handover;
 PERFORM 1 FROM public.orders WHERE id=h.order_id FOR UPDATE;
 IF auth.uid()<>h.recipient_id OR auth.uid()=h.sender_id OR NOT EXISTS(SELECT 1 FROM private.cash_receipt_snapshots s JOIN public.vendors v ON v.id=s.beneficiary WHERE s.order_id=h.order_id AND v.owner_id=auth.uid() AND v.status='approved' AND v.archived_at IS NULL) THEN RAISE EXCEPTION 'Independent assigned vendor acknowledgement required';END IF;
 SELECT * INTO previous FROM private.cash_handover_events WHERE request_id=p_request;
 IF FOUND THEN IF previous.payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Acknowledgement replay changed';END IF;RETURN jsonb_build_object('state',private.handover_state(p_handover));END IF;
 state:=private.handover_state(p_handover);
 IF state='reversed' OR (p_action='acknowledged' AND state<>'awaiting_vendor_confirmation') OR (p_action='disputed' AND state<>'awaiting_vendor_confirmation') OR (p_action='reversed' AND state NOT IN('awaiting_vendor_confirmation','disputed')) THEN RAISE EXCEPTION 'Controlled reconciliation required for this transition';END IF;
 INSERT INTO private.cash_handover_events VALUES(p_request,p_handover,p_action,auth.uid(),p_evidence,clock_timestamp(),payload);
 RETURN jsonb_build_object('state',private.handover_state(p_handover));
END $$;
-- Restricted reporting only. Internal cash movements never create another sale,
-- payment receipt, commission entry or customer paid/unpaid transition.
CREATE FUNCTION public.cash_custody_workspace(p_vendor uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT private.active_account() OR (p_vendor IS NULL AND NOT private.is_admin()) OR (p_vendor IS NOT NULL AND NOT private.can_assist(p_vendor)) THEN RAISE EXCEPTION 'Assigned vendor or active admin required';END IF;
 RETURN jsonb_build_object('adminCashEnabled',private.admin_cash_unlocked(),'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('reference',o.ticket_number,'source',o.order_source,'paymentState',m.state,'fulfilmentState',o.status,'commissionLiability',r.commission,'commissionCollected',(SELECT coalesce(sum(CASE WHEN kind='collection' THEN amount WHEN kind='commission_return' THEN -amount ELSE 0 END),0) FROM private.manual_receivable_entries WHERE order_id=o.id),'transferredToVendor',private.cash_settled(o.id),'refunds',s.amount-private.cash_net(o.id),'outstandingToVendor',CASE WHEN s.custody='admin' THEN s.amount-private.cash_settled(o.id)-private.cash_admin_refunds(o.id) ELSE 0 END,'handoverStatus',CASE WHEN s.custody='vendor' THEN 'not_applicable' WHEN EXISTS(SELECT 1 FROM private.cash_handovers WHERE order_id=o.id AND private.handover_state(id)='disputed') THEN 'disputed' WHEN s.amount-private.cash_settled(o.id)-private.cash_admin_refunds(o.id)=0 THEN 'reconciled' ELSE 'pending_handover' END)),'[]') FROM private.cash_receipt_snapshots s JOIN public.orders o ON o.id=s.order_id JOIN private.manual_order_payments m ON m.order_id=o.id LEFT JOIN private.manual_receivables r ON r.order_id=o.id WHERE p_vendor IS NULL OR s.beneficiary=p_vendor),
 'handovers',(SELECT coalesce(jsonb_agg(to_jsonb(h)||jsonb_build_object('state',private.handover_state(h.id))),'[]') FROM private.cash_handovers h JOIN private.cash_receipt_snapshots s ON s.order_id=h.order_id WHERE p_vendor IS NULL OR s.beneficiary=p_vendor));
END $$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='private'::regnamespace AND proname IN('admin_cash_unlocked','handover_state','cash_settled','cash_admin_refunds','cash_receipt_capture','cash_refund_custody_guard') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.sig);END LOOP;
 FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('initiate_cash_handover','respond_cash_handover','cash_custody_workspace') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.sig);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END LOOP;
END $$;
$release_sql$;
 SELECT md5(jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(o)-'order_source' ORDER BY id) FROM public.orders o),
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
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.acquisition_ledger o)
 )::text) INTO restored;
 IF original IS DISTINCT FROM restored THEN RAISE EXCEPTION 'Historical financial/order data changed';END IF;
 CREATE TABLE private.officebites_release_installations(name text PRIMARY KEY,payload_sha256 text NOT NULL,functions jsonb NOT NULL,historical_fingerprint text NOT NULL,installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
 ALTER TABLE private.officebites_release_installations ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON private.officebites_release_installations FROM PUBLIC,anon,authenticated,service_role;
 SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),md5(pg_get_functiondef(p.oid)),p.proowner,p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private') AND p.prokind='f' INTO functions;
 INSERT INTO private.officebites_release_installations(name,payload_sha256,functions,historical_fingerprint) VALUES('officebites_20261023','bfece8414f6578896aff42fc96ee01e3a3847e8a46bb3d284fc896dd89eb525d',functions,original);
END $package$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled) THEN RAISE EXCEPTION 'Payment method enabled';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.manual_payment_settings WHERE singleton AND deadline_minutes=15 AND review_threshold=500) THEN RAISE EXCEPTION 'Settings baseline differs';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.delivery_settings WHERE NOT enabled AND paid_fee=15) THEN RAISE EXCEPTION 'Delivery baseline differs';END IF;
END $$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.uat_security WHERE expires_at IS NOT NULL OR capability_hash IS NOT NULL) THEN RAISE EXCEPTION 'UAT access window not closed';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.pilot_policy WHERE singleton AND NOT enabled AND collection_fee=0) THEN RAISE EXCEPTION 'Collection unlocked or price differs';END IF;
 IF EXISTS(SELECT 1 FROM private.collection_activation WHERE eft_until IS NOT NULL) OR EXISTS(SELECT 1 FROM private.assisted_controls WHERE assisted_until IS NOT NULL OR cash_until IS NOT NULL OR requests_until IS NOT NULL) OR EXISTS(SELECT 1 FROM private.cash_custody_policy WHERE admin_cash_until IS NOT NULL OR partial_handovers OR bank_handovers) THEN RAISE EXCEPTION 'Entry lock not closed';END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN('private.cash_events'::regclass,'private.cash_handovers'::regclass,'private.manual_order_payments'::regclass,'private.uat_security'::regclass) AND (NOT relrowsecurity OR has_table_privilege('anon',oid,'SELECT') OR has_table_privilege('authenticated',oid,'UPDATE'))) THEN RAISE EXCEPTION 'Direct financial/security privilege violation';END IF;
 IF has_function_privilege('anon','public.create_assisted_order(uuid,jsonb,jsonb,uuid,uuid,bigint,bigint,text,uuid,numeric,text,text,text)','EXECUTE') OR has_function_privilege('authenticated','private.uat_send_email(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'RPC privilege violation';END IF;
END $$;
