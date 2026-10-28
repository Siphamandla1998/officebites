-- Local candidate. Promote through the documented staging procedure only.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='90s';
SELECT pg_advisory_xact_lock(hashtextextended('officebites-production-manual-payments-20261028',0));
DO $preflight$
BEGIN
 IF to_regprocedure('private.active_account()') IS NULL
 OR to_regprocedure('private.is_admin()') IS NULL
 OR to_regprocedure('private.create_order_core(uuid,text,text,text,date,text,jsonb)') IS NULL
 OR to_regprocedure('public.order_to_json(public.orders)') IS NULL
 OR to_regprocedure('public.create_order_with_delivery(uuid,text,text,text,date,text,jsonb,uuid)') IS NULL
 OR to_regprocedure('public.cancel_unpaid_order(uuid,text,text)') IS NULL
 OR to_regprocedure('public.submit_payment_proof(uuid,text)') IS NULL
 OR to_regclass('private.gateway_settings') IS NULL
 OR to_regclass('private.payment_attempts') IS NULL
 OR to_regclass('private.delivery_settings') IS NULL
 THEN RAISE EXCEPTION 'Reviewed checkout prerequisites missing; no manual-payment changes applied'; END IF;
 IF to_regclass('private.manual_payment_settings') IS NOT NULL
 OR to_regclass('private.vendor_payment_profiles') IS NOT NULL
 OR to_regclass('private.manual_order_payments') IS NOT NULL
 OR to_regclass('private.manual_payment_events') IS NOT NULL
 OR to_regclass('private.manual_receivables') IS NOT NULL
 OR to_regclass('private.manual_receivable_entries') IS NOT NULL
 OR to_regclass('private.manual_refund_events') IS NOT NULL
 OR to_regprocedure('public.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid)') IS NOT NULL
 OR to_regprocedure('public.submit_vendor_payment_profile(uuid,jsonb,boolean,boolean)') IS NOT NULL
 THEN RAISE EXCEPTION 'Manual-payment foundation or partial installation already exists; reconcile first'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.orders'::regclass AND conname='orders_payment_method_check')
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='private.gateway_settings'::regclass AND conname='gateway_settings_provider_check')
 THEN RAISE EXCEPTION 'Expected payment constraints missing; no changes applied'; END IF;
 IF (SELECT count(*) FROM private.gateway_settings)<>2
 OR EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled)
 OR EXISTS(SELECT 1 FROM public.orders WHERE payment_method IS NOT NULL AND payment_method NOT IN('payfast','ozow','manual_eft','manual_payshap'))
 THEN RAISE EXCEPTION 'Gateway baseline or historical payment method values differ; review before applying'; END IF;
 IF (SELECT count(*) FROM public.orders)<>32
 OR (SELECT count(*) FROM public.order_suborders)<>33
 OR (SELECT count(*) FROM private.vendor_legal_acceptances)<>0
 THEN RAISE EXCEPTION 'Production data baseline changed; refresh preflight before applying'; END IF;
END
$preflight$;
CREATE TEMP TABLE officebites_manual_payment_baseline ON COMMIT DROP AS
SELECT (SELECT count(*) FROM public.orders) orders,
       (SELECT count(*) FROM public.order_suborders) suborders,
       (SELECT count(*) FROM public.vendors) vendors,
       (SELECT count(*) FROM private.gateway_settings) old_gateway_rows,
       (SELECT count(*) FROM private.vendor_legal_acceptances) acceptances;

ALTER TABLE public.orders DROP CONSTRAINT orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK(payment_method IN('payfast','ozow','manual_eft','manual_payshap'));

CREATE TABLE private.manual_payment_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 deadline_minutes integer NOT NULL DEFAULT 15 CHECK(deadline_minutes BETWEEN 5 AND 60),
 review_threshold numeric(12,2) NOT NULL DEFAULT 500 CHECK(review_threshold>0)
);
INSERT INTO private.manual_payment_settings DEFAULT VALUES;
CREATE TABLE private.vendor_payment_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 destination jsonb NOT NULL,eft boolean NOT NULL,payshap boolean NOT NULL,
 submitted_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),modified_at timestamptz NOT NULL DEFAULT now(),
 approved_by uuid,approved_at timestamptz,verification_evidence text,
 UNIQUE(id,vendor_id),CHECK((approved_by IS NULL)=(approved_at IS NULL))
);
CREATE INDEX vendor_payment_profile_versions ON private.vendor_payment_profiles(vendor_id,created_at DESC);
CREATE TABLE private.manual_order_payments (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id),vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 profile_id uuid NOT NULL, destination jsonb NOT NULL,method text NOT NULL CHECK(method IN('manual_eft','manual_payshap')),
 token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),request_id uuid NOT NULL UNIQUE,request_hash text NOT NULL,
 amount numeric(12,2) NOT NULL CHECK(amount>0),deadline timestamptz NOT NULL,
 reported_at timestamptz,review_required boolean NOT NULL DEFAULT false,
 disputed_at timestamptz,
 state text NOT NULL DEFAULT 'awaiting_payment' CHECK(state IN('awaiting_payment','payment_reported','under_review','paid','expired','disputed')),
 verified_by uuid,verified_at timestamptz,verified_amount numeric(12,2),bank_reference text,
 confirmation_source text CHECK(confirmation_source IN('vendor_bank_receipt','admin_bank_receipt')),
 FOREIGN KEY(profile_id,vendor_id) REFERENCES private.vendor_payment_profiles(id,vendor_id)
);
CREATE INDEX manual_payment_vendor ON private.manual_order_payments(vendor_id,deadline);
CREATE UNIQUE INDEX manual_verified_bank_reference ON private.manual_order_payments(vendor_id,upper(bank_reference)) WHERE verified_at IS NOT NULL;
CREATE TABLE private.manual_payment_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid REFERENCES public.orders(id),profile_id uuid REFERENCES private.vendor_payment_profiles(id),
 actor_id uuid,action text NOT NULL,note text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX manual_event_order ON private.manual_payment_events(order_id,created_at);
CREATE TABLE private.manual_receivables (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id),vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 gross numeric(12,2) NOT NULL,product_subtotal numeric(12,2) NOT NULL,commission numeric(12,2) NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.manual_receivable_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES private.manual_receivables(order_id),
 kind text NOT NULL CHECK(kind IN('collection','refund','commission_return')),amount numeric(12,2) NOT NULL CHECK(amount>0),
 commission_credit numeric(12,2) NOT NULL DEFAULT 0 CHECK(commission_credit>=0),
 product_refund numeric(12,2) NOT NULL DEFAULT 0 CHECK(product_refund>=0),
 evidence text NOT NULL,actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX manual_receivable_entry_order ON private.manual_receivable_entries(order_id);
CREATE TABLE private.manual_refund_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES private.manual_order_payments(order_id),
 status text NOT NULL CHECK(status IN('requested','vendor_processing','completed','declined')),
 amount numeric(12,2),evidence text NOT NULL,actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX manual_refund_order ON private.manual_refund_events(order_id,created_at DESC);
CREATE FUNCTION private.manual_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Retain immutable payment history; create a new reviewed version or adjustment';END $$;
CREATE TRIGGER manual_events_immutable BEFORE UPDATE OR DELETE ON private.manual_payment_events FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();
CREATE TRIGGER manual_receivable_immutable BEFORE UPDATE OR DELETE ON private.manual_receivables FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();
CREATE TRIGGER manual_entries_immutable BEFORE UPDATE OR DELETE ON private.manual_receivable_entries FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();
CREATE TRIGGER manual_refunds_immutable BEFORE UPDATE OR DELETE ON private.manual_refund_events FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();
CREATE FUNCTION private.manual_profile_lock() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain payment profile history';END IF;
 IF OLD.approved_at IS NOT NULL OR NEW.id IS DISTINCT FROM OLD.id OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id OR NEW.destination IS DISTINCT FROM OLD.destination OR NEW.eft IS DISTINCT FROM OLD.eft OR NEW.payshap IS DISTINCT FROM OLD.payshap OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Immutable payment profile; submit a new version';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER manual_profile_immutable BEFORE UPDATE OR DELETE ON private.vendor_payment_profiles FOR EACH ROW EXECUTE FUNCTION private.manual_profile_lock();
CREATE TRIGGER manual_destination_immutable BEFORE UPDATE OF order_id,vendor_id,profile_id,destination,method,token,request_id,request_hash,amount,deadline OR DELETE ON private.manual_order_payments FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();
DO $$ DECLARE n text;BEGIN
 FOREACH n IN ARRAY ARRAY['manual_payment_settings','vendor_payment_profiles','manual_order_payments','manual_payment_events','manual_receivables','manual_receivable_entries','manual_refund_events'] LOOP
 EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',n);
 EXECUTE format('REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated',n);
 END LOOP;
END $$;

-- Settings cannot reactivate a rejected/unapproved provider. Callbacks remain intact.
UPDATE private.gateway_settings SET enabled=false,maintenance=true,notice='Unavailable for vendor marketplace checkout';
ALTER TABLE private.gateway_settings DROP CONSTRAINT gateway_settings_provider_check;
ALTER TABLE private.gateway_settings ADD CONSTRAINT gateway_settings_provider_check CHECK(provider IN('payfast','ozow','manual_eft','manual_payshap'));
-- Installation is fail-closed. A separate reviewed, synthetic-only staging test
-- operation may enable these; approving a profile alone cannot activate checkout.
INSERT INTO private.gateway_settings(provider,enabled,ready) VALUES('manual_eft',false,true),('manual_payshap',false,true);
CREATE FUNCTION private.block_marketplace_provider() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN IF NEW.provider IN('payfast','ozow') AND NEW.enabled THEN RAISE EXCEPTION 'Provider authorisation required: marketplace gateways are blocked. Reviewed provider approval and a new migration are required.'; END IF; RETURN NEW; END $$;
CREATE TRIGGER marketplace_provider_block BEFORE INSERT OR UPDATE ON private.gateway_settings FOR EACH ROW EXECUTE FUNCTION private.block_marketplace_provider();
CREATE OR REPLACE FUNCTION public.admin_update_payment_gateway(p_provider text,p_enabled boolean,p_maintenance boolean,p_notice text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501';END IF;
 IF length(coalesce(p_notice,''))>500 THEN RAISE EXCEPTION 'Notice must be at most 500 characters';END IF;
 UPDATE private.gateway_settings SET enabled=p_enabled,maintenance=p_maintenance,notice=coalesce(p_notice,''),updated_at=clock_timestamp(),updated_by=auth.uid() WHERE provider=p_provider AND (NOT p_enabled OR ready);
 IF NOT FOUND THEN RAISE EXCEPTION 'Provider unavailable or not verified ready';END IF;
 INSERT INTO private.business_audit(actor_id,action,reason,details) VALUES(auth.uid(),'gateway_settings','Administrator configuration',jsonb_build_object('provider',p_provider,'enabled',p_enabled,'maintenance',p_maintenance));
END $$;
CREATE OR REPLACE FUNCTION public.prepare_payfast_order(p_order_id uuid,p_caller_id uuid,p_guest_contact text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'PayFast is unavailable for new marketplace payments'; END $$;
-- Block provider attempt creation even if stale Edge versions call an older path.
CREATE FUNCTION private.block_provider_attempt() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Marketplace gateway initiation is unavailable'; END $$;
CREATE TRIGGER marketplace_attempt_block BEFORE INSERT ON private.payment_attempts FOR EACH ROW EXECUTE FUNCTION private.block_provider_attempt();
REVOKE ALL ON FUNCTION public.submit_payment_proof(uuid,text) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE d text;needle text:='IF o.status=''cancelled'' THEN RETURN public.order_to_json(o); END IF;';BEGIN
 SELECT pg_get_functiondef('public.cancel_unpaid_order(uuid,text,text)'::regprocedure) INTO d;
 IF strpos(d,needle)=0 THEN RAISE EXCEPTION 'Cancellation prerequisite changed; inspect before applying';END IF;
 d:=replace(d,needle,'PERFORM 1 FROM private.manual_order_payments WHERE order_id=o.id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM private.manual_order_payments WHERE order_id=o.id AND (reported_at IS NOT NULL OR state<>''awaiting_payment'')) THEN RAISE EXCEPTION ''Payment was reported or requires review. Contact support to cancel and reconcile any vendor refund.'';END IF;
 '||needle);
 EXECUTE d;
END $$;

CREATE FUNCTION private.manual_operator(p_vendor uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND private.active_account() AND (private.is_admin() OR EXISTS(SELECT 1 FROM public.vendors WHERE id=p_vendor AND owner_id=auth.uid() AND status='approved' AND archived_at IS NULL))
$$;
CREATE FUNCTION public.submit_vendor_payment_profile(p_vendor_id uuid,p_destination jsonb,p_eft boolean,p_payshap boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;d jsonb;
BEGIN
 IF NOT private.manual_operator(p_vendor_id) THEN RAISE EXCEPTION 'Vendor ownership required' USING ERRCODE='42501';END IF;
 d:=jsonb_build_object('accountHolder',btrim(p_destination->>'accountHolder'),'bank',btrim(p_destination->>'bank'),'accountNumber',btrim(p_destination->>'accountNumber'),'accountType',btrim(p_destination->>'accountType'),'branchCode',btrim(p_destination->>'branchCode'),'shapId',btrim(p_destination->>'shapId'));
 IF length(coalesce(d->>'accountHolder','')) NOT BETWEEN 2 AND 150 OR length(coalesce(d->>'bank','')) NOT BETWEEN 2 AND 100 OR NOT (p_eft OR p_payshap) OR p_eft IS NULL OR p_payshap IS NULL THEN RAISE EXCEPTION 'Recipient, bank and supported payment method required';END IF;
 IF p_eft AND (coalesce(d->>'accountNumber','') !~ '^[0-9]{6,20}$' OR coalesce(d->>'branchCode','') !~ '^[0-9]{6}$' OR length(coalesce(d->>'accountType','')) NOT BETWEEN 2 AND 50) THEN RAISE EXCEPTION 'Valid EFT account, branch code and account type required';END IF;
 IF p_payshap AND length(coalesce(d->>'shapId','')) NOT BETWEEN 3 AND 150 THEN RAISE EXCEPTION 'Registered ShapID required; account numbers are not inferred as ShapIDs';END IF;
 INSERT INTO private.vendor_payment_profiles(vendor_id,destination,eft,payshap,submitted_by) VALUES(p_vendor_id,d,p_eft,p_payshap,auth.uid()) RETURNING id INTO result;
 INSERT INTO private.manual_payment_events(profile_id,actor_id,action,note) VALUES(result,auth.uid(),'profile_submitted','New version pending independent recipient and bank capability verification');
 RETURN result;
END $$;
CREATE FUNCTION public.approve_vendor_payment_profile(p_profile_id uuid,p_evidence text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p private.vendor_payment_profiles%rowtype;
BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501';END IF;
 IF length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 15 AND 1000 THEN RAISE EXCEPTION 'Independent bank ownership, recipient and PayShap capability verification evidence required';END IF;
 SELECT * INTO STRICT p FROM private.vendor_payment_profiles WHERE id=p_profile_id FOR UPDATE;
 IF p.submitted_by=auth.uid() OR EXISTS(SELECT 1 FROM public.vendors WHERE id=p.vendor_id AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Independent approver required';END IF;
 IF p.approved_at IS NOT NULL THEN RETURN;END IF;
 UPDATE private.vendor_payment_profiles SET approved_by=auth.uid(),approved_at=clock_timestamp(),modified_at=clock_timestamp(),verification_evidence=btrim(p_evidence) WHERE id=p.id;
 INSERT INTO private.manual_payment_events(profile_id,actor_id,action,note) VALUES(p.id,auth.uid(),'profile_approved',btrim(p_evidence));
END $$;
CREATE FUNCTION public.get_vendor_manual_methods(p_vendor_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT jsonb_build_object('manual_eft',p.eft AND EXISTS(SELECT 1 FROM private.gateway_settings WHERE provider='manual_eft' AND enabled AND ready AND NOT maintenance),'manual_payshap',p.payshap AND EXISTS(SELECT 1 FROM private.gateway_settings WHERE provider='manual_payshap' AND enabled AND ready AND NOT maintenance))
 FROM private.vendor_payment_profiles p JOIN public.vendors v ON v.id=p.vendor_id
 JOIN public.profiles u ON u.id=v.owner_id
 WHERE p.vendor_id=p_vendor_id AND p.approved_at IS NOT NULL AND v.status='approved' AND v.archived_at IS NULL AND NOT u.suspended AND u.deleted_at IS NULL
 ORDER BY p.approved_at DESC,p.id DESC LIMIT 1),'{}'::jsonb)
$$;

-- Retain the audited quote/pricing core privately; old clients must refresh.
ALTER FUNCTION public.create_order_with_delivery(uuid,text,text,text,date,text,jsonb,uuid) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.create_order_with_delivery(uuid,text,text,text,date,text,jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.create_order_from_cart(p_customer_id uuid,p_guest_name text,p_guest_contact text,p_guest_email text,p_delivery_date date,p_delivery_location text,p_items jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Refresh checkout to select an approved vendor-direct payment method'; END $$;
CREATE FUNCTION public.create_manual_order(p_customer_id uuid,p_guest_name text,p_guest_contact text,p_guest_email text,p_delivery_date date,p_delivery_location text,p_items jsonb,p_quote_id uuid,p_method text,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v uuid;p private.vendor_payment_profiles%rowtype;s private.manual_payment_settings%rowtype;r jsonb;m private.manual_order_payments%rowtype;h text;
BEGIN
 IF p_request_id IS NULL OR p_customer_id IS DISTINCT FROM auth.uid() OR (auth.uid() IS NOT NULL AND NOT private.active_account()) THEN RAISE EXCEPTION 'Checkout identity and request key required';END IF;
 IF p_method IS NULL OR p_method NOT IN('manual_eft','manual_payshap') THEN RAISE EXCEPTION 'Approved vendor-direct method required';END IF;
 h:=md5(jsonb_build_array(p_customer_id,p_guest_name,p_guest_contact,p_guest_email,p_delivery_date,p_delivery_location,p_items,p_quote_id,p_method)::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 SELECT * INTO m FROM private.manual_order_payments WHERE request_id=p_request_id;
 IF FOUND THEN
 IF m.request_hash IS DISTINCT FROM h THEN RAISE EXCEPTION 'Checkout request changed; review before creating a new order';END IF;
 SELECT public.order_to_json(o) INTO r FROM public.orders o WHERE o.id=m.order_id;
 RETURN r||jsonb_build_object('payment_token',m.token);
 END IF;
 IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Cart required';END IF;
 IF (SELECT count(DISTINCT meals.vendor_id) FROM jsonb_array_elements(p_items) x JOIN public.meals ON meals.id=(x->>'mealId')::uuid)<>1 THEN RAISE EXCEPTION 'One vendor per checkout required';END IF;
 SELECT meals.vendor_id INTO v FROM jsonb_array_elements(p_items) x JOIN public.meals ON meals.id=(x->>'mealId')::uuid LIMIT 1;
 SELECT * INTO STRICT s FROM private.manual_payment_settings FOR SHARE;
 PERFORM 1 FROM private.gateway_settings WHERE provider=p_method AND enabled AND ready AND NOT maintenance FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vendor-direct payment method is unavailable';END IF;
 SELECT * INTO p FROM private.vendor_payment_profiles WHERE vendor_id=v AND approved_at IS NOT NULL ORDER BY approved_at DESC,id DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND OR (p_method='manual_eft' AND NOT p.eft) OR (p_method='manual_payshap' AND NOT p.payshap) OR NOT coalesce((public.get_vendor_manual_methods(v)->>p_method)::boolean,false) THEN RAISE EXCEPTION 'This vendor has no approved payment details for that method. Your cart is saved; please try later.';END IF;
 r:=private.create_order_with_delivery(p_customer_id,p_guest_name,p_guest_contact,p_guest_email,p_delivery_date,p_delivery_location,p_items,p_quote_id);
 UPDATE public.orders SET payment_method=p_method WHERE id=(r->>'id')::uuid;
 INSERT INTO private.manual_order_payments(order_id,vendor_id,profile_id,destination,method,request_id,request_hash,amount,deadline,review_required)
 VALUES((r->>'id')::uuid,v,p.id,p.destination,p_method,p_request_id,h,(r->>'total')::numeric,least(clock_timestamp()+make_interval(mins=>s.deadline_minutes),((p_delivery_date-1)::timestamp+interval '19 hours') AT TIME ZONE 'Africa/Johannesburg'),(r->>'total')::numeric>=s.review_threshold) RETURNING * INTO m;
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) VALUES(m.order_id,auth.uid(),'instructions_created','Immutable approved destination assigned');
 SELECT public.order_to_json(o) INTO r FROM public.orders o WHERE o.id=m.order_id;
 RETURN r||jsonb_build_object('payment_token',m.token);
END $$;
CREATE FUNCTION public.get_manual_payment(p_order_id uuid,p_token uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m private.manual_order_payments%rowtype;r jsonb;
BEGIN
 SELECT * INTO m FROM private.manual_order_payments WHERE order_id=p_order_id;
 IF NOT FOUND OR NOT (coalesce(p_token=m.token,false) OR private.manual_operator(m.vendor_id) OR EXISTS(SELECT 1 FROM public.orders WHERE id=m.order_id AND customer_id=auth.uid() AND private.active_account())) THEN RAISE EXCEPTION 'Payment access unavailable' USING ERRCODE='42501';END IF;
 r:=jsonb_build_object('orderId',m.order_id,'method',m.method,'destination',m.destination,'amount',m.amount,'deadline',m.deadline,'state',CASE WHEN (SELECT status FROM public.orders WHERE id=m.order_id)='cancelled' THEN 'cancelled' WHEN m.state IN('awaiting_payment','payment_reported') AND m.deadline<clock_timestamp() THEN 'expired' ELSE m.state END,'reportedAt',m.reported_at,'reviewRequired',m.review_required,'reference',(SELECT ticket_number FROM public.orders WHERE id=m.order_id),'vendor',(SELECT name FROM public.vendors WHERE id=m.vendor_id));
 RETURN r||jsonb_build_object('disputed',m.disputed_at IS NOT NULL,'refundStatus',(SELECT status FROM private.manual_refund_events WHERE order_id=m.order_id ORDER BY created_at DESC,id DESC LIMIT 1));
END $$;
CREATE FUNCTION public.report_manual_payment(p_order_id uuid,p_token uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m private.manual_order_payments%rowtype;o public.orders%rowtype;
BEGIN
 SELECT * INTO STRICT o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO STRICT m FROM private.manual_order_payments WHERE order_id=p_order_id FOR UPDATE;
 IF NOT (coalesce(p_token=m.token,false) OR (o.customer_id=auth.uid() AND private.active_account())) IS TRUE THEN RAISE EXCEPTION 'Customer payment access required' USING ERRCODE='42501';END IF;
 IF m.state='payment_reported' THEN RETURN;END IF;
 IF o.status<>'pending_payment' OR m.state<>'awaiting_payment' OR m.deadline<clock_timestamp() THEN RAISE EXCEPTION 'Payment deadline or order state requires support review. Do not pay again.';END IF;
 UPDATE private.manual_order_payments SET reported_at=clock_timestamp(),state='payment_reported' WHERE order_id=p_order_id;
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) VALUES(p_order_id,auth.uid(),'customer_reported','Customer claim only; funds not verified');
END $$;
CREATE FUNCTION public.verify_manual_payment(p_order_id uuid,p_amount numeric,p_bank_reference text,p_suspicious boolean DEFAULT false) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m private.manual_order_payments%rowtype;o public.orders%rowtype;a boolean;
BEGIN
 SELECT * INTO STRICT o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO STRICT m FROM private.manual_order_payments WHERE order_id=p_order_id FOR UPDATE;
 IF NOT private.manual_operator(m.vendor_id) THEN RAISE EXCEPTION 'Assigned vendor or active admin required' USING ERRCODE='42501';END IF;
 IF m.state='paid' THEN RETURN 'paid';END IF;
 IF length(btrim(coalesce(p_bank_reference,''))) NOT BETWEEN 3 AND 200 OR p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Verified bank amount and transaction reference required';END IF;
 a:=private.is_admin();
 IF o.status<>'pending_payment' OR m.deadline<clock_timestamp() OR p_amount<>m.amount OR coalesce(p_suspicious,true) OR m.state='disputed' OR (NOT a AND (m.review_required OR m.state='under_review')) THEN
 UPDATE private.manual_order_payments SET state='under_review',review_required=true WHERE order_id=p_order_id;
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) VALUES(p_order_id,auth.uid(),'verification_review',format('Bank reference %s; observed amount %s; expired/cancelled/mismatch/risk require review',p_bank_reference,p_amount));
 RETURN 'under_review';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id WHERE v.id=m.vendor_id AND v.status='approved' AND v.archived_at IS NULL AND NOT p.suspended AND p.deleted_at IS NULL) THEN RAISE EXCEPTION 'Active vendor required';END IF;
 PERFORM 1 FROM public.order_suborders WHERE order_id=p_order_id ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.order_suborders WHERE order_id=p_order_id AND (payment_status<>'unpaid' OR status<>'pending_payment')) THEN RAISE EXCEPTION 'Order requires reconciliation';END IF;
 UPDATE public.order_suborders SET status='confirmed',payment_status='paid' WHERE order_id=p_order_id;
 UPDATE public.orders SET status='confirmed' WHERE id=p_order_id;
 UPDATE private.manual_order_payments SET state='paid',review_required=false,verified_by=auth.uid(),verified_at=clock_timestamp(),verified_amount=p_amount,bank_reference=btrim(p_bank_reference),confirmation_source=CASE WHEN a THEN 'admin_bank_receipt' ELSE 'vendor_bank_receipt' END WHERE order_id=p_order_id;
 INSERT INTO private.manual_receivables(order_id,vendor_id,gross,product_subtotal,commission) SELECT p_order_id,m.vendor_id,m.amount,sum(subtotal),sum(commission_amount) FROM public.order_suborders WHERE order_id=p_order_id;
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) VALUES(p_order_id,auth.uid(),'bank_receipt_verified',btrim(p_bank_reference));
 RETURN 'paid';
END $$;
CREATE FUNCTION public.flag_manual_payment(p_order_id uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m private.manual_order_payments%rowtype;
BEGIN
 PERFORM 1 FROM public.orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO STRICT m FROM private.manual_order_payments WHERE order_id=p_order_id FOR UPDATE;
 IF NOT private.manual_operator(m.vendor_id) THEN RAISE EXCEPTION 'Assigned vendor or admin required';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Dispute reason required';END IF;
 UPDATE private.manual_order_payments SET state=CASE WHEN state='paid' THEN state ELSE 'disputed' END,review_required=true,disputed_at=clock_timestamp() WHERE order_id=p_order_id;
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) VALUES(p_order_id,auth.uid(),'dispute',p_reason);
END $$;

CREATE FUNCTION public.resolve_manual_payment_dispute(p_order_id uuid,p_evidence text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() THEN RAISE EXCEPTION 'Active admin required';END IF;
 IF length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 15 AND 1000 THEN RAISE EXCEPTION 'Independent dispute-resolution evidence required';END IF;
 PERFORM 1 FROM public.orders WHERE id=p_order_id FOR UPDATE;
 UPDATE private.manual_order_payments SET disputed_at=NULL,state=CASE WHEN state='disputed' THEN 'under_review' ELSE state END WHERE order_id=p_order_id;
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) VALUES(p_order_id,auth.uid(),'dispute_resolved',p_evidence);
END $$;
CREATE FUNCTION private.manual_fulfilment_hold() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN('pending_payment','cancelled') AND EXISTS(SELECT 1 FROM private.manual_order_payments m WHERE m.order_id=NEW.order_id AND (m.disputed_at IS NOT NULL OR (m.state='paid' AND (SELECT coalesce(sum(e.amount),0) FROM private.manual_receivable_entries e WHERE e.order_id=m.order_id AND e.kind='refund')>=m.amount))) THEN RAISE EXCEPTION 'Disputed or fully refunded payment blocks fulfilment; resolve disputes or cancel the refunded order';END IF;RETURN NEW;
END $$;
CREATE TRIGGER manual_dispute_fulfilment_hold BEFORE UPDATE OF status ON public.order_suborders FOR EACH ROW EXECUTE FUNCTION private.manual_fulfilment_hold();

-- Gateway funds and payouts must never include proceeds received directly by vendors.
DO $$ DECLARE d text;BEGIN
 SELECT pg_get_viewdef('private.financial_sales'::regclass,true) INTO d;
 EXECUTE 'CREATE OR REPLACE VIEW private.financial_sales AS SELECT * FROM ('||rtrim(d,E';\n ')||') historical WHERE NOT EXISTS(SELECT 1 FROM private.manual_order_payments m WHERE m.order_id=historical.order_id)';
END $$;
CREATE FUNCTION public.manual_payment_workspace(p_test_only boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a boolean;v uuid;
BEGIN
 IF NOT private.active_account() THEN RAISE EXCEPTION 'Active account required';END IF;
 IF p_test_only IS NULL THEN RAISE EXCEPTION 'Explicit test-order scope required';END IF;
 a:=private.is_admin();v:=private.current_vendor_id();
 IF NOT a AND NOT private.manual_operator(v) THEN RAISE EXCEPTION 'Vendor or admin required';END IF;
 RETURN jsonb_build_object('settings',CASE WHEN a THEN (SELECT to_jsonb(s)||jsonb_build_object('eft_enabled',(SELECT enabled AND ready AND NOT maintenance FROM private.gateway_settings WHERE provider='manual_eft'),'payshap_enabled',(SELECT enabled AND ready AND NOT maintenance FROM private.gateway_settings WHERE provider='manual_payshap')) FROM private.manual_payment_settings s) END,
 'profiles',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC),'[]') FROM private.vendor_payment_profiles p WHERE a OR p.vendor_id=v),
 'payments',(SELECT coalesce(jsonb_agg(jsonb_build_object('orderId',m.order_id,'vendorId',m.vendor_id,'reference',o.ticket_number,'method',m.method,'amount',m.amount,'deadline',m.deadline,'state',CASE WHEN m.deadline<now() AND m.state IN('awaiting_payment','payment_reported') THEN 'expired' ELSE m.state END,'orderStatus',o.status,'reportedAt',m.reported_at,'verifiedBy',m.verified_by,'verifiedAt',m.verified_at,'verifiedAmount',m.verified_amount,'reviewRequired',m.review_required) ORDER BY o.created_at DESC),'[]') FROM private.manual_order_payments m JOIN public.orders o ON o.id=m.order_id WHERE (a OR m.vendor_id=v) AND o.is_test=p_test_only),
 'receivables',(SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('reference',o.ticket_number,'collected',(SELECT coalesce(sum(CASE WHEN kind='collection' THEN amount WHEN kind='commission_return' THEN -amount ELSE 0 END),0) FROM private.manual_receivable_entries WHERE order_id=r.order_id),'refunds',(SELECT coalesce(sum(amount),0) FROM private.manual_receivable_entries WHERE order_id=r.order_id AND kind='refund'),'credits',(SELECT coalesce(sum(commission_credit),0) FROM private.manual_receivable_entries WHERE order_id=r.order_id AND kind='refund')) ORDER BY r.created_at DESC),'[]') FROM private.manual_receivables r JOIN public.orders o ON o.id=r.order_id WHERE (a OR r.vendor_id=v) AND o.is_test=p_test_only),
 'events',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC),'[]') FROM private.manual_payment_events e LEFT JOIN private.manual_order_payments m ON m.order_id=e.order_id LEFT JOIN private.vendor_payment_profiles p ON p.id=e.profile_id WHERE a OR m.vendor_id=v OR p.vendor_id=v));
END $$;

CREATE FUNCTION public.record_manual_refund_status(p_order_id uuid,p_status text,p_amount numeric,p_product_refund numeric,p_evidence text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m private.manual_order_payments%rowtype;last_state text;
BEGIN
 PERFORM 1 FROM public.orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO STRICT m FROM private.manual_order_payments WHERE order_id=p_order_id FOR UPDATE;
 IF NOT private.manual_operator(m.vendor_id) THEN RAISE EXCEPTION 'Assigned vendor or admin required';END IF;
 IF p_status IS NULL OR p_status NOT IN('requested','vendor_processing','completed','declined') OR length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 15 AND 1000 THEN RAISE EXCEPTION 'Refund status and independent evidence required';END IF;
 IF p_status IN('completed','declined') AND NOT private.is_admin() THEN RAISE EXCEPTION 'Admin refund reconciliation required';END IF;
 SELECT status INTO last_state FROM private.manual_refund_events WHERE order_id=p_order_id ORDER BY created_at DESC,id DESC LIMIT 1;
 IF EXISTS(SELECT 1 FROM private.manual_refund_events WHERE order_id=p_order_id AND evidence=p_evidence AND status=p_status) THEN RETURN;END IF;
 IF p_amount IS NOT NULL AND (p_amount<=0 OR p_amount<>round(p_amount,2)) THEN RAISE EXCEPTION 'Refund amount must be positive whole cents';END IF;
 IF p_product_refund IS NULL OR p_product_refund<0 OR p_product_refund<>round(p_product_refund,2) OR (p_amount IS NULL AND p_product_refund<>0) OR (p_amount IS NOT NULL AND p_product_refund>p_amount) THEN RAISE EXCEPTION 'Valid product refund allocation in whole cents required';END IF;
 IF (p_status='requested' AND last_state IN('requested','vendor_processing')) OR (p_status<>'requested' AND (last_state IS NULL OR last_state NOT IN('requested','vendor_processing'))) THEN RAISE EXCEPTION 'Invalid refund state transition; a new request is required after a completed or declined refund';END IF;
 IF p_status='completed' THEN
  IF last_state IS NULL OR last_state NOT IN('requested','vendor_processing') OR p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Open refund request and verified positive refund amount required';END IF;
  IF EXISTS(SELECT 1 FROM private.manual_receivables WHERE order_id=p_order_id) THEN PERFORM public.admin_manual_receivable_entry(p_order_id,'refund',p_amount,p_evidence,p_product_refund);END IF;
 END IF;
 IF p_status='requested' THEN
  UPDATE private.manual_order_payments SET disputed_at=clock_timestamp(),review_required=true,state=CASE WHEN state='paid' THEN state ELSE 'disputed' END WHERE order_id=p_order_id;
 END IF;
 INSERT INTO private.manual_refund_events(order_id,status,amount,evidence,actor_id) VALUES(p_order_id,p_status,p_amount,p_evidence,auth.uid());
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) VALUES(p_order_id,auth.uid(),'refund_'||p_status,format('%s; amount %s; product refund %s',p_evidence,p_amount,p_product_refund));
END $$;

CREATE OR REPLACE FUNCTION public.enforce_order_status_transition() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE old_step integer;new_step integer;
BEGIN
 IF NEW.status=OLD.status THEN RETURN NEW;END IF;
 IF NEW.status='cancelled' AND private.active_account() AND private.is_admin()
 AND EXISTS(SELECT 1 FROM private.manual_order_payments m WHERE m.order_id=NEW.order_id AND m.state='paid' AND (SELECT coalesce(sum(amount),0) FROM private.manual_receivable_entries WHERE order_id=m.order_id AND kind='refund')>=m.amount) THEN RETURN NEW;END IF;
 IF OLD.status='pending_payment' AND NEW.status='cancelled' THEN RETURN NEW;END IF;
 IF OLD.status='cancelled' THEN RAISE EXCEPTION 'Cannot change status of a cancelled order';END IF;
 IF OLD.status IN('pending_payment','payment_submitted') AND NEW.status='confirmed' THEN RETURN NEW;END IF;
 SELECT step INTO old_step FROM public.order_flow WHERE status=OLD.status;
 SELECT step INTO new_step FROM public.order_flow WHERE status=NEW.status;
 IF old_step IS NULL OR new_step IS NULL OR new_step<>old_step+1 THEN RAISE EXCEPTION 'Invalid status transition: % -> %',OLD.status,NEW.status;END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.admin_cancel_refunded_manual_order(p_order_id uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m private.manual_order_payments%rowtype;
BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() THEN RAISE EXCEPTION 'Active admin required';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 15 AND 1000 THEN RAISE EXCEPTION 'Reviewed cancellation reason required';END IF;
 PERFORM 1 FROM public.orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO STRICT m FROM private.manual_order_payments WHERE order_id=p_order_id FOR UPDATE;
 IF m.state<>'paid' OR (SELECT coalesce(sum(amount),0) FROM private.manual_receivable_entries WHERE order_id=p_order_id AND kind='refund')<m.amount THEN RAISE EXCEPTION 'Full independently reconciled vendor refund required';END IF;
 IF EXISTS(SELECT 1 FROM public.order_suborders WHERE order_id=p_order_id AND status='completed') THEN RAISE EXCEPTION 'Completed fulfilment remains historical; record refund adjustments without cancellation';END IF;
 UPDATE public.order_suborders SET status='cancelled' WHERE order_id=p_order_id;
 UPDATE public.orders SET status='cancelled' WHERE id=p_order_id;
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) VALUES(p_order_id,auth.uid(),'refunded_order_cancelled',p_reason);
END $$;
CREATE FUNCTION public.admin_manual_settings(p_eft boolean,p_payshap boolean,p_minutes integer,p_threshold numeric,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() THEN RAISE EXCEPTION 'Active admin required';END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Configuration reason required';END IF;
 UPDATE private.manual_payment_settings SET deadline_minutes=p_minutes,review_threshold=p_threshold;
 PERFORM public.admin_update_payment_gateway('manual_eft',p_eft,false,p_reason);
 PERFORM public.admin_update_payment_gateway('manual_payshap',p_payshap,false,p_reason);
 INSERT INTO private.manual_payment_events(actor_id,action,note) VALUES(auth.uid(),'settings_changed',p_reason||' '||jsonb_build_object('eft',p_eft,'payshap',p_payshap,'minutes',p_minutes,'reviewThreshold',p_threshold)::text);
END $$;
CREATE FUNCTION public.admin_manual_receivable_entry(p_order_id uuid,p_kind text,p_amount numeric,p_evidence text,p_product_refund numeric DEFAULT 0) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r private.manual_receivables%rowtype;prior numeric;credit numeric:=0;refunded numeric;prior_product numeric;
BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() THEN RAISE EXCEPTION 'Active admin required';END IF;
 IF p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_product_refund IS NULL OR p_product_refund<0 OR p_product_refund<>round(p_product_refund,2) OR p_product_refund>p_amount OR (p_kind<>'refund' AND p_product_refund<>0) OR p_kind NOT IN('collection','refund','commission_return') OR p_kind IS NULL OR length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Positive amount, kind, product refund allocation and unique bank evidence required';END IF;
 PERFORM 1 FROM public.orders WHERE id=p_order_id FOR UPDATE;
 SELECT * INTO STRICT r FROM private.manual_receivables WHERE order_id=p_order_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM private.manual_receivable_entries WHERE order_id=p_order_id AND evidence=p_evidence) THEN RAISE EXCEPTION 'Evidence already recorded';END IF;
 SELECT coalesce(sum(amount),0) INTO prior FROM private.manual_receivable_entries WHERE order_id=p_order_id AND kind=p_kind;
 SELECT coalesce(sum(commission_credit),0) INTO refunded FROM private.manual_receivable_entries WHERE order_id=p_order_id;
 SELECT coalesce(sum(product_refund),0) INTO prior_product FROM private.manual_receivable_entries WHERE order_id=p_order_id;
 IF p_kind='refund' THEN
 IF prior+p_amount>r.gross THEN RAISE EXCEPTION 'Refund exceeds received amount';END IF;
 IF prior_product+p_product_refund>r.product_subtotal OR (prior+p_amount-prior_product-p_product_refund)>r.gross-r.product_subtotal THEN RAISE EXCEPTION 'Refund allocation exceeds product or delivery amount';END IF;
 -- Cumulative rounding avoids losing cents across split refunds; delivery never earns a commission credit.
 credit:=round(r.commission*(prior_product+p_product_refund)/r.product_subtotal,2)-refunded;
 ELSE
 SELECT coalesce(sum(CASE WHEN kind='collection' THEN amount WHEN kind='commission_return' THEN -amount ELSE 0 END),0) INTO prior FROM private.manual_receivable_entries WHERE order_id=p_order_id;
 IF p_kind='commission_return' AND p_amount>prior THEN RAISE EXCEPTION 'Commission return exceeds collected amount';END IF;
 IF p_kind='collection' AND prior+p_amount>r.commission-refunded THEN RAISE EXCEPTION 'Collection exceeds receivable balance';END IF;
 END IF;
 INSERT INTO private.manual_receivable_entries(order_id,kind,amount,commission_credit,product_refund,evidence,actor_id) VALUES(p_order_id,p_kind,p_amount,credit,p_product_refund,p_evidence,auth.uid());
 INSERT INTO private.manual_payment_events(order_id,actor_id,action,note) VALUES(p_order_id,auth.uid(),p_kind,p_evidence);
END $$;

DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT oid::regprocedure signature,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('submit_vendor_payment_profile','approve_vendor_payment_profile','get_vendor_manual_methods','create_manual_order','get_manual_payment','report_manual_payment','verify_manual_payment','flag_manual_payment','manual_payment_workspace','admin_manual_settings','admin_manual_receivable_entry','resolve_manual_payment_dispute','record_manual_refund_status','admin_cancel_refunded_manual_order') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
 IF f.proname IN('get_vendor_manual_methods','create_manual_order','get_manual_payment','report_manual_payment') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',f.signature);END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.manual_operator(uuid),private.block_marketplace_provider(),private.block_provider_attempt(),private.manual_immutable(),private.manual_profile_lock(),private.manual_fulfilment_hold() FROM PUBLIC,anon,authenticated;

DO $verify$
DECLARE before_row record;
BEGIN
 SELECT * INTO STRICT before_row FROM officebites_manual_payment_baseline;
 IF before_row.orders<>(SELECT count(*) FROM public.orders)
 OR before_row.suborders<>(SELECT count(*) FROM public.order_suborders)
 OR before_row.vendors<>(SELECT count(*) FROM public.vendors)
 OR before_row.acceptances<>(SELECT count(*) FROM private.vendor_legal_acceptances)
 THEN RAISE EXCEPTION 'Existing production records changed; roll back manual-payment foundation'; END IF;
 IF (SELECT count(*) FROM private.vendor_payment_profiles)<>0
 OR (SELECT count(*) FROM private.manual_order_payments)<>0
 OR (SELECT count(*) FROM private.manual_payment_events)<>0
 OR (SELECT count(*) FROM private.manual_receivables)<>0
 OR (SELECT count(*) FROM private.manual_receivable_entries)<>0
 OR (SELECT count(*) FROM private.manual_refund_events)<>0
 THEN RAISE EXCEPTION 'Manual-payment migration must not create profiles, payments or history'; END IF;
 IF (SELECT count(*) FROM private.gateway_settings)<>4
 OR EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled)
 OR NOT EXISTS(SELECT 1 FROM private.gateway_settings WHERE provider='manual_eft' AND NOT enabled AND ready)
 OR NOT EXISTS(SELECT 1 FROM private.gateway_settings WHERE provider='manual_payshap' AND NOT enabled AND ready)
 OR NOT EXISTS(SELECT 1 FROM private.gateway_settings WHERE provider='payfast' AND NOT enabled)
 OR NOT EXISTS(SELECT 1 FROM private.gateway_settings WHERE provider='ozow' AND NOT enabled AND NOT ready)
 THEN RAISE EXCEPTION 'Payment provider safety flags differ from fail-closed baseline'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.vendor_payment_profiles'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.manual_order_payments'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.manual_payment_events'::regclass)
 THEN RAISE EXCEPTION 'Manual-payment tables must have RLS enabled'; END IF;
END
$verify$;
COMMIT;
