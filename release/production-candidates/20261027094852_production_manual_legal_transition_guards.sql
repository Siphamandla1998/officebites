-- LOCAL REVIEW CANDIDATE ONLY, AFTER reconciled manual foundations and B/C/D/E.
-- Not standalone, not a production installer. No rows or activation flags changed.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $prerequisites$
BEGIN
 IF current_user<>'postgres' OR to_regprocedure('private.vendor_activation_ready(uuid,uuid)') IS NULL
 OR to_regclass('private.vendor_compliance_events') IS NULL OR to_regclass('private.order_legal_acceptances') IS NULL
 THEN RAISE EXCEPTION 'Reviewed manual payment and B/C/D/E prerequisites required'; END IF;
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled)
 OR EXISTS(SELECT 1 FROM private.commercial_settings WHERE customer_legal_enabled OR vendor_clickwrap_enabled OR legal_publication_enabled OR acquisition_enabled)
 THEN RAISE EXCEPTION 'Closed payment/legal installation state required; do not change flags to bypass review'; END IF;
END $prerequisites$;

-- Existing accounts/statuses are preserved. NEW manual checkout is subject to the
-- same current evidence for every vendor; a legacy exception is not EFT eligibility.
CREATE FUNCTION private.vendor_launch_ready(p_vendor uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE owner uuid;
BEGIN
 IF NOT coalesce((SELECT customer_legal_enabled FROM private.commercial_settings WHERE singleton),false)
 OR NOT EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=p_vendor)
 THEN RETURN false; END IF;
 SELECT owner_id INTO owner FROM public.vendors WHERE id=p_vendor AND status='approved' AND archived_at IS NULL;
 RETURN coalesce(owner IS NOT NULL AND private.vendor_activation_ready(p_vendor,owner),false);
EXCEPTION WHEN SQLSTATE '40001' THEN RETURN false;
END $body$;
REVOKE ALL ON FUNCTION private.vendor_launch_ready(uuid) FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.get_vendor_manual_methods(uuid) RENAME TO get_vendor_manual_methods_before_launch_gate;
REVOKE ALL ON FUNCTION public.get_vendor_manual_methods_before_launch_gate(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.get_vendor_manual_methods(p_vendor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
 IF NOT private.vendor_launch_ready(p_vendor_id) THEN RETURN '{}'::jsonb; END IF;
 RETURN public.get_vendor_manual_methods_before_launch_gate(p_vendor_id);
END $body$;
REVOKE ALL ON FUNCTION public.get_vendor_manual_methods(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_manual_methods(uuid) TO anon,authenticated;

ALTER FUNCTION public.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid) RENAME TO create_manual_order_before_launch_gate;
REVOKE ALL ON FUNCTION public.create_manual_order_before_launch_gate(uuid,text,text,text,date,text,jsonb,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.create_manual_order(p_customer_id uuid,p_guest_name text,p_guest_contact text,p_guest_email text,p_delivery_date date,p_delivery_location text,p_items jsonb,p_quote_id uuid,p_method text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE vendor uuid;
BEGIN
 IF p_request_id IS NULL OR p_customer_id IS DISTINCT FROM auth.uid()
 OR (auth.uid() IS NOT NULL AND NOT private.active_account()) THEN RAISE EXCEPTION 'Checkout identity and request key required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 -- Original payload/identity validation remains authoritative for recovery.
 IF NOT EXISTS(SELECT 1 FROM private.manual_order_payments WHERE request_id=p_request_id) THEN
  IF p_quote_id IS NOT NULL OR p_method IS NULL OR p_method NOT IN('manual_eft','manual_payshap') THEN RAISE EXCEPTION 'Only reviewed manual EFT/PayShap checkout is available'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Cart required'; END IF;
  IF (SELECT count(DISTINCT m.vendor_id) FROM jsonb_array_elements(p_items) x JOIN public.meals m ON m.id=(x->>'mealId')::uuid)<>1 THEN RAISE EXCEPTION 'One vendor per checkout required'; END IF;
  SELECT m.vendor_id INTO vendor FROM jsonb_array_elements(p_items) x JOIN public.meals m ON m.id=(x->>'mealId')::uuid LIMIT 1;
  -- Match E: request -> vendor SHARE -> commercial lock. Do not upgrade SHARE
  -- to UPDATE during checkout; concurrent customers must not deadlock on upgrade.
  PERFORM 1 FROM public.vendors WHERE id=vendor FOR SHARE;
  IF NOT private.vendor_launch_ready(vendor) THEN RAISE EXCEPTION 'Vendor legal/compliance transition review required; new manual orders unavailable'; END IF;
 END IF;
 RETURN public.create_manual_order_before_launch_gate(p_customer_id,p_guest_name,p_guest_contact,p_guest_email,p_delivery_date,p_delivery_location,p_items,p_quote_id,p_method,p_request_id);
END $body$;
REVOKE ALL ON FUNCTION public.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid) TO anon,authenticated;

-- Even a definer legal wrapper must not call excluded creation paths.
ALTER FUNCTION private.create_order_with_legal(jsonb,jsonb) RENAME TO create_order_with_legal_before_launch_gate;
REVOKE ALL ON FUNCTION private.create_order_with_legal_before_launch_gate(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION private.create_order_with_legal(p_order jsonb,p_legal jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
 IF p_order ? 'p_window_id' OR nullif(p_order->>'p_quote_id','') IS NOT NULL
 OR p_order->>'p_method' IS NULL OR p_order->>'p_method' NOT IN('manual_eft','manual_payshap')
 THEN RAISE EXCEPTION 'Only reviewed manual EFT/PayShap checkout is available'; END IF;
 RETURN private.create_order_with_legal_before_launch_gate(p_order,p_legal);
END $body$;
CREATE OR REPLACE FUNCTION public.create_order_with_legal(p_order jsonb,p_legal jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $body$ SELECT private.create_order_with_legal(p_order,p_legal) $body$;
REVOKE ALL ON FUNCTION private.create_order_with_legal(jsonb,jsonb),public.create_order_with_legal(jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.create_order_with_legal(jsonb,jsonb),public.create_order_with_legal(jsonb,jsonb) TO anon,authenticated;

-- Commit-time enforcement closes the legacy admin_verify_payment/direct paid
-- transition bypass while permitting the verified-receipt RPC's atomic write order.
CREATE FUNCTION private.manual_paid_receipt_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
DECLARE m private.manual_order_payments%ROWTYPE;
BEGIN
 IF NEW.payment_status IS DISTINCT FROM 'paid' OR (TG_OP='UPDATE' AND OLD.payment_status='paid') THEN RETURN NULL; END IF;
 SELECT * INTO m FROM private.manual_order_payments WHERE order_id=NEW.order_id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF m.state<>'paid' OR m.verified_by IS NULL OR m.verified_at IS NULL OR m.verified_amount IS DISTINCT FROM m.amount
 OR nullif(btrim(m.bank_reference),'') IS NULL OR m.confirmation_source NOT IN('vendor_bank_receipt','admin_bank_receipt')
 OR m.confirmation_source IS NULL
 OR NOT EXISTS(SELECT 1 FROM private.manual_payment_events e WHERE e.order_id=m.order_id AND e.action='bank_receipt_verified' AND e.actor_id=m.verified_by)
 OR NOT EXISTS(SELECT 1 FROM private.manual_receivables r WHERE r.order_id=m.order_id AND r.vendor_id=m.vendor_id AND r.gross=m.amount)
 THEN RAISE EXCEPTION 'Independently verified bank receipt and atomic financial evidence required before paid'; END IF;
 RETURN NULL;
END $body$;
CREATE CONSTRAINT TRIGGER manual_paid_receipt_guard AFTER INSERT OR UPDATE ON public.order_suborders
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.manual_paid_receipt_guard();
REVOKE ALL ON FUNCTION private.manual_paid_receipt_guard() FROM PUBLIC,anon,authenticated,service_role;
-- Recheck wall-clock expiry at COMMIT as well as the immediate suborder gate.
-- Existing instructions/replays do not insert a row and remain recoverable.
CREATE FUNCTION private.manual_creation_readiness_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $body$
BEGIN
 IF NOT private.vendor_launch_ready(NEW.vendor_id) THEN
  RAISE EXCEPTION 'Vendor legal/compliance evidence expired or requires review before commit';
 END IF;
 RETURN NULL;
END $body$;
CREATE CONSTRAINT TRIGGER manual_creation_readiness_guard AFTER INSERT ON private.manual_order_payments
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.manual_creation_readiness_guard();
REVOKE ALL ON FUNCTION private.manual_creation_readiness_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON private.manual_payment_settings,private.vendor_payment_profiles,private.manual_order_payments,private.manual_payment_events,private.manual_receivables,private.manual_receivable_entries,private.manual_refund_events FROM PUBLIC,anon,authenticated,service_role;
-- No automatic enrollment, acceptance, bank approval, status change or payment activation.
COMMIT;

