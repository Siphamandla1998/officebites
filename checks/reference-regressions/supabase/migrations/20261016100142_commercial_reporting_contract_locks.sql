-- Preserve accepted terms; reporting is read-only and never allocates payouts.
CREATE FUNCTION private.lock_corporate_contract() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Retain corporate agreements; terminate instead'; END IF;
 IF OLD.accepted_at IS NOT NULL AND (NEW.account_id IS DISTINCT FROM OLD.account_id OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id OR NEW.document_id IS DISTINCT FROM OLD.document_id OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.terms IS DISTINCT FROM OLD.terms OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at OR NEW.accepted_by IS DISTINCT FROM OLD.accepted_by) THEN RAISE EXCEPTION 'Accepted corporate commercial terms are immutable; offer a new agreement';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER corporate_contract_lock BEFORE UPDATE OR DELETE ON private.corporate_agreements FOR EACH ROW EXECUTE FUNCTION private.lock_corporate_contract();
CREATE INDEX corporate_agreement_vendor ON private.corporate_agreements(vendor_id,status,ends_at);
CREATE INDEX acquisition_vendor_time ON private.acquisition_ledger(vendor_id,eligible_at);
CREATE INDEX corporate_attribution_agreement ON private.corporate_attributions(agreement_id);
CREATE INDEX commercial_refund_entry ON private.commercial_refund_adjustments(entry_id);

CREATE FUNCTION private.commercial_report(p_from date,p_to date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE is_admin boolean; vid uuid; result jsonb;
BEGIN
 SELECT role='admin',vendor_id INTO is_admin,vid FROM public.profiles WHERE id=auth.uid() AND NOT suspended AND deleted_at IS NULL;
 IF is_admin IS NOT TRUE AND (vid IS NULL OR NOT EXISTS(SELECT 1 FROM public.vendors WHERE id=vid AND owner_id=auth.uid())) THEN RAISE EXCEPTION 'Active administrator or vendor required'; END IF;
 IF p_from IS NOT NULL AND p_to IS NOT NULL AND (p_from>p_to OR p_to-p_from>366) THEN RAISE EXCEPTION 'Invalid report date range (maximum 366 days)'; END IF;
 WITH refunds AS (SELECT entry_id,sum(refunded_subtotal) refunded,sum(acquisition_credit) credit FROM private.commercial_refund_adjustments GROUP BY entry_id),
 scoped AS (
 SELECT l.*,o.customer_id,c.name corporate_name,coalesce(r.refunded,0) refunded_subtotal,coalesce(r.credit,0) acquisition_credit,
 t.disputed_at IS NOT NULL disputed,s.commission standard_combined,
 l.eligible_subtotal-coalesce(r.refunded,0) net_product,
 l.amount-coalesce(r.credit,0) acquisition_net
 FROM private.acquisition_ledger l JOIN public.orders o ON o.id=l.order_id
 JOIN private.corporate_accounts c ON c.id=l.account_id
 JOIN private.corporate_attributions t ON t.order_id=l.order_id AND t.vendor_id=l.vendor_id
 LEFT JOIN refunds r ON r.entry_id=l.id
 LEFT JOIN (SELECT order_id,vendor_id,sum(commission_amount) commission FROM public.order_suborders GROUP BY order_id,vendor_id) s ON s.order_id=l.order_id AND s.vendor_id=l.vendor_id
 WHERE (is_admin OR l.vendor_id=vid)
 AND (p_from IS NULL OR (l.eligible_at AT TIME ZONE 'Africa/Johannesburg')::date>=p_from)
 AND (p_to IS NULL OR (l.eligible_at AT TIME ZONE 'Africa/Johannesburg')::date<=p_to)
 )
 SELECT jsonb_build_object('from',p_from,'to',p_to,'timezone','Africa/Johannesburg','settlementReady',false,
 'rows',(SELECT coalesce(jsonb_agg(to_jsonb(x)-'customer_id' ORDER BY eligible_at,order_id),'[]') FROM scoped x),
 'totals',(SELECT jsonb_build_object('chargedOrders',count(*),'qualifyingOrders',count(*) FILTER(WHERE net_product>0 AND NOT disputed),'uniquePayingCustomers',count(DISTINCT customer_id) FILTER(WHERE net_product>0 AND NOT disputed),'productSubtotal',coalesce(sum(eligible_subtotal),0),'refundedProductSubtotal',coalesce(sum(refunded_subtotal),0),'acquisitionFees',coalesce(sum(amount),0),'acquisitionCredits',coalesce(sum(acquisition_credit),0),'netAcquisitionFees',coalesce(sum(acquisition_net),0),'providerExpenses',NULL,'tax',NULL) FROM scoped),
 'weekly',(SELECT coalesce(jsonb_agg(to_jsonb(w) ORDER BY week_start,vendor_id),'[]') FROM (SELECT account_id,vendor_id,agreement_id,week_start,count(*) charged_orders,count(*) FILTER(WHERE net_product>0 AND NOT disputed) qualifying_orders,count(DISTINCT customer_id) FILTER(WHERE net_product>0 AND NOT disputed) unique_paying_customers,sum(net_product) net_product_subtotal,sum(acquisition_net) net_acquisition_fee FROM scoped GROUP BY account_id,vendor_id,agreement_id,week_start) w),
 'standardFees',(SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY recorded_at,suborder_id),'[]') FROM private.standard_fee_ledger f JOIN public.order_suborders s ON s.id=f.suborder_id WHERE (is_admin OR s.vendor_id=vid) AND (p_from IS NULL OR (f.recorded_at AT TIME ZONE 'Africa/Johannesburg')::date>=p_from) AND (p_to IS NULL OR (f.recorded_at AT TIME ZONE 'Africa/Johannesburg')::date<=p_to))
 ) INTO result;
 RETURN result;
END $$;
CREATE FUNCTION public.get_commercial_report(p_from date DEFAULT NULL,p_to date DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.commercial_report(p_from,p_to) $$;
REVOKE ALL ON FUNCTION private.lock_corporate_contract(),private.commercial_report(date,date),public.get_commercial_report(date,date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.commercial_report(date,date),public.get_commercial_report(date,date) TO authenticated;
CREATE OR REPLACE FUNCTION private.record_acquisition(p_order uuid,p_vendor uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a private.corporate_agreements%ROWTYPE; o public.orders%ROWTYPE; eligible timestamptz; wk date; pos bigint; base numeric; result uuid; candidates integer;
BEGIN
 IF NOT (SELECT acquisition_enabled FROM private.commercial_settings) THEN RETURN NULL; END IF;
 -- A single lock also serializes acceptance, attribution disputes and eligibility.
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 SELECT id INTO result FROM private.acquisition_ledger WHERE order_id=p_order AND vendor_id=p_vendor;
 IF result IS NOT NULL THEN RETURN result; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order FOR SHARE;
 IF o.id IS NULL OR o.is_test OR o.status='cancelled' OR o.customer_id IS NULL THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.order_suborders WHERE order_id=p_order AND vendor_id=p_vendor)
 OR EXISTS(SELECT 1 FROM public.order_suborders WHERE order_id=p_order AND vendor_id=p_vendor AND (status<>'completed' OR payment_status<>'paid' OR commission_amount IS NULL)) THEN RETURN NULL; END IF;
 -- Membership must have been independently verified before ordering. Disputes suppress charging.
 IF EXISTS(SELECT 1 FROM private.corporate_attributions WHERE order_id=p_order AND vendor_id=p_vendor AND disputed_at IS NOT NULL) THEN RETURN NULL; END IF;
 eligible:=clock_timestamp();
 SELECT count(*) INTO candidates FROM private.corporate_agreements ag
 JOIN private.corporate_accounts c ON c.id=ag.account_id AND c.status='active'
 JOIN private.corporate_memberships m ON m.account_id=c.id AND m.customer_id=o.customer_id AND m.revoked_at IS NULL AND m.verified_at<=o.created_at
 WHERE ag.vendor_id=p_vendor AND ag.status='active' AND ag.accepted_at<=o.created_at AND ag.starts_at<=o.created_at AND ag.ends_at>eligible;
 IF candidates<>1 THEN RETURN NULL; END IF;
 SELECT ag.* INTO a FROM private.corporate_agreements ag JOIN private.corporate_accounts c ON c.id=ag.account_id AND c.status='active'
 JOIN private.corporate_memberships m ON m.account_id=c.id AND m.customer_id=o.customer_id AND m.revoked_at IS NULL AND m.verified_at<=o.created_at
 WHERE ag.vendor_id=p_vendor AND ag.status='active' AND ag.accepted_at<=o.created_at AND ag.starts_at<=o.created_at AND ag.ends_at>eligible;
 -- Unique monotonic eligibility timestamps under the lock prevent timestamp ties.
 -- The reporting order remains (eligible_at, order_id); no historical completion backdating.
 eligible:=greatest(eligible,coalesce((SELECT max(eligible_at)+interval '1 microsecond' FROM private.acquisition_ledger WHERE agreement_id=a.id AND vendor_id=p_vendor),eligible));
 IF eligible>=a.ends_at THEN RETURN NULL;END IF;
 IF EXISTS(SELECT 1 FROM private.corporate_attributions WHERE order_id=p_order AND vendor_id=p_vendor AND agreement_id<>a.id) THEN RETURN NULL; END IF;
 INSERT INTO private.corporate_attributions(order_id,vendor_id,agreement_id,verified_by,evidence)
 VALUES(p_order,p_vendor,a.id,a.accepted_by,'Server verified pre-order workplace membership and accepted active agreement') ON CONFLICT DO NOTHING;
 wk:=date_trunc('week',eligible AT TIME ZONE 'Africa/Johannesburg')::date;
 -- Refunded positions remain consumed: append-only accounting never reprices earlier orders.
 SELECT coalesce(max(position),0)+1 INTO pos FROM private.acquisition_ledger WHERE agreement_id=a.id AND vendor_id=p_vendor AND week_start=wk;
 SELECT sum(subtotal) INTO base FROM public.order_suborders WHERE order_id=p_order AND vendor_id=p_vendor;
 IF base<=0 THEN RETURN NULL; END IF;
 INSERT INTO private.acquisition_ledger(agreement_id,account_id,vendor_id,order_id,week_start,position,rate,eligible_subtotal,amount,eligible_at)
 VALUES(a.id,a.account_id,p_vendor,p_order,wk,pos,private.acquisition_rate(pos),base,round(base*private.acquisition_rate(pos),2),eligible) RETURNING id INTO result;
 RETURN result;
END $$;
