-- Phase E LOCAL CANDIDATE. No publication, acceptance rollout, payment or marketing activation.
BEGIN;
SET LOCAL lock_timeout='10s';
ALTER TABLE private.commercial_settings ADD COLUMN legal_publication_enabled boolean NOT NULL DEFAULT false,
 ADD COLUMN customer_legal_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE private.legal_versions DROP CONSTRAINT legal_versions_kind_check;
ALTER TABLE private.legal_versions ADD CONSTRAINT legal_versions_kind_check CHECK(kind IN
 ('terms','privacy','refund-policy','delivery','cookies','company-information','vendor-agreement','vendor-fees','vendor-standards'));
ALTER TABLE private.legal_versions ADD COLUMN approval_manifest jsonb;
CREATE FUNCTION private.legal_text_complete(p_text text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT length(trim(coalesce(p_text,'')))>=50 AND NOT (coalesce(p_text,'') ~* '(working (draft|revision)|internal disclosure draft|internal review only|not (approved )?for publication|remove before publish|publication controls|do not publish|publication blocker|pre-publication|\[[^]]*(verify|insert|confirm|approval|decision|placeholder|TBD)[^]]*\]|\[\s*\]|\m(TODO|TBD|TBC)\M|example\.(com|org)|test\.invalid|lorem ipsum|_{3,})')
$$;
CREATE OR REPLACE FUNCTION private.commercial_business_ready() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT NOT EXISTS(SELECT 1 FROM unnest(ARRAY['legalName','registrationNumber','tradingName','email','telephone','website',
 'businessAddress','legalNoticeAddress','vatTreatment','informationOfficer','informationOfficerContact','officeBearers','placeOfRegistration',
 'recordAccess','retentionReference','supportHours','transferDisclosure','disclosureApprovalReference']) k
 WHERE length(trim(coalesce(s.business->>k,'')))<3 OR s.business->>k ~* '(\[[^]]*\]|\m(TBD|TBC|TODO)\M|awaiting|placeholder|verify before)')
 AND s.business->>'vatStatus' IN('registered','not_registered')
 AND (s.business->>'vatStatus'<>'registered' OR (length(trim(coalesce(s.business->>'vatNumber','')))>5
 AND coalesce(s.business->>'vatEffectiveDate','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'))
 FROM private.commercial_settings s WHERE singleton),false)
$$;
CREATE FUNCTION private.legal_approval_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text;
BEGIN
 IF OLD.approved_at IS NOT NULL AND (NEW.approved_at IS DISTINCT FROM OLD.approved_at OR NEW.approved_by IS DISTINCT FROM OLD.approved_by OR NEW.approval_manifest IS DISTINCT FROM OLD.approval_manifest) THEN RAISE EXCEPTION 'Approved legal evidence is immutable'; END IF;
 IF OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL THEN
  PERFORM private.commercial_admin();
  IF NOT coalesce((SELECT legal_publication_enabled FROM private.commercial_settings WHERE singleton),false) THEN RAISE EXCEPTION 'Legal publication is release-disabled'; END IF;
  IF NOT private.active_account() OR NEW.created_by=auth.uid() OR NEW.approved_by IS DISTINCT FROM auth.uid()
   OR length(trim(NEW.title)) NOT BETWEEN 3 AND 200 OR NOT isfinite(NEW.effective_at) OR NOT private.commercial_business_ready() OR NOT private.legal_text_complete(NEW.title||E'\n'||NEW.content)
   OR NEW.content_hash IS DISTINCT FROM encode(sha256(convert_to(NEW.content,'UTF8')),'hex')
   OR length(trim(coalesce(NEW.approval_manifest->>'reference','')))<15
   OR NEW.approval_manifest->>'hash' IS DISTINCT FROM NEW.content_hash
   OR NEW.approval_manifest->>'kind' IS DISTINCT FROM NEW.kind THEN RAISE EXCEPTION 'Independent approval, complete text, exact hash and verified disclosures required'; END IF;
  FOREACH k IN ARRAY ARRAY['completeText','businessDisclosures','capabilities','consumerRights','feesAndVat','privacyAndStorage','notices','legalSignoff'] LOOP
   IF NEW.approval_manifest->'checks'->k IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Explicit approval checklist required: %',k; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER legal_approval_evidence BEFORE UPDATE ON private.legal_versions FOR EACH ROW EXECUTE FUNCTION private.legal_approval_guard();
ALTER FUNCTION private.commercial_admin_action(text,jsonb) RENAME TO commercial_admin_action_phase_d;
CREATE FUNCTION private.commercial_admin_action(p_action text,p_value jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d private.legal_versions%ROWTYPE; result jsonb;
BEGIN
 PERFORM private.commercial_admin(); IF NOT private.active_account() THEN RAISE EXCEPTION 'Active administrator required'; END IF;
 -- Match D's vendor -> legal lock order for scoped draft insertion/FK checks.
 IF p_action='document' AND nullif(p_value->>'vendor_id','') IS NOT NULL THEN
  PERFORM 1 FROM public.vendors WHERE id=(p_value->>'vendor_id')::uuid FOR SHARE;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 IF p_action='offer' THEN RAISE EXCEPTION 'Marketing offers disabled pending approved flat-period attribution and accounting'; END IF;
 IF p_action='approve_document' THEN
  SELECT * INTO STRICT d FROM private.legal_versions WHERE id=(p_value->>'id')::uuid FOR UPDATE;
  IF d.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Version already approved; reload evidence'; END IF;
  UPDATE private.legal_versions SET approved_at=clock_timestamp(),approved_by=auth.uid(),
   approval_manifest=jsonb_build_object('reference',p_value->>'approvalReference','hash',p_value->>'expectedHash','kind',d.kind,'checks',p_value->'checks','reviewer',auth.uid(),'reviewedAt',clock_timestamp(),'business',(SELECT business FROM private.commercial_settings WHERE singleton)) WHERE id=d.id RETURNING to_jsonb(legal_versions.*) INTO result;
  INSERT INTO private.commercial_audit(actor_id,action,record_id,before_value,after_value) VALUES(auth.uid(),'approve_document',d.id,to_jsonb(d),result);
  RETURN result;
 ELSIF p_action='document' THEN
  INSERT INTO private.legal_versions(kind,version,title,content,content_hash,effective_at,created_by,vendor_id)
  VALUES(p_value->>'kind',p_value->>'version',p_value->>'title',p_value->>'content',encode(sha256(convert_to(p_value->>'content','UTF8')),'hex'),(p_value->>'effective_at')::timestamptz,auth.uid(),nullif(p_value->>'vendor_id','')::uuid) RETURNING * INTO d;
  INSERT INTO private.commercial_audit(actor_id,action,record_id,after_value) VALUES(auth.uid(),'document',d.id,to_jsonb(d)); RETURN to_jsonb(d);
 ELSIF p_action='onboarding' AND coalesce((p_value->>'enabled')::boolean,false) AND NOT coalesce((SELECT legal_publication_enabled FROM private.commercial_settings),false) THEN
  RAISE EXCEPTION 'Legal acceptance rollout is release-disabled';
 END IF;
 RETURN private.commercial_admin_action_phase_d(p_action,p_value);
END $$;
-- SQL invoker wrapper must resolve the new function, not retain a pre-rename OID.
CREATE OR REPLACE FUNCTION public.admin_commercial_action(p_action text,p_value jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.commercial_admin_action(p_action,p_value) $$;
REVOKE ALL ON FUNCTION private.commercial_admin_action_phase_d(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.commercial_admin_action(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.commercial_admin_action(text,jsonb) TO authenticated;
-- Existing approved records are not rewritten. New publication cannot bypass the guard.
ALTER FUNCTION private.commercial_workspace() RENAME TO commercial_workspace_phase_d;
CREATE FUNCTION private.commercial_workspace() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT private.commercial_workspace_phase_d() || jsonb_build_object('publicationEnabled',(SELECT legal_publication_enabled FROM private.commercial_settings),'customerLegalEnabled',(SELECT customer_legal_enabled FROM private.commercial_settings))
$$;
CREATE OR REPLACE FUNCTION public.get_commercial_workspace() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.commercial_workspace() $$;
REVOKE ALL ON FUNCTION private.commercial_workspace_phase_d(),private.commercial_workspace() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.commercial_workspace() TO authenticated;

-- New CUSTOMER order evidence; reuse private.legal_versions. No duplicate vendor acceptance system.
CREATE TABLE private.order_legal_acceptances (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id), actor_id uuid REFERENCES public.profiles(id),
 is_guest boolean NOT NULL, documents jsonb NOT NULL, accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 acknowledgement text NOT NULL DEFAULT 'I agree to the Terms and have been given access to Privacy, Refunds, Delivery, Cookies and Company information. This does not consent to marketing or waive statutory rights.',
 CHECK(is_guest=(actor_id IS NULL))
);
ALTER TABLE private.order_legal_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.order_legal_acceptances FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER order_legal_immutable BEFORE UPDATE OR DELETE ON private.order_legal_acceptances FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
CREATE FUNCTION private.customer_legal_documents() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(kind,to_jsonb(d)),'{}') FROM (SELECT DISTINCT ON(kind) id,kind,version,title,content,content_hash,effective_at,created_at
 FROM private.legal_versions WHERE kind IN('terms','privacy','refund-policy','delivery','cookies','company-information')
 AND vendor_id IS NULL AND approved_at IS NOT NULL AND approval_manifest IS NOT NULL AND effective_at<=now()
 ORDER BY kind,effective_at DESC,created_at DESC,id DESC) d
$$;
CREATE FUNCTION private.customer_legal_state() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enabled',coalesce(s.customer_legal_enabled,false),'ready',coalesce(s.legal_publication_enabled,false) AND private.commercial_business_ready()
 AND (SELECT count(*)=6 FROM jsonb_object_keys(private.customer_legal_documents())),'documents',private.customer_legal_documents())
 FROM private.commercial_settings s WHERE singleton
$$;
CREATE FUNCTION public.get_customer_legal_state() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.customer_legal_state() $$;
CREATE FUNCTION private.order_legal_required() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF coalesce((SELECT customer_legal_enabled FROM private.commercial_settings WHERE singleton),false)
 AND NOT EXISTS(SELECT 1 FROM private.order_legal_acceptances WHERE order_id=NEW.id) THEN RAISE EXCEPTION 'Customer legal review required; refresh checkout'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER customer_legal_order_gate AFTER INSERT ON public.orders DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION private.order_legal_required();
CREATE FUNCTION private.create_order_with_legal(p_order jsonb,p_legal jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE state jsonb; docs jsonb; k text; result jsonb; existing uuid; request uuid:=(p_order->>'p_request_id')::uuid; receipt private.order_legal_acceptances%ROWTYPE;
BEGIN
 IF request IS NULL OR nullif(p_order->>'p_customer_id','')::uuid IS DISTINCT FROM auth.uid()
 OR (auth.uid() IS NOT NULL AND NOT private.active_account()) THEN RAISE EXCEPTION 'Checkout identity and request key required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(request::text,0));
 SELECT order_id INTO existing FROM private.manual_order_payments WHERE request_id=request;
 IF existing IS NULL THEN
  -- Avoid legal -> vendor inversion with D admin review and its new-order gate.
  PERFORM v.id FROM public.vendors v WHERE v.id IN(SELECT m.vendor_id FROM jsonb_array_elements(p_order->'p_items') x
   JOIN public.meals m ON m.id=(x->>'mealId')::uuid) ORDER BY v.id FOR SHARE;
  PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
  state:=private.customer_legal_state(); docs:=state->'documents';
  IF state->'enabled' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Customer legal acceptance is release-disabled'; END IF;
  IF state->'ready' IS DISTINCT FROM 'true'::jsonb OR p_legal->'acknowledged' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Complete approved documents and acknowledgement required'; END IF;
  FOR k IN SELECT jsonb_object_keys(docs) LOOP
   IF p_legal->'documents'->>k IS DISTINCT FROM docs->k->>'id' THEN RAISE EXCEPTION 'Legal version changed; reload and review again' USING ERRCODE='40001'; END IF;
  END LOOP;
 END IF;
 IF p_order ? 'p_window_id' THEN
  IF to_regprocedure('public.create_collection_order(uuid,text,text,jsonb,text,uuid,uuid,uuid,bigint,bigint)') IS NULL THEN RAISE EXCEPTION 'Collection is not installed or enabled'; END IF;
  EXECUTE 'SELECT public.create_collection_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)' INTO result USING
   nullif(p_order->>'p_customer_id','')::uuid,p_order->>'p_guest_name',p_order->>'p_guest_contact',p_order->'p_items',p_order->>'p_method',request,
   (p_order->>'p_window_id')::uuid,(p_order->>'p_destination_id')::uuid,(p_order->>'p_policy_revision')::bigint,(p_order->>'p_window_revision')::bigint;
 ELSE
  result:=public.create_manual_order(nullif(p_order->>'p_customer_id','')::uuid,p_order->>'p_guest_name',p_order->>'p_guest_contact',p_order->>'p_guest_email',
   (p_order->>'p_delivery_date')::date,p_order->>'p_delivery_location',p_order->'p_items',nullif(p_order->>'p_quote_id','')::uuid,p_order->>'p_method',request);
 END IF;
 IF existing IS NULL THEN
  INSERT INTO private.order_legal_acceptances(order_id,actor_id,is_guest,documents) VALUES((result->>'id')::uuid,auth.uid(),auth.uid() IS NULL,docs);
 END IF;
 SELECT * INTO receipt FROM private.order_legal_acceptances WHERE order_id=(result->>'id')::uuid;
 IF receipt.order_id IS NULL THEN RAISE EXCEPTION 'Existing order predates legal evidence; no retrospective acceptance'; END IF;
 RETURN result||jsonb_build_object('legalReceipt',to_jsonb(receipt));
END $$;
CREATE FUNCTION public.create_order_with_legal(p_order jsonb,p_legal jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.create_order_with_legal(p_order,p_legal) $$;
CREATE FUNCTION private.order_legal_receipt(p_order uuid,p_token uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT (EXISTS(SELECT 1 FROM public.orders WHERE id=p_order AND customer_id=auth.uid() AND private.active_account())
 OR (private.active_account() AND private.is_admin()) OR EXISTS(SELECT 1 FROM private.manual_order_payments WHERE order_id=p_order AND token=p_token)) THEN
 RAISE EXCEPTION 'Order owner or private order capability required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT to_jsonb(r) FROM private.order_legal_acceptances r WHERE order_id=p_order);
END $$;
CREATE FUNCTION public.get_order_legal_receipt(p_order uuid,p_token uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.order_legal_receipt(p_order,p_token) $$;
REVOKE ALL ON FUNCTION private.legal_text_complete(text),private.legal_approval_guard(),private.customer_legal_documents(),private.customer_legal_state(),
 public.get_customer_legal_state(),private.order_legal_required(),private.create_order_with_legal(jsonb,jsonb),public.create_order_with_legal(jsonb,jsonb),
 private.order_legal_receipt(uuid,uuid),public.get_order_legal_receipt(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.customer_legal_state(),public.get_customer_legal_state(),private.create_order_with_legal(jsonb,jsonb),public.create_order_with_legal(jsonb,jsonb),
 private.order_legal_receipt(uuid,uuid),public.get_order_legal_receipt(uuid,uuid) TO anon,authenticated;
COMMIT;