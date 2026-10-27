-- LOCAL CANDIDATE ONLY. Depends on atomic-collection-candidate.sql.
-- No new gateway, no delivery policy changes, no enabled runtime defaults.
BEGIN;
DO $$ BEGIN IF current_setting('officebites.local_fixture',true) IS DISTINCT FROM 'isolated-pglite-only' THEN RAISE EXCEPTION 'Local fixture only'; END IF; END $$;
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
COMMIT;
