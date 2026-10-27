-- LOCAL ONLY, after assisted-cash-candidate.sql. Not a hosted installer.
BEGIN;
DO $$ BEGIN IF current_setting('officebites.local_fixture',true) IS DISTINCT FROM 'isolated-pglite-only' THEN RAISE EXCEPTION 'Local fixture only';END IF;END $$;
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
COMMIT;
