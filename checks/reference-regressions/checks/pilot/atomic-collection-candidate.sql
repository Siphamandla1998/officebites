-- LOCAL ONLY. Depends on booking-candidate.sql and existing manual-payment SQL.
-- Not a hosted migration. No delivery activation, price changes or accounts.
BEGIN;
DO $$ BEGIN
 IF current_setting('officebites.local_fixture',true) IS DISTINCT FROM 'isolated-pglite-only' THEN
  RAISE EXCEPTION 'Local fixture only'; END IF;
END $$;
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
COMMIT;
