-- LOCAL ONLY. Legacy paid commissions remain unresolved: no guessed backfill or fee overwrite.
ALTER TABLE public.vendors ALTER COLUMN commission_rate SET DEFAULT 0.17;
ALTER TABLE public.orders ADD COLUMN is_test boolean NOT NULL DEFAULT false, ADD COLUMN classification_version integer NOT NULL DEFAULT 0;
ALTER TABLE public.order_suborders ADD COLUMN commission_rate_snapshot numeric, ADD COLUMN commission_amount numeric(12,2),
  ADD COLUMN paid_at timestamptz, ADD COLUMN vendor_name_snapshot text, ADD COLUMN commission_evidence text;
ALTER TABLE public.order_items ADD COLUMN category_snapshot text;
CREATE TABLE private.business_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid,action text NOT NULL,record_id uuid,
  reason text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE private.finance_settings(singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),fee_policy text CHECK(fee_policy IN ('platform_absorbs','vendor_proportional')),updated_at timestamptz,updated_by uuid);
INSERT INTO private.finance_settings(singleton) VALUES(true);
CREATE TABLE public.vendor_payouts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  request_id uuid NOT NULL UNIQUE,status text NOT NULL DEFAULT 'allocated' CHECK(status IN ('allocated','paid','void')),
  fee_policy text NOT NULL CHECK(fee_policy IN ('platform_absorbs','vendor_proportional')),amount numeric(12,2) NOT NULL CHECK(amount>=0),
  reference text,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),reconciled_at timestamptz);
CREATE TABLE public.payout_allocations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payout_id uuid NOT NULL REFERENCES public.vendor_payouts(id),
  suborder_id uuid NOT NULL REFERENCES public.order_suborders(id),gross numeric(12,2) NOT NULL,commission numeric(12,2) NOT NULL,
  processor_fee numeric(12,2) NOT NULL,payable numeric(12,2) NOT NULL CHECK(payable>=0),released_at timestamptz);
CREATE UNIQUE INDEX payout_one_active_allocation ON public.payout_allocations(suborder_id) WHERE released_at IS NULL;
ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY payout_read ON public.vendor_payouts FOR SELECT TO authenticated USING(private.is_admin() OR vendor_id=private.current_vendor_id());
CREATE POLICY allocation_read ON public.payout_allocations FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.vendor_payouts p WHERE p.id=payout_id));
REVOKE ALL ON public.vendor_payouts,public.payout_allocations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vendor_payouts,public.payout_allocations TO authenticated;
REVOKE ALL ON private.business_audit,private.finance_settings FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.snapshot_order_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN SELECT category INTO NEW.category_snapshot FROM public.meals WHERE id=NEW.meal_id; RETURN NEW; END $$;
CREATE TRIGGER snapshot_order_item BEFORE INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION private.snapshot_order_item();
CREATE FUNCTION private.snapshot_paid_commission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.commission_amount IS NOT NULL AND (NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
  OR NEW.commission_rate_snapshot IS DISTINCT FROM OLD.commission_rate_snapshot OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
  OR NEW.paid_at IS DISTINCT FROM OLD.paid_at OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id OR NEW.payment_status IS DISTINCT FROM OLD.payment_status) THEN RAISE EXCEPTION 'Paid financial snapshots are immutable'; END IF;
 IF TG_OP='UPDATE' AND OLD.payment_status IS DISTINCT FROM 'paid' AND NEW.payment_status='paid' THEN
  SELECT commission_rate,name INTO NEW.commission_rate_snapshot,NEW.vendor_name_snapshot FROM public.vendors WHERE id=NEW.vendor_id FOR SHARE;
  NEW.commission_amount:=round(NEW.subtotal*NEW.commission_rate_snapshot,2); NEW.paid_at:=clock_timestamp(); NEW.commission_evidence:='captured at verified paid transition';
 ELSIF TG_OP='INSERT' AND NEW.payment_status='paid' THEN RAISE EXCEPTION 'Create unpaid suborders; confirmation must perform the paid transition';
 ELSIF TG_OP='UPDATE' AND OLD.commission_amount IS NOT NULL AND (NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
  OR NEW.commission_rate_snapshot IS DISTINCT FROM OLD.commission_rate_snapshot OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
  OR NEW.paid_at IS DISTINCT FROM OLD.paid_at OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id) THEN RAISE EXCEPTION 'Paid financial snapshots are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER snapshot_paid_commission BEFORE INSERT OR UPDATE ON public.order_suborders FOR EACH ROW EXECUTE FUNCTION private.snapshot_paid_commission();
CREATE FUNCTION public.admin_record_historical_commission(p_suborder_id uuid,p_rate numeric,p_evidence text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF p_rate IS NULL OR p_rate<0 OR p_rate>1 OR length(btrim(coalesce(p_evidence,'')))<10 THEN RAISE EXCEPTION 'Rate and historical evidence required'; END IF;
 UPDATE public.order_suborders SET commission_rate_snapshot=p_rate,commission_amount=round(subtotal*p_rate,2),commission_evidence=p_evidence
  WHERE id=p_suborder_id AND payment_status='paid' AND commission_amount IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only unresolved historical paid records may be backfilled'; END IF;
 INSERT INTO private.business_audit(actor_id,action,record_id,reason,details) VALUES(auth.uid(),'historical_commission',p_suborder_id,p_evidence,jsonb_build_object('rate',p_rate));
END $$;
CREATE VIEW private.financial_sales AS SELECT so.id suborder_id,so.order_id,so.vendor_id,o.ticket_number,so.status,so.subtotal gross,
 so.commission_rate_snapshot commission_rate,so.commission_amount commission,so.subtotal-so.commission_amount vendor_earnings,o.total order_total,
 coalesce(so.vendor_name_snapshot,v.name) vendor_name,(coalesce(so.paid_at,o.created_at) AT TIME ZONE 'Africa/Johannesburg')::date financial_date,
 CASE WHEN so.paid_at IS NULL THEN 'legacy_order_creation_date' ELSE 'paid_date' END date_basis,coalesce(f.fee,0) order_fee
 FROM public.order_suborders so JOIN public.orders o ON o.id=so.order_id JOIN public.vendors v ON v.id=so.vendor_id
 LEFT JOIN(SELECT order_id,sum(processor_fee) fee FROM public.payfast_itn_log WHERE payment_status='COMPLETE' GROUP BY order_id) f ON f.order_id=o.id
 WHERE NOT o.is_test AND so.payment_status='paid' AND so.status IN('confirmed','accepted','preparing','ready','collected','completed')
 AND o.status IN('confirmed','accepted','preparing','ready','collected','completed');
REVOKE ALL ON private.financial_sales FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.get_financial_report(p_vendor_id uuid DEFAULT NULL,p_from date DEFAULT NULL,p_to date DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;
BEGIN
 IF NOT private.is_admin() AND (p_vendor_id IS NULL OR p_vendor_id IS DISTINCT FROM private.current_vendor_id()) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from>p_to THEN RAISE EXCEPTION 'Invalid date range'; END IF;
 WITH all_sales AS(SELECT s.*,round(order_fee*gross/nullif(sum(gross) OVER(PARTITION BY order_id),0),2) provisional_fee,
  row_number() OVER(PARTITION BY order_id ORDER BY suborder_id) rn FROM private.financial_sales s),
 allocated AS(SELECT s.*,CASE WHEN rn=1 THEN order_fee-sum(provisional_fee) OVER(PARTITION BY order_id)+provisional_fee ELSE provisional_fee END processor_fee FROM all_sales s),
 sales AS(SELECT * FROM allocated WHERE(p_vendor_id IS NULL OR vendor_id=p_vendor_id) AND(p_from IS NULL OR financial_date>=p_from) AND(p_to IS NULL OR financial_date<=p_to)),
 categories AS(SELECT coalesce(oi.category_snapshot,'Unknown (historical)') category,sum(oi.qty) units,sum(oi.qty*oi.price) revenue FROM sales s JOIN public.order_items oi ON oi.suborder_id=s.suborder_id GROUP BY 1),
 meals AS(SELECT coalesce(oi.meal_id::text,'deleted:'||oi.meal_name) meal_key,oi.meal_name name,sum(oi.qty) units,sum(oi.qty*oi.price) revenue FROM sales s JOIN public.order_items oi ON oi.suborder_id=s.suborder_id GROUP BY 1,2),
 weeks AS(SELECT date_trunc('week',financial_date::timestamp)::date week,sum(gross) gmv,CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE sum(commission) END "grossCommission" FROM sales GROUP BY 1),
 vendors AS(SELECT vendor_id "vendorId",vendor_name name,count(*) orders,sum(gross) gmv,CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE sum(commission) END "grossCommission" FROM sales GROUP BY 1,2)
 SELECT jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY financial_date,suborder_id) FROM sales s),'[]'),
 'totals',(SELECT jsonb_build_object('gmv',coalesce(sum(gross),0),'paidOrders',count(DISTINCT order_id),'suborders',count(*),'unresolvedCommission',count(*) FILTER(WHERE commission IS NULL),
  'grossCommission',CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE coalesce(sum(commission),0) END,
  'vendorEarnings',CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE coalesce(sum(vendor_earnings),0) END,
  'processorFees',coalesce(sum(processor_fee),0),'netMarketplaceRevenue',CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE CASE (SELECT fee_policy FROM private.finance_settings) WHEN 'platform_absorbs' THEN coalesce(sum(commission),0)-coalesce(sum(processor_fee),0) WHEN 'vendor_proportional' THEN coalesce(sum(commission),0) ELSE NULL END END,
  'averageOrderValue',coalesce(sum(gross)/nullif(count(DISTINCT order_id),0),0)) FROM sales),
 'categories',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY units DESC) FROM categories c),'[]'),
 'meals',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY units DESC) FROM meals m),'[]'),
 'weekly',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY week) FROM weeks w),'[]'),
 'topVendors',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY gmv DESC) FROM vendors v),'[]'),
 'reconciliation',CASE WHEN private.is_admin() THEN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM(
  SELECT s.order_id,o.ticket_number,o.total "recordedOrderTotal",sum(s.gross) "eligibleBusinessGross",
   (SELECT coalesce(sum(subtotal),0) FROM public.order_suborders WHERE order_id=s.order_id) "allSuborderGross",
   (SELECT coalesce(sum(amount_gross),0) FROM public.payfast_itn_log WHERE order_id=s.order_id AND payment_status='COMPLETE') "recordedCompletePayments",
   (SELECT count(*) FROM public.payfast_itn_log WHERE order_id=s.order_id AND payment_status='COMPLETE') "completePaymentCount",
   o.total-(SELECT coalesce(sum(subtotal),0) FROM public.order_suborders WHERE order_id=s.order_id) "orderAmountDifference"
   FROM sales s JOIN public.orders o ON o.id=s.order_id GROUP BY s.order_id,o.id) x),'[]'::jsonb) ELSE '[]'::jsonb END,
 'from',p_from,'to',p_to,'timezone','Africa/Johannesburg','feePolicy',(SELECT fee_policy FROM private.finance_settings),
 'customers',(SELECT count(*) FROM public.profiles WHERE role='customer' AND NOT suspended),'activeVendors',(SELECT count(*) FROM public.vendors WHERE status='approved'),
 'pendingVendors',(SELECT count(*) FROM public.vendors WHERE status='pending'),
 'ordersToday',(SELECT count(*) FROM public.orders WHERE NOT is_test AND(created_at AT TIME ZONE 'Africa/Johannesburg')::date=(now() AT TIME ZONE 'Africa/Johannesburg')::date)) INTO r;
 RETURN r;
END $$;
CREATE FUNCTION public.admin_preview_test_order(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%rowtype;
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT o FROM public.orders WHERE id=p_order_id;
 RETURN jsonb_build_object('orderId',o.id,'ticket',o.ticket_number,'version',o.classification_version,'isTest',o.is_test,
  'suborders',(SELECT coalesce(jsonb_agg(id),'[]') FROM public.order_suborders WHERE order_id=o.id),
  'items',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',i.id,'name',i.meal_name)),'[]') FROM public.order_items i JOIN public.order_suborders s ON s.id=i.suborder_id WHERE s.order_id=o.id),
  'paymentLogs',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'paymentId',pf_payment_id,'fee',processor_fee)),'[]') FROM public.payfast_itn_log WHERE order_id=o.id),
  'conversations',(SELECT coalesce(jsonb_agg(id),'[]') FROM public.conversations WHERE order_id=o.id),
  'notifications',(SELECT coalesce(jsonb_agg(id),'[]') FROM public.notifications WHERE action_url='/orders/'||o.id::text OR metadata->>'orderId'=o.id::text OR strpos(title,o.ticket_number)>0),
  'payoutAllocations',(SELECT coalesce(jsonb_agg(a.id),'[]') FROM public.payout_allocations a JOIN public.order_suborders s ON s.id=a.suborder_id WHERE s.order_id=o.id AND a.released_at IS NULL),
  'before',public.get_financial_report(NULL,NULL,NULL)->'totals',
  'after',(SELECT jsonb_build_object('gmv',coalesce(sum(gross),0),'paidOrders',count(DISTINCT order_id),'suborders',count(*),
    'unresolvedCommission',count(*) FILTER(WHERE commission IS NULL),
    'grossCommission',CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE coalesce(sum(commission),0) END,
    'vendorEarnings',CASE WHEN count(*) FILTER(WHERE commission IS NULL)>0 THEN NULL ELSE coalesce(sum(vendor_earnings),0) END,
    'processorFees',(SELECT coalesce(sum(fee),0) FROM(SELECT max(order_fee) fee FROM private.financial_sales WHERE order_id<>o.id GROUP BY order_id) fees))
    FROM private.financial_sales WHERE order_id<>o.id),
  'excludedContribution',(SELECT jsonb_build_object('gmv',coalesce(sum(gross),0),'commission',sum(commission),'unresolved',count(*) FILTER(WHERE commission IS NULL),'processorFees',max(order_fee)) FROM private.financial_sales WHERE order_id=o.id));
END $$;
CREATE FUNCTION public.admin_classify_test_order(p_order_id uuid,p_reason text,p_expected_version integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF length(btrim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Review evidence and give a reason'; END IF;
 PERFORM 1 FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.payout_allocations a JOIN public.order_suborders s ON s.id=a.suborder_id WHERE s.order_id=p_order_id AND a.released_at IS NULL) THEN RAISE EXCEPTION 'Reconcile payout allocations before classification'; END IF;
 UPDATE public.orders SET is_test=true,classification_version=classification_version+1 WHERE id=p_order_id AND classification_version=p_expected_version AND NOT is_test;
 IF NOT FOUND THEN RAISE EXCEPTION 'Classification changed; refresh preview'; END IF;
 INSERT INTO private.business_audit(actor_id,action,record_id,reason) VALUES(auth.uid(),'classify_test_order',p_order_id,p_reason);
 RETURN public.admin_preview_test_order(p_order_id);
END $$;
CREATE FUNCTION public.admin_set_fee_policy(p_policy text,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('officebites-payout'));
 IF p_policy IS NULL OR p_policy NOT IN('platform_absorbs','vendor_proportional') OR length(btrim(coalesce(p_reason,'')))<10 THEN RAISE EXCEPTION 'Policy and decision reason required'; END IF;
 IF EXISTS(SELECT 1 FROM public.vendor_payouts WHERE status='allocated') THEN RAISE EXCEPTION 'Reconcile allocations before changing policy'; END IF;
 UPDATE private.finance_settings SET fee_policy=p_policy,updated_at=now(),updated_by=auth.uid();
 INSERT INTO private.business_audit(actor_id,action,reason,details) VALUES(auth.uid(),'fee_policy',p_reason,jsonb_build_object('policy',p_policy));
END $$;
CREATE FUNCTION public.get_payout_ledger(p_vendor_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE report jsonb; policy text;
BEGIN
 report:=public.get_financial_report(p_vendor_id,NULL,NULL); policy:=report->>'feePolicy';
 RETURN jsonb_build_object('policy',policy,'eligible',(SELECT coalesce(jsonb_agg(to_jsonb(e)),'[]') FROM(
  SELECT r.*,CASE WHEN policy IS NULL OR commission IS NULL THEN NULL ELSE vendor_earnings-CASE WHEN policy='vendor_proportional' THEN processor_fee ELSE 0 END END payable
  FROM jsonb_to_recordset(report->'rows') AS r(suborder_id uuid,vendor_id uuid,status text,gross numeric,commission numeric,vendor_earnings numeric,processor_fee numeric)
  WHERE status='completed' AND NOT EXISTS(SELECT 1 FROM public.payout_allocations a WHERE a.suborder_id=r.suborder_id AND a.released_at IS NULL)) e),
  'payouts',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY created_at DESC),'[]') FROM public.vendor_payouts p WHERE p_vendor_id IS NULL OR vendor_id=p_vendor_id),
  'unresolvedCommission',report->'totals'->'unresolvedCommission','settlementRule','Completed paid business suborders only. Allocations reserve funds; no transfer is performed.');
END $$;
CREATE FUNCTION public.admin_allocate_payout(p_vendor_id uuid,p_suborder_ids uuid[],p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ledger jsonb; policy text; payout uuid; amount numeric; count_rows integer;
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR coalesce(cardinality(p_suborder_ids),0)=0 THEN RAISE EXCEPTION 'Selection and request ID required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('officebites-payout'));
 SELECT id INTO payout FROM public.vendor_payouts WHERE request_id=p_request_id;
 IF FOUND THEN
  IF NOT EXISTS(SELECT 1 FROM public.vendor_payouts WHERE id=payout AND vendor_id=p_vendor_id) THEN RAISE EXCEPTION 'Request ID conflict'; END IF;
  IF (SELECT array_agg(suborder_id ORDER BY suborder_id) FROM public.payout_allocations WHERE payout_id=payout) IS DISTINCT FROM (SELECT array_agg(x ORDER BY x) FROM unnest(p_suborder_ids) x) THEN RAISE EXCEPTION 'Request ID selection conflict'; END IF;
  RETURN to_jsonb((SELECT p FROM public.vendor_payouts p WHERE id=payout));
 END IF;
 PERFORM 1 FROM public.orders WHERE id IN(SELECT order_id FROM public.order_suborders WHERE id=ANY(p_suborder_ids)) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM private.finance_settings FOR UPDATE;
 ledger:=public.get_payout_ledger(p_vendor_id); policy:=ledger->>'policy';
 IF policy IS NULL THEN RAISE EXCEPTION 'Approve processor-fee policy first'; END IF;
 SELECT count(*),sum(payable) INTO count_rows,amount FROM jsonb_to_recordset(ledger->'eligible') AS e(suborder_id uuid,payable numeric) WHERE suborder_id=ANY(p_suborder_ids) AND payable IS NOT NULL AND payable>=0;
 IF count_rows<>cardinality(p_suborder_ids) THEN RAISE EXCEPTION 'Selection includes unpaid, test, incomplete, unresolved or allocated records'; END IF;
 INSERT INTO public.vendor_payouts(vendor_id,request_id,fee_policy,amount,created_by) VALUES(p_vendor_id,p_request_id,policy,amount,auth.uid()) RETURNING id INTO payout;
 INSERT INTO public.payout_allocations(payout_id,suborder_id,gross,commission,processor_fee,payable)
  SELECT payout,e.suborder_id,e.gross,e.commission,CASE WHEN policy='vendor_proportional' THEN e.processor_fee ELSE 0 END,e.payable FROM jsonb_to_recordset(ledger->'eligible') AS e(suborder_id uuid,gross numeric,commission numeric,processor_fee numeric,payable numeric) WHERE suborder_id=ANY(p_suborder_ids);
 INSERT INTO private.business_audit(actor_id,action,record_id,reason) VALUES(auth.uid(),'allocate_payout',payout,'Completed paid business suborders; no transfer');
 RETURN to_jsonb((SELECT p FROM public.vendor_payouts p WHERE id=payout));
END $$;
CREATE FUNCTION public.admin_reconcile_payout(p_payout_id uuid,p_status text,p_reference text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_status NOT IN('paid','void') OR length(btrim(coalesce(p_reference,'')))<5 THEN RAISE EXCEPTION 'External transfer reference or void reason required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('officebites-payout'));
 UPDATE public.vendor_payouts SET status=p_status,reference=p_reference,reconciled_at=now() WHERE id=p_payout_id AND status='allocated';
 IF NOT FOUND THEN RAISE EXCEPTION 'Only allocated payouts may be reconciled'; END IF;
 IF p_status='void' THEN UPDATE public.payout_allocations SET released_at=now() WHERE payout_id=p_payout_id; END IF;
 INSERT INTO private.business_audit(actor_id,action,record_id,reason,details) VALUES(auth.uid(),'reconcile_payout',p_payout_id,p_reference,jsonb_build_object('status',p_status));
END $$;
CREATE OR REPLACE FUNCTION public.confirm_payfast_payment(p_order_id uuid, p_pf_payment_id text, p_m_payment_id text, p_amount_gross numeric, p_payment_status text, p_raw_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_log public.payfast_itn_log%ROWTYPE;
  v_sub record;
  v_fee numeric := 0;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.payment_method<>'payfast' THEN RAISE EXCEPTION 'This is not a PayFast order'; END IF;
  IF nullif(trim(p_pf_payment_id),'') IS NULL OR p_m_payment_id IS DISTINCT FROM v_order.ticket_number THEN
    RAISE EXCEPTION 'Invalid PayFast payment reference';
  END IF;
  IF p_payment_status IS NULL THEN RAISE EXCEPTION 'Payment status is required'; END IF;
  IF p_amount_gross IS NULL OR p_amount_gross<>v_order.total THEN RAISE EXCEPTION 'PayFast amount does not match the order total'; END IF;
  SELECT * INTO v_log FROM public.payfast_itn_log WHERE pf_payment_id=p_pf_payment_id FOR UPDATE;
  IF FOUND THEN
    IF v_log.order_id IS DISTINCT FROM p_order_id THEN RAISE EXCEPTION 'Payment ID belongs to another order'; END IF;
    IF v_log.payment_status='COMPLETE' THEN RETURN jsonb_build_object('duplicate',true,'applied',false); END IF;
  END IF;
  IF coalesce(p_raw_payload->>'amount_fee','') ~ '^-?[0-9]+([.][0-9]+)?$' THEN
    v_fee:=abs((p_raw_payload->>'amount_fee')::numeric);
  END IF;
  INSERT INTO public.payfast_itn_log(pf_payment_id,order_id,m_payment_id,amount_gross,payment_status,raw_payload,processor_fee)
    VALUES(p_pf_payment_id,p_order_id,p_m_payment_id,p_amount_gross,p_payment_status,coalesce(p_raw_payload,'{}'::jsonb),v_fee)
    ON CONFLICT(pf_payment_id) DO UPDATE SET payment_status=excluded.payment_status,
      raw_payload=excluded.raw_payload,amount_gross=excluded.amount_gross,
      processor_fee=excluded.processor_fee,processed_at=now()
      WHERE public.payfast_itn_log.order_id=excluded.order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment ID belongs to another order'; END IF;
  IF p_payment_status<>'COMPLETE' THEN
    RETURN jsonb_build_object('duplicate',false,'applied',false,'reason','not_complete');
  END IF;
  IF v_order.status NOT IN ('pending_payment','payment_submitted') THEN
    RETURN jsonb_build_object('duplicate',false,'applied',false,'reason','not_eligible','current_status',v_order.status);
  END IF;
  UPDATE public.orders SET status='confirmed' WHERE id=p_order_id;
  UPDATE public.order_suborders SET status='confirmed',payment_status='paid' WHERE order_id=p_order_id;
  IF v_order.customer_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,type,title,body,action_url)
      VALUES(v_order.customer_id,'payment_confirmed','Payment confirmed',
        format('Your payment for %s has been verified.',v_order.ticket_number),'/orders/'||p_order_id::text);
  END IF;
  FOR v_sub IN SELECT so.subtotal,v.owner_id,v.name FROM public.order_suborders so
    JOIN public.vendors v ON v.id=so.vendor_id WHERE so.order_id=p_order_id
  LOOP
    IF v_sub.owner_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,type,title,body,action_url)
        VALUES(v_sub.owner_id,'new_order','New paid order '||v_order.ticket_number,
          format('%s: R%s for %s',v_sub.name,v_sub.subtotal,to_char(v_order.delivery_date,'DD Mon YYYY')),'/vendor/orders');
    END IF;
  END LOOP;
  RETURN jsonb_build_object('duplicate',false,'applied',true,
    'order',(SELECT public.order_to_json(o) FROM public.orders o WHERE o.id=p_order_id));
END $function$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('get_financial_report','get_payout_ledger','admin_record_historical_commission','admin_preview_test_order','admin_classify_test_order','admin_set_fee_policy','admin_allocate_payout','admin_reconcile_payout')
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f.signature); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature); END LOOP;
END $$;
-- Protect financial item snapshots while allowing meal_id to become NULL on catalogue deletion.
ALTER TABLE public.order_suborders ADD CONSTRAINT commission_snapshot_rate_range CHECK(commission_rate_snapshot BETWEEN 0 AND 1);
CREATE FUNCTION private.guard_paid_item_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.order_suborders WHERE id=OLD.suborder_id AND payment_status='paid') AND
 (NEW.suborder_id IS DISTINCT FROM OLD.suborder_id OR NEW.meal_name IS DISTINCT FROM OLD.meal_name OR NEW.qty IS DISTINCT FROM OLD.qty OR NEW.price IS DISTINCT FROM OLD.price OR NEW.category_snapshot IS DISTINCT FROM OLD.category_snapshot)
 THEN RAISE EXCEPTION 'Paid order item history is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_paid_item_history BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION private.guard_paid_item_history();
REVOKE ALL ON FUNCTION public.confirm_payfast_payment(uuid,text,text,numeric,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payfast_payment(uuid,text,text,numeric,text,jsonb) TO service_role;
-- Compatibility RPCs delegate to the same paid business ledger. Integer periods use inclusive SAST days.
CREATE OR REPLACE FUNCTION public.get_admin_platform_analytics(p_days integer DEFAULT 28) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; today date:=(now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
 IF p_days IS NULL OR p_days<1 OR p_days>366 THEN RAISE EXCEPTION 'Invalid period'; END IF;
 r:=public.get_financial_report(NULL,today-p_days+1,today); RETURN r||(r->'totals');
END $$;
CREATE OR REPLACE FUNCTION public.get_admin_category_demand(p_days integer DEFAULT 28) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN public.get_admin_platform_analytics(p_days)->'categories'; END $$;
CREATE OR REPLACE FUNCTION public.get_vendor_analytics(p_vendor_id uuid,p_days integer DEFAULT 30) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; t jsonb; today date:=(now() AT TIME ZONE 'Africa/Johannesburg')::date;
BEGIN
 IF p_days IS NULL OR p_days<1 OR p_days>366 THEN RAISE EXCEPTION 'Invalid period'; END IF;
 IF NOT private.is_admin() AND NOT EXISTS(SELECT 1 FROM public.vendors WHERE id=p_vendor_id AND analytics_enabled) THEN RAISE EXCEPTION 'Growth analytics not enabled'; END IF;
 r:=public.get_financial_report(p_vendor_id,today-p_days+1,today); t:=r->'totals';
 RETURN r||t||jsonb_build_object('orders',t->'suborders','grossRevenue',t->'gmv','platformCommission',t->'grossCommission','vendorNet',t->'vendorEarnings','periodFrom',r->'from','periodTo',r->'to');
END $$;
CREATE OR REPLACE FUNCTION public.get_vendor_dashboard_stats(p_vendor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE today date:=(now() AT TIME ZONE 'Africa/Johannesburg')::date; alltime jsonb; d jsonb; w jsonb; m jsonb; counts jsonb; chart jsonb;
BEGIN
 IF p_vendor_id IS NULL THEN RAISE EXCEPTION 'Vendor required'; END IF;
 alltime:=public.get_financial_report(p_vendor_id,NULL,NULL);
 d:=public.get_financial_report(p_vendor_id,today,today)->'totals';
 w:=public.get_financial_report(p_vendor_id,date_trunc('week',today::timestamp)::date,today)->'totals';
 m:=public.get_financial_report(p_vendor_id,date_trunc('month',today::timestamp)::date,today)->'totals';
 SELECT jsonb_build_object('todaysOrders',count(*) FILTER(WHERE (o.created_at AT TIME ZONE 'Africa/Johannesburg')::date=today),'pendingOrders',count(*) FILTER(WHERE s.status='pending_payment'),'confirmedOrders',count(*) FILTER(WHERE s.status IN('confirmed','accepted')),'preparingOrders',count(*) FILTER(WHERE s.status='preparing'),'readyOrders',count(*) FILTER(WHERE s.status='ready'),'deliveredOrders',count(*) FILTER(WHERE s.status IN('collected','completed')),'totalOrders',count(*)) INTO counts FROM public.order_suborders s JOIN public.orders o ON o.id=s.order_id WHERE s.vendor_id=p_vendor_id AND NOT o.is_test;
 SELECT jsonb_agg(jsonb_build_object('day',x.financial_day,'revenue',x.revenue) ORDER BY x.financial_day) INTO chart FROM(SELECT financial_date AS financial_day,sum(gross) revenue FROM private.financial_sales WHERE vendor_id=p_vendor_id AND financial_date BETWEEN today-6 AND today GROUP BY financial_date) x;
 RETURN counts||jsonb_build_object('todaysRevenue',d->'gmv','weeklyRevenue',w->'gmv','monthlyRevenue',m->'gmv','monthlyCommission',m->'grossCommission','monthlyVendorEarnings',m->'vendorEarnings','averageOrderValue',m->'averageOrderValue','revenueChart',coalesce(chart,'[]'::jsonb),'timezone','Africa/Johannesburg');
END $$;
REVOKE ALL ON FUNCTION public.get_admin_platform_analytics(integer),public.get_admin_category_demand(integer),public.get_vendor_analytics(uuid,integer),public.get_vendor_dashboard_stats(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_analytics(integer),public.get_admin_category_demand(integer),public.get_vendor_analytics(uuid,integer),public.get_vendor_dashboard_stats(uuid) TO authenticated;
