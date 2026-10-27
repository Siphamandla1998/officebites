-- Staging-only preparation. Does not enable a gateway, sell a plan or backfill history.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$ BEGIN
 IF to_regclass('private.payment_attempts') IS NULL OR to_regprocedure('public.valid_sa_mobile(text,text)') IS NULL THEN
 RAISE EXCEPTION 'Install and verify checkout prerequisites first'; END IF;
END $$;
-- Preserve legacy methods; only add the new provider to older installations' constraint.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK(payment_method IN('manual_eft','payfast','ozow'));
CREATE TABLE private.ozow_attempts(
 id uuid PRIMARY KEY REFERENCES private.payment_attempts(id), order_id uuid NOT NULL REFERENCES public.orders(id),
 reference text NOT NULL UNIQUE, site_code text NOT NULL, environment text NOT NULL CHECK(environment IN('staging','production')),
 amount numeric(12,2) NOT NULL CHECK(amount>0), currency text NOT NULL DEFAULT 'ZAR' CHECK(currency='ZAR'),
 provider_payment_id uuid UNIQUE, redirect_url text, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '20 minutes', review_required boolean NOT NULL DEFAULT false
);
CREATE INDEX ozow_attempt_order ON private.ozow_attempts(order_id);
CREATE TABLE private.ozow_receipts(
 transaction_id uuid PRIMARY KEY, attempt_id uuid NOT NULL REFERENCES private.ozow_attempts(id),
 status text NOT NULL CHECK(status IN('Successful','Incomplete','Pending','Error','Refunded')),
 amount numeric(12,2) NOT NULL, currency text NOT NULL, site_code text NOT NULL, reference text NOT NULL,
 applied boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE private.ozow_deliveries(id text PRIMARY KEY,transaction_id uuid NOT NULL REFERENCES private.ozow_receipts(transaction_id),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE private.ozow_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.ozow_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.ozow_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.ozow_attempts,private.ozow_receipts,private.ozow_deliveries FROM PUBLIC,anon,authenticated;
-- Retain the audited ownership, active-account, fulfilment and gateway checks.
-- This copy is generated from this release's reviewed checkout preparation contract.
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.prepare_payfast_order(uuid,uuid,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'prepare_payfast_order','prepare_ozow_order_core');
 definition:=replace(definition,'public.prepare_ozow_order_core','private.prepare_ozow_order_core');
 definition:=replace(definition,'''payfast''','''ozow''');
 definition:=replace(definition,'PayFast','Ozow');
 EXECUTE definition;
END $$;
REVOKE ALL ON FUNCTION private.prepare_ozow_order_core(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.begin_ozow_attempt(p_order_id uuid,p_caller_id uuid,p_guest_contact text,p_site_code text,p_environment text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%rowtype; a uuid; prepared jsonb;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 IF p_environment NOT IN('staging','production') OR nullif(btrim(p_site_code),'') IS NULL THEN RAISE EXCEPTION 'Explicit provider configuration required'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 -- Never create another provider request after an ambiguous or outstanding attempt.
 IF EXISTS(SELECT 1 FROM private.payment_attempts WHERE order_id=p_order_id AND state NOT IN('failed_verified','cancelled_verified')) THEN RAISE EXCEPTION 'Payment requires reconciliation before retry'; END IF;
 prepared:=private.prepare_ozow_order_core(p_order_id,p_caller_id,p_guest_contact);
 SELECT id INTO a FROM private.payment_attempts WHERE order_id=p_order_id AND provider='ozow' ORDER BY created_at DESC LIMIT 1;
 INSERT INTO private.ozow_attempts(id,order_id,reference,site_code,environment,amount)
 VALUES(a,p_order_id,a::text,p_site_code,p_environment,o.total);
 RETURN (SELECT to_jsonb(x) FROM private.ozow_attempts x WHERE id=a);
END $$;
CREATE FUNCTION public.bind_ozow_payment(p_attempt_id uuid,p_payment_id uuid,p_redirect_url text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 IF p_payment_id IS NULL OR p_redirect_url !~ '^https://' THEN RAISE EXCEPTION 'Invalid hosted response'; END IF;
 UPDATE private.ozow_attempts SET provider_payment_id=p_payment_id,redirect_url=p_redirect_url WHERE id=p_attempt_id AND (provider_payment_id IS NULL OR provider_payment_id=p_payment_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt unavailable or already bound'; END IF;
 UPDATE private.payment_attempts SET state='pending' WHERE id=p_attempt_id AND state='issued';
END $$;
CREATE FUNCTION public.get_ozow_attempt(p_reference text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 RETURN (SELECT to_jsonb(a) FROM private.ozow_attempts a WHERE reference=p_reference);
END $$;
-- An issued Ozow attempt also blocks switching to PayFast. Original function is kept intact.
ALTER FUNCTION public.prepare_payfast_order(uuid,uuid,text) RENAME TO prepare_payfast_order_before_ozow;
ALTER FUNCTION public.prepare_payfast_order_before_ozow(uuid,uuid,text) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.prepare_payfast_order_before_ozow(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.prepare_payfast_order(p_order_id uuid,p_caller_id uuid,p_guest_contact text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM private.payment_attempts WHERE order_id=p_order_id AND provider='ozow' AND state NOT IN('failed_verified','cancelled_verified')) THEN RAISE EXCEPTION 'Ozow payment requires reconciliation'; END IF;
 RETURN private.prepare_payfast_order_before_ozow(p_order_id,p_caller_id,p_guest_contact);
END $$;
CREATE FUNCTION public.record_ozow_transaction(p_transaction jsonb,p_environment text,p_delivery_id text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a private.ozow_attempts%rowtype; o public.orders%rowtype; r private.ozow_receipts%rowtype; tx uuid; st text; sub record; applied boolean:=false;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 tx:=(p_transaction->>'id')::uuid; st:=p_transaction->>'status';
 SELECT * INTO a FROM private.ozow_attempts WHERE reference=p_transaction->>'merchantReference';
 IF NOT FOUND THEN RAISE EXCEPTION 'Unrecognised merchant reference'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=a.order_id FOR UPDATE;
 SELECT * INTO a FROM private.ozow_attempts WHERE id=a.id FOR UPDATE;
 IF p_environment IS DISTINCT FROM a.environment OR p_transaction->>'siteCode' IS DISTINCT FROM a.site_code OR
 p_transaction#>>'{amount,currency}' IS DISTINCT FROM a.currency OR (p_transaction#>>'{amount,value}')::numeric IS DISTINCT FROM a.amount OR
 st IS NULL OR st NOT IN('Successful','Incomplete','Pending','Error','Refunded') OR tx IS NULL THEN RAISE EXCEPTION 'Provider snapshot mismatch'; END IF;
 SELECT * INTO r FROM private.ozow_receipts WHERE transaction_id=tx FOR UPDATE;
 IF FOUND AND (r.attempt_id<>a.id OR r.amount<>a.amount OR r.currency<>a.currency OR r.reference<>a.reference OR r.site_code<>a.site_code) THEN RAISE EXCEPTION 'Transaction identity conflict'; END IF;
 -- Durable deduplication covers different Svix deliveries of the same provider transaction.
 INSERT INTO private.ozow_receipts(transaction_id,attempt_id,status,amount,currency,site_code,reference)
 VALUES(tx,a.id,st,a.amount,a.currency,a.site_code,a.reference)
 ON CONFLICT(transaction_id) DO UPDATE SET status=excluded.status WHERE NOT private.ozow_receipts.applied;
 IF p_delivery_id IS NOT NULL THEN
  IF length(p_delivery_id)>200 OR length(p_delivery_id)=0 THEN RAISE EXCEPTION 'Invalid delivery identity'; END IF;
  INSERT INTO private.ozow_deliveries(id,transaction_id) VALUES(p_delivery_id,tx) ON CONFLICT DO NOTHING;
  IF EXISTS(SELECT 1 FROM private.ozow_deliveries WHERE id=p_delivery_id AND transaction_id<>tx) THEN RAISE EXCEPTION 'Delivery identity conflict'; END IF;
 END IF;
 IF r.applied THEN
  IF st<>'Successful' THEN UPDATE private.ozow_attempts SET review_required=true WHERE id=a.id; END IF;
  RETURN jsonb_build_object('duplicate',true,'applied',false,'reviewRequired',(SELECT review_required FROM private.ozow_attempts WHERE id=a.id));
 END IF;
 IF st='Successful' THEN
  PERFORM 1 FROM public.order_suborders WHERE order_id=o.id ORDER BY id FOR UPDATE;
  PERFORM 1 FROM public.vendors v JOIN public.order_suborders s ON s.vendor_id=v.id WHERE s.order_id=o.id FOR SHARE OF v;
  PERFORM 1 FROM public.profiles p JOIN public.vendors v ON v.owner_id=p.id JOIN public.order_suborders s ON s.vendor_id=v.id WHERE s.order_id=o.id FOR SHARE OF p;
  -- Late/second-provider/changed-price payments are retained for review, never silently applied.
  IF o.status='pending_payment' AND o.payment_method='ozow' AND o.total=a.amount AND
   EXISTS(SELECT 1 FROM public.order_suborders WHERE order_id=o.id) AND
   NOT EXISTS(SELECT 1 FROM public.order_suborders s LEFT JOIN public.vendors v ON v.id=s.vendor_id LEFT JOIN public.profiles p ON p.id=v.owner_id LEFT JOIN auth.users u ON u.id=p.id WHERE s.order_id=o.id AND (s.status<>'pending_payment' OR s.payment_status<>'unpaid' OR v.id IS NULL OR p.id IS NULL OR u.id IS NULL OR v.status<>'approved' OR v.archived_at IS NOT NULL OR p.suspended OR p.deleted_at IS NOT NULL)) AND
   NOT EXISTS(SELECT 1 FROM public.payfast_itn_log WHERE order_id=o.id AND payment_status='COMPLETE') THEN
   UPDATE public.orders SET status='confirmed' WHERE id=o.id;
   UPDATE public.order_suborders SET status='confirmed',payment_status='paid' WHERE order_id=o.id;
   UPDATE private.ozow_receipts SET applied=true WHERE transaction_id=tx;
   UPDATE private.payment_attempts SET state='paid' WHERE id=a.id;
   applied:=true;
   IF o.customer_id IS NOT NULL THEN INSERT INTO public.notifications(user_id,type,title,body,action_url) VALUES(o.customer_id,'payment_confirmed','Payment confirmed','Your payment has been verified.','/orders/'||o.id); END IF;
   FOR sub IN SELECT v.owner_id FROM public.order_suborders s JOIN public.vendors v ON v.id=s.vendor_id WHERE s.order_id=o.id LOOP
    INSERT INTO public.notifications(user_id,type,title,body,action_url) VALUES(sub.owner_id,'new_order','New paid order','A verified paid order is ready for review.','/vendor/orders');
   END LOOP;
  ELSE UPDATE private.ozow_attempts SET review_required=true WHERE id=a.id; END IF;
 ELSIF st IN('Error','Refunded') THEN
  -- A transaction failure does NOT prove the entire payment request is cancelled.
  UPDATE private.ozow_attempts SET review_required=true WHERE id=a.id;
 END IF;
 RETURN jsonb_build_object('duplicate',false,'applied',applied,'reviewRequired',(SELECT review_required FROM private.ozow_attempts WHERE id=a.id));
END $$;
-- Commercial catalogue stays empty. No existing vendor plan/tier or commission is changed.
CREATE TABLE private.subscription_plans(id text PRIMARY KEY,amount numeric(12,2) NOT NULL CHECK(amount>0),currency text NOT NULL CHECK(currency='ZAR'),duration_days integer NOT NULL CHECK(duration_days>0),benefits jsonb NOT NULL,refund_policy text NOT NULL CHECK(length(refund_policy)>0),enabled boolean NOT NULL DEFAULT false);
CREATE TABLE private.vendor_subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vendor_id uuid NOT NULL REFERENCES public.vendors(id),plan_id text NOT NULL REFERENCES private.subscription_plans(id),amount numeric(12,2) NOT NULL,currency text NOT NULL,duration_days integer NOT NULL,benefits jsonb NOT NULL,refund_policy text NOT NULL,payment_status text NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN('unpaid','paid')),approval_status text NOT NULL DEFAULT 'pending' CHECK(approval_status IN('pending','approved','rejected')),receipt_id text UNIQUE,paid_at timestamptz,approved_by uuid,approved_at timestamptz,expires_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX vendor_subscription_vendor ON private.vendor_subscriptions(vendor_id);
ALTER TABLE private.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.vendor_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.subscription_plans,private.vendor_subscriptions FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.request_vendor_subscription(p_vendor_id uuid,p_plan_id text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p private.subscription_plans%rowtype; result uuid;
BEGIN
 IF NOT private.active_account() OR NOT EXISTS(SELECT 1 FROM public.vendors WHERE id=p_vendor_id AND owner_id=auth.uid() AND status='approved' AND archived_at IS NULL) THEN RAISE EXCEPTION 'Active vendor owner required' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM private.subscription_plans WHERE id=p_plan_id AND enabled FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Billing is not enabled for this plan'; END IF;
 INSERT INTO private.vendor_subscriptions(vendor_id,plan_id,amount,currency,duration_days,benefits,refund_policy) VALUES(p_vendor_id,p.id,p.amount,p.currency,p.duration_days,p.benefits,p.refund_policy) RETURNING id INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.record_subscription_payment(p_subscription_id uuid,p_receipt_id text,p_amount numeric,p_currency text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.vendor_subscriptions%rowtype;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Verified payment service only' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM private.vendor_subscriptions WHERE id=p_subscription_id FOR UPDATE;
 IF NOT FOUND OR p_amount IS DISTINCT FROM s.amount OR p_currency IS DISTINCT FROM s.currency OR nullif(btrim(p_receipt_id),'') IS NULL THEN RAISE EXCEPTION 'Subscription receipt mismatch'; END IF;
 IF s.payment_status='paid' THEN IF s.receipt_id=p_receipt_id THEN RETURN; ELSE RAISE EXCEPTION 'Receipt already recorded'; END IF; END IF;
 UPDATE private.vendor_subscriptions SET payment_status='paid',receipt_id=p_receipt_id,paid_at=now() WHERE id=s.id;
 INSERT INTO private.business_audit(action,record_id,reason) VALUES('subscription_paid_pending_approval',s.id,'Server-verified receipt; no benefits activated');
END $$;
CREATE FUNCTION public.admin_decide_subscription(p_subscription_id uuid,p_approve boolean,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.vendor_subscriptions%rowtype;
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501'; END IF;
 IF p_approve IS NULL OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Decision reason required'; END IF;
 SELECT * INTO s FROM private.vendor_subscriptions WHERE id=p_subscription_id FOR UPDATE;
 IF NOT FOUND OR s.payment_status<>'paid' THEN RAISE EXCEPTION 'Verified payment required before decision'; END IF;
 IF s.approval_status<>'pending' THEN RAISE EXCEPTION 'Decision already recorded; use audited correction'; END IF;
 UPDATE private.vendor_subscriptions SET approval_status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,approved_by=auth.uid(),approved_at=now(),expires_at=CASE WHEN p_approve THEN now()+make_interval(days=>s.duration_days) ELSE NULL END WHERE id=s.id;
 INSERT INTO private.business_audit(actor_id,action,record_id,reason) VALUES(auth.uid(),'subscription_admin_decision',s.id,p_reason);
END $$;
CREATE FUNCTION public.get_vendor_subscription(p_vendor_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT private.active_account() OR NOT(private.is_admin() OR EXISTS(SELECT 1 FROM public.vendors WHERE id=p_vendor_id AND owner_id=auth.uid())) THEN RAISE EXCEPTION 'Vendor ownership required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('state',CASE WHEN s.payment_status='paid' AND s.approval_status='pending' THEN 'paid_pending_approval' ELSE s.approval_status END,'eligible',s.payment_status='paid' AND s.approval_status='approved' AND s.expires_at>now() AND v.status='approved' AND v.archived_at IS NULL AND NOT p.suspended AND p.deleted_at IS NULL)),'[]') FROM private.vendor_subscriptions s JOIN public.vendors v ON v.id=s.vendor_id JOIN public.profiles p ON p.id=v.owner_id WHERE s.vendor_id=p_vendor_id);
END $$;
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT oid::regprocedure signature,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN('begin_ozow_attempt','bind_ozow_payment','get_ozow_attempt','record_ozow_transaction','prepare_payfast_order','record_subscription_payment','request_vendor_subscription','admin_decide_subscription','get_vendor_subscription') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I',f.signature,CASE WHEN f.proname IN('request_vendor_subscription','admin_decide_subscription','get_vendor_subscription') THEN 'authenticated' ELSE 'service_role' END);
 END LOOP;
END $$;
-- Provider-neutral reporting does not invent processor fees. Unknown Ozow fees stay NULL.
CREATE VIEW private.provider_order_payments AS
 SELECT order_id,amount_gross,payment_status,processor_fee FROM public.payfast_itn_log
 UNION ALL SELECT a.order_id,r.amount,'COMPLETE'::text,NULL::numeric FROM private.ozow_receipts r JOIN private.ozow_attempts a ON a.id=r.attempt_id WHERE r.status='Successful';
REVOKE ALL ON private.provider_order_payments FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE VIEW private.financial_sales AS SELECT so.id suborder_id,so.order_id,so.vendor_id,o.ticket_number,so.status,so.subtotal gross,
 so.commission_rate_snapshot commission_rate,so.commission_amount commission,so.subtotal-so.commission_amount vendor_earnings,o.total order_total,
 coalesce(so.vendor_name_snapshot,v.name) vendor_name,(coalesce(so.paid_at,o.created_at) AT TIME ZONE 'Africa/Johannesburg')::date financial_date,
 CASE WHEN so.paid_at IS NULL THEN 'legacy_order_creation_date' ELSE 'paid_date' END date_basis,
 CASE WHEN f.unresolved>0 THEN NULL ELSE coalesce(f.fee,0) END order_fee
 FROM public.order_suborders so JOIN public.orders o ON o.id=so.order_id JOIN public.vendors v ON v.id=so.vendor_id
 LEFT JOIN(SELECT order_id,sum(processor_fee) fee,count(*) FILTER(WHERE processor_fee IS NULL) unresolved FROM private.provider_order_payments WHERE payment_status='COMPLETE' GROUP BY order_id) f ON f.order_id=o.id
 WHERE NOT o.is_test AND so.payment_status='paid' AND so.status IN('confirmed','accepted','preparing','ready','collected','completed')
 AND o.status IN('confirmed','accepted','preparing','ready','collected','completed');
REVOKE ALL ON private.financial_sales FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_financial_report(p_vendor_id uuid DEFAULT NULL::uuid, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r jsonb;
BEGIN IF auth.uid() IS NOT NULL AND NOT private.active_account() THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
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
  'unresolvedProcessorFees',count(*) FILTER(WHERE processor_fee IS NULL),'processorFees',CASE WHEN count(*) FILTER(WHERE processor_fee IS NULL)>0 THEN NULL ELSE coalesce(sum(processor_fee),0) END,'netMarketplaceRevenue',CASE WHEN count(*) FILTER(WHERE commission IS NULL OR processor_fee IS NULL)>0 THEN NULL ELSE CASE (SELECT fee_policy FROM private.finance_settings) WHEN 'platform_absorbs' THEN coalesce(sum(commission),0)-coalesce(sum(processor_fee),0) WHEN 'vendor_proportional' THEN coalesce(sum(commission),0) ELSE NULL END END,
  'averageOrderValue',coalesce(sum(gross)/nullif(count(DISTINCT order_id),0),0)) FROM sales),
 'categories',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY units DESC) FROM categories c),'[]'),
 'meals',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY units DESC) FROM meals m),'[]'),
 'weekly',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY week) FROM weeks w),'[]'),
 'topVendors',coalesce((SELECT jsonb_agg(to_jsonb(v) ORDER BY gmv DESC) FROM vendors v),'[]'),
 'reconciliation',CASE WHEN private.is_admin() THEN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM(
  SELECT s.order_id,o.ticket_number,o.total "recordedOrderTotal",o.delivery_fee "deliveryFee",sum(s.gross) "eligibleBusinessGross",
   (SELECT coalesce(sum(subtotal),0) FROM public.order_suborders WHERE order_id=s.order_id) "allSuborderGross",
   (SELECT coalesce(sum(amount_gross),0) FROM private.provider_order_payments WHERE order_id=s.order_id AND payment_status='COMPLETE') "recordedCompletePayments",
   (SELECT count(*) FROM private.provider_order_payments WHERE order_id=s.order_id AND payment_status='COMPLETE') "completePaymentCount",
   o.total-o.delivery_fee-(SELECT coalesce(sum(subtotal),0) FROM public.order_suborders WHERE order_id=s.order_id) "orderAmountDifference"
   FROM sales s JOIN public.orders o ON o.id=s.order_id GROUP BY s.order_id,o.id) x),'[]'::jsonb) ELSE '[]'::jsonb END,
 'from',p_from,'to',p_to,'timezone','Africa/Johannesburg','feePolicy',(SELECT fee_policy FROM private.finance_settings),
 'customers',(SELECT count(*) FROM public.profiles WHERE role='customer' AND NOT suspended),'activeVendors',(SELECT count(*) FROM public.vendors WHERE status='approved'),
 'pendingVendors',(SELECT count(*) FROM public.vendors WHERE status='pending'),
 'ordersToday',(SELECT count(*) FROM public.orders WHERE NOT is_test AND(created_at AT TIME ZONE 'Africa/Johannesburg')::date=(now() AT TIME ZONE 'Africa/Johannesburg')::date)) INTO r;
 RETURN r;
END $function$
;
COMMIT;
