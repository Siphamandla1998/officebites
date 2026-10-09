-- Corrective migration only. Do not replay the installed launch migrations.
-- The PayFast-only product has no supported proof-upload flow.
CREATE OR REPLACE FUNCTION public.submit_payment_proof(p_order_id uuid,p_proof_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Manual payment proof is no longer supported. Use verified PayFast checkout.' USING ERRCODE='42501'; END $$;
REVOKE ALL ON FUNCTION public.submit_payment_proof(uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE INDEX IF NOT EXISTS payout_allocations_payout_id_idx ON public.payout_allocations(payout_id);
CREATE INDEX IF NOT EXISTS vendor_payouts_vendor_id_idx ON public.vendor_payouts(vendor_id);

-- InitPlans evaluate stable account predicates once per statement, retaining the
-- restrictive intersection with every existing ownership policy.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies
 WHERE (schemaname='public' AND policyname='active_account_access')
 OR (schemaname='storage' AND policyname='active_account_storage') LOOP
  EXECUTE format('ALTER POLICY %I ON %I.%I USING ((select auth.uid()) IS NULL OR (select private.active_account())) WITH CHECK ((select auth.uid()) IS NULL OR (select private.active_account()))',p.policyname,p.schemaname,p.tablename);
 END LOOP;
END $$;

CREATE FUNCTION private.removal_blockers(p_target uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH owned AS (SELECT id FROM public.vendors WHERE owner_id=p_target),
 related AS (SELECT o.* FROM public.orders o WHERE o.customer_id=p_target OR EXISTS(SELECT 1 FROM public.order_suborders s WHERE s.order_id=o.id AND s.vendor_id IN(SELECT id FROM owned))),
 obligations AS (
  SELECT 'Outstanding orders (including unpaid checkout attempts) require review or fulfilment.' message
  WHERE EXISTS(SELECT 1 FROM related WHERE status NOT IN('completed','cancelled'))
  OR EXISTS(SELECT 1 FROM public.order_suborders s JOIN related o ON o.id=s.order_id WHERE s.status NOT IN('completed','cancelled'))
  UNION ALL SELECT 'Vendor sales require resolved commission, fee policy and externally reconciled settlement.'
  WHERE EXISTS(SELECT 1 FROM public.order_suborders s JOIN public.orders o ON o.id=s.order_id
   WHERE s.vendor_id IN(SELECT id FROM owned) AND s.payment_status='paid' AND NOT o.is_test
   AND NOT EXISTS(SELECT 1 FROM public.payout_allocations a JOIN public.vendor_payouts p ON p.id=a.payout_id WHERE a.suborder_id=s.id AND a.released_at IS NULL AND p.status='paid'))
  UNION ALL SELECT 'An allocated payout is awaiting external reconciliation.'
  WHERE EXISTS(SELECT 1 FROM public.vendor_payouts WHERE vendor_id IN(SELECT id FROM owned) AND status='allocated')
  UNION ALL SELECT 'Cancelled paid orders require a documented refund or settlement decision before removal.'
  WHERE EXISTS(SELECT 1 FROM related o WHERE o.status='cancelled' AND EXISTS(SELECT 1 FROM public.payfast_itn_log l WHERE l.order_id=o.id AND l.payment_status='COMPLETE'))
 ) SELECT coalesce(jsonb_agg(message),'[]'::jsonb) FROM obligations;
$$;
REVOKE ALL ON FUNCTION private.removal_blockers(uuid) FROM PUBLIC,anon,authenticated;

-- Server-only preparation combines authority, availability and the write in one
-- transaction. Locks conflict with removal and profile/vendor suspension.
CREATE FUNCTION public.prepare_payfast_order(p_order_id uuid,p_caller_id uuid,p_guest_contact text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%rowtype;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
 IF p_caller_id IS NOT NULL THEN
  PERFORM 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=p_caller_id AND NOT p.suspended AND p.deleted_at IS NULL AND (p.role<>'vendor' OR EXISTS(SELECT 1 FROM public.vendors cv WHERE cv.id=p.vendor_id AND cv.owner_id=p.id AND cv.status<>'suspended' AND cv.archived_at IS NULL)) FOR SHARE OF p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active customer account required' USING ERRCODE='42501'; END IF;
 END IF;
 IF o.customer_id IS NOT NULL THEN
  IF p_caller_id IS DISTINCT FROM o.customer_id THEN RAISE EXCEPTION 'Order ownership required' USING ERRCODE='42501'; END IF;
 ELSIF nullif(btrim(p_guest_contact),'') IS NULL OR btrim(p_guest_contact) IS DISTINCT FROM btrim(o.guest_contact) THEN
  RAISE EXCEPTION 'Guest order verification failed' USING ERRCODE='42501';
 END IF;
 IF o.status<>'pending_payment' THEN RAISE EXCEPTION 'Order is not awaiting payment'; END IF;
 PERFORM 1 FROM public.vendors v JOIN public.order_suborders s ON s.vendor_id=v.id WHERE s.order_id=o.id FOR SHARE OF v;
 PERFORM 1 FROM public.profiles p JOIN public.vendors v ON v.owner_id=p.id JOIN public.order_suborders s ON s.vendor_id=v.id WHERE s.order_id=o.id FOR SHARE OF p;
 IF NOT EXISTS(SELECT 1 FROM public.order_suborders WHERE order_id=o.id) OR EXISTS(
  SELECT 1 FROM public.order_suborders s LEFT JOIN public.vendors v ON v.id=s.vendor_id
  LEFT JOIN public.profiles p ON p.id=v.owner_id LEFT JOIN auth.users u ON u.id=p.id
  WHERE s.order_id=o.id AND (v.id IS NULL OR v.status<>'approved' OR v.archived_at IS NOT NULL OR p.id IS NULL OR p.suspended OR p.deleted_at IS NOT NULL OR u.id IS NULL OR s.status<>'pending_payment')) THEN
  RAISE EXCEPTION 'A vendor cannot currently fulfil this order. Contact support before paying.' USING ERRCODE='42501';
 END IF;
 UPDATE public.orders SET payment_method='payfast' WHERE id=o.id;
 RETURN to_jsonb(o);
END $$;
REVOKE ALL ON FUNCTION public.prepare_payfast_order(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_payfast_order(uuid,uuid,text) TO service_role;

-- New orders queued behind a removal cannot bind to an archived account/vendor.
CREATE FUNCTION private.require_fulfilment_on_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='orders' THEN
  IF NEW.customer_id IS NOT NULL THEN
   PERFORM 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=NEW.customer_id AND NOT p.suspended AND p.deleted_at IS NULL FOR SHARE OF p;
   IF NOT FOUND THEN RAISE EXCEPTION 'Active customer account required'; END IF;
  END IF;
 ELSE
  PERFORM 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id JOIN auth.users u ON u.id=p.id
  WHERE v.id=NEW.vendor_id AND v.status='approved' AND v.archived_at IS NULL AND NOT p.suspended AND p.deleted_at IS NULL FOR SHARE OF v,p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active approved vendor required for fulfilment'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.require_fulfilment_on_insert() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER require_fulfilment BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.require_fulfilment_on_insert();
CREATE TRIGGER require_fulfilment BEFORE INSERT ON public.order_suborders FOR EACH ROW EXECUTE FUNCTION private.require_fulfilment_on_insert();

-- Verified ITNs continue through the existing confirmation contract. Flag later
-- inactivity for administrator review instead of rejecting a genuine receipt.
CREATE FUNCTION private.audit_inactive_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.payment_status='COMPLETE' AND (TG_OP='INSERT' OR OLD.payment_status IS DISTINCT FROM 'COMPLETE') AND (
  EXISTS(SELECT 1 FROM public.orders o LEFT JOIN public.profiles p ON p.id=o.customer_id LEFT JOIN auth.users u ON u.id=p.id WHERE o.id=NEW.order_id AND o.customer_id IS NOT NULL AND (p.id IS NULL OR p.suspended OR p.deleted_at IS NOT NULL OR u.id IS NULL))
  OR EXISTS(SELECT 1 FROM public.order_suborders s JOIN public.vendors v ON v.id=s.vendor_id LEFT JOIN public.profiles p ON p.id=v.owner_id LEFT JOIN auth.users u ON u.id=p.id WHERE s.order_id=NEW.order_id AND (v.status<>'approved' OR v.archived_at IS NOT NULL OR p.id IS NULL OR p.suspended OR p.deleted_at IS NOT NULL OR u.id IS NULL))) THEN
  INSERT INTO private.business_audit(action,record_id,reason,details) VALUES('inactive_account_payment_review',NEW.order_id,'Verified receipt received after account or vendor became unavailable',jsonb_build_object('receiptId',NEW.id,'paymentId',NEW.pf_payment_id));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.audit_inactive_payment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER audit_inactive_payment AFTER INSERT OR UPDATE ON public.payfast_itn_log FOR EACH ROW EXECUTE FUNCTION private.audit_inactive_payment();

CREATE FUNCTION public.admin_recent_payments(p_limit integer DEFAULT 20) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(x ORDER BY x.processed_at DESC),'[]') FROM (
  SELECT l.id,l.order_id,l.pf_payment_id,l.processed_at,l.amount_gross,o.ticket_number,
   EXISTS(SELECT 1 FROM private.business_audit a WHERE a.record_id=o.id AND a.action='inactive_account_payment_review') requires_review
  FROM public.payfast_itn_log l JOIN public.orders o ON o.id=l.order_id
  WHERE l.payment_status='COMPLETE' AND NOT o.is_test ORDER BY l.processed_at DESC LIMIT greatest(1,least(coalesce(p_limit,20),100))
 ) x);
END $$;
REVOKE ALL ON FUNCTION public.admin_recent_payments(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_recent_payments(integer) TO authenticated;

CREATE FUNCTION public.admin_customer_favourite_counts() RETURNS TABLE(profile_id uuid,favourite_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.id,count(f.meal_id) FROM public.profiles p LEFT JOIN public.favourites f ON f.profile_id=p.id
 WHERE p.role='customer' AND p.deleted_at IS NULL GROUP BY p.id;
END $$;
REVOKE ALL ON FUNCTION public.admin_customer_favourite_counts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_customer_favourite_counts() TO authenticated;

CREATE OR REPLACE FUNCTION private.account_removal_preview(p_actor uuid,p_kind text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; profile public.profiles%rowtype; r jsonb;
BEGIN
 IF auth.role()<>'service_role' AND p_actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Actor identity mismatch' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=p_actor AND p.role='admin' AND NOT p.suspended AND p.deleted_at IS NULL) THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
 IF p_kind='vendor' THEN SELECT owner_id INTO target FROM public.vendors WHERE id=p_id; ELSIF p_kind='customer' THEN target:=p_id; ELSE RAISE EXCEPTION 'Invalid removal kind'; END IF;
 IF target IS NULL THEN RAISE EXCEPTION 'Account owner not found; requires manual review'; END IF;
 SELECT * INTO STRICT profile FROM public.profiles WHERE id=target;
 IF target=p_actor THEN RAISE EXCEPTION 'Self-removal is prohibited'; END IF;
 IF profile.role='admin' AND (SELECT count(*) FROM public.profiles WHERE role='admin' AND NOT suspended AND deleted_at IS NULL)<=1 THEN RAISE EXCEPTION 'Cannot remove last active administrator'; END IF;
 IF profile.role='admin' OR(p_kind='customer' AND profile.role<>'customer') THEN RAISE EXCEPTION 'Use an account type matching the designated record'; END IF;
 r:=jsonb_build_object('kind',p_kind,'recordId',p_id,'userId',target,'name',profile.name,'confirmation',p_kind||':'||p_id::text,
  'vendors',(SELECT coalesce(jsonb_agg(id),'[]') FROM public.vendors WHERE owner_id=target),
  'orders',(SELECT count(*) FROM public.orders WHERE customer_id=target OR id IN(SELECT order_id FROM public.order_suborders WHERE vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target))),
  'suborders',(SELECT count(*) FROM public.order_suborders WHERE vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target)),
  'meals',(SELECT count(*) FROM public.meals WHERE vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target)),
  'conversations',(SELECT count(*) FROM public.conversations WHERE customer_id=target OR vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target)),
  'notifications',(SELECT count(*) FROM public.notifications WHERE user_id=target),
  'storage',(SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'name',name) ORDER BY bucket_id,name),'[]') FROM storage.objects
    WHERE owner_id=target::text OR owner=target OR (bucket_id IN('meal-images','vendor-images') AND split_part(name,'/',1) IN(SELECT id::text FROM public.vendors WHERE owner_id=target))),
  'financialHistory','Retained. Vendor records are archived; profiles are anonymised. Auth identity is deleted only after Storage cleanup.');
 r:=r||jsonb_build_object('blockers',private.removal_blockers(target));
 RETURN r||jsonb_build_object('fingerprint',md5(r::text));
END $$;

CREATE OR REPLACE FUNCTION public.prepare_account_removal(p_actor uuid,p_kind text,p_id uuid,p_fingerprint text,p_confirmation text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; target uuid; job uuid;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'Server only' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('officebites-account-removal'));
 -- Rare, destructive preparation takes conservative table locks before reading
 -- dependencies. Concurrent writes finish first or wait and recheck lifecycle.
 PERFORM set_config('lock_timeout','5s',true);
 LOCK TABLE public.orders,public.order_suborders,public.payfast_itn_log,
   public.vendor_payouts,public.payout_allocations,public.profiles,public.vendors
   IN SHARE ROW EXCLUSIVE MODE;
 r:=private.account_removal_preview(p_actor,p_kind,p_id); target:=(r->>'userId')::uuid;
 IF jsonb_array_length(r->'blockers')>0 THEN RAISE EXCEPTION 'Removal blocked: %',r->'blockers'; END IF;
 IF p_confirmation IS DISTINCT FROM r->>'confirmation' THEN RAISE EXCEPTION 'Confirmation does not match'; END IF;
 SELECT id INTO job FROM private.account_removal_jobs WHERE target_user_id=target AND actor_id=p_actor AND state='prepared' ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN
  UPDATE private.account_removal_jobs SET manifest=manifest||jsonb_build_object('storage',(SELECT coalesce(jsonb_agg(x),'[]') FROM(SELECT DISTINCT value x FROM jsonb_array_elements(manifest->'storage') UNION SELECT DISTINCT value x FROM jsonb_array_elements(r->'storage')) files)) WHERE id=job;
  RETURN jsonb_build_object('jobId',job,'manifest',(SELECT manifest FROM private.account_removal_jobs WHERE id=job));
 END IF;
 IF p_confirmation IS DISTINCT FROM r->>'confirmation' OR p_fingerprint IS DISTINCT FROM r->>'fingerprint' THEN RAISE EXCEPTION 'Dependencies changed or confirmation does not match; preview again'; END IF;
 PERFORM 1 FROM public.profiles WHERE id=target FOR UPDATE;
 UPDATE public.profiles SET suspended=true,deleted_at=now(),name='Removed account',email='removed-'||id::text||'@invalid.local',avatar_url=NULL,building=NULL WHERE id=target;
 UPDATE public.vendors SET archived_at=now(),status='suspended',featured=false,email=NULL,contact_number=NULL,address=NULL,building=NULL,latitude=NULL,longitude=NULL,logo=NULL,cover_image=NULL WHERE owner_id=target;
 UPDATE public.meals SET available=false,image='' WHERE vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target);
 UPDATE public.support_tickets SET requester_name='Removed account',requester_email=NULL,requester_contact=NULL,attachment_url=NULL,meta=meta-'attachment_path' WHERE requester_id=target;
 UPDATE public.conversations SET closed_at=coalesce(closed_at,now()) WHERE customer_id=target OR vendor_id IN(SELECT id FROM public.vendors WHERE owner_id=target);
 INSERT INTO private.account_removal_jobs(actor_id,target_user_id,kind,manifest) VALUES(p_actor,target,p_kind,r) RETURNING id INTO job;
 INSERT INTO private.business_audit(actor_id,action,record_id,reason,details) VALUES(p_actor,'prepare_account_removal',target,'Confirmed dependency preview',jsonb_build_object('jobId',job,'kind',p_kind));
 RETURN jsonb_build_object('jobId',job,'manifest',r);
END $$;
