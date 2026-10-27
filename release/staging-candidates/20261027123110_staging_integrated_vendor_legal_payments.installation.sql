-- LOCAL REVIEW ONLY. Captured staging foundation prerequisite; all rollout states must remain OFF.
BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s';

DO $staging_preimage$
DECLARE e record; actual text;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed application postgres executor required'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>54
 OR (SELECT md5(string_agg(version||':'||coalesce(name,''),E'\n' ORDER BY version)) FROM supabase_migrations.schema_migrations)<>'9befc9e98322a4517850501c61be9696'
 THEN RAISE EXCEPTION 'Staging 54-entry history changed; obtain a fresh preimage'; END IF;
 FOR e IN SELECT * FROM (VALUES ('private.active_account()','5bda4a148d4f52474014f31f90b49cdf'),
('private.create_order_core(uuid, text, text, text, date, text, jsonb)','d66dff3346ea0241a989a2c060227236'),
('private.create_order_with_delivery(uuid, text, text, text, date, text, jsonb, uuid)','36d73e384b63626498cbe054c1d5da31'),
('public.admin_manual_settings(boolean, boolean, integer, numeric, text)','7c0a398be18ece9e1940840fe692ea6c'),
('public.cancel_unpaid_order(uuid, text, text)','6a52338e78c097c55bb8721bbcf451fe'),
('public.create_manual_order(uuid, text, text, text, date, text, jsonb, uuid, text, uuid)','c4dc553530f2998f26e91475b7503a5e'),
('public.get_vendor_manual_methods(uuid)','52ac2c375a04a31aa46470456260c929'),
('public.order_to_json(orders)','1185d494ac41ab09d2b83f3e263582cd'),
('public.record_manual_refund_status(uuid, text, numeric, numeric, text)','7996f9c65a3cf770c3eb91f7a2b650a2'),
('public.verify_manual_payment(uuid, numeric, text, boolean)','c35b9e7c3fecb979f70c81cda16938cb'),
('public.handle_new_user()','086649c1a17a57fbcfde261ea7bdba6a'),
('public.guard_vendor_privileged_fields()','405aaa6295945413607a5413a8d965a3'),
('public.guard_profile_privileged_fields()','389319aa4e0b30ada46bc315e97afbad')) x(signature,hash) LOOP
  SELECT md5(pg_get_functiondef(to_regprocedure(e.signature))) INTO actual;
  IF actual IS DISTINCT FROM e.hash THEN RAISE EXCEPTION 'Staging function preimage changed: %',e.signature; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled)
 OR EXISTS(SELECT 1 FROM private.commercial_settings WHERE onboarding_enforced OR acquisition_enabled OR standard_breakdown_enabled)
 OR to_regclass('private.vendor_activation_requirements') IS NOT NULL
 OR to_regclass('private.vendor_legal_assignments') IS NOT NULL
 OR to_regclass('private.vendor_compliance_events') IS NOT NULL
 OR to_regclass('private.order_legal_acceptances') IS NOT NULL
 OR to_regprocedure('public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'Closed, pre-B-E staging prerequisites required; no flag change or partial-install retry'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','private') AND c.relkind IN('r','p','v') AND pg_get_userbyid(c.relowner)<>'postgres')
 THEN RAISE EXCEPTION 'Unexpected application object owner'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Existing managed Storage RLS required'; END IF;
END $staging_preimage$;
REVOKE TRUNCATE,TRIGGER,REFERENCES ON ALL TABLES IN SCHEMA public,private FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public,private REVOKE TRUNCATE,TRIGGER,REFERENCES ON TABLES FROM PUBLIC,anon,authenticated;

-- Source: 20261026073911_phase_b_vendor_security_activation.sql
-- Phase B LOCAL CANDIDATE. No publication, acceptance rollout or gateway activation.
-- Dependencies: legal_corporate_framework + vendor_direct_manual_payments.

SET LOCAL lock_timeout = '10s';

-- Browser row creation is not an onboarding API. SECURITY DEFINER signup and
-- become_vendor retain their existing contracts and execute as their DB owner.
REVOKE INSERT ON public.profiles, public.vendors FROM PUBLIC, anon, authenticated;
-- Column grants can survive a table-level REVOKE.
DO $$ DECLARE t text; cols text; BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','vendors'] LOOP
    SELECT string_agg(quote_ident(column_name), ',') INTO cols
    FROM information_schema.columns WHERE table_schema='public' AND table_name=t;
    EXECUTE format('REVOKE INSERT (%s) ON public.%I FROM PUBLIC, anon, authenticated', cols, t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS vendors_insert_admin_or_self ON public.vendors;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE requested_role public.user_role; vid uuid; business_name text; business_category text;
BEGIN
  -- Only the nonprivileged vendor application choice is honored. Unknown,
  -- malformed and privileged values become customer, without an enum cast.
  requested_role := CASE WHEN NEW.raw_user_meta_data->>'role' = 'vendor'
    THEN 'vendor'::public.user_role ELSE 'customer'::public.user_role END;
  INSERT INTO public.profiles(id,name,email,role,building)
  VALUES(NEW.id,coalesce(nullif(trim(NEW.raw_user_meta_data->>'name'),''),split_part(NEW.email,'@',1)),
    NEW.email,requested_role,nullif(trim(NEW.raw_user_meta_data->>'building'),''));
  IF requested_role = 'vendor' THEN
    business_name := nullif(trim(NEW.raw_user_meta_data->>'business_name'),'');
    business_category := nullif(trim(NEW.raw_user_meta_data->>'business_category'),'');
    IF business_name IS NULL OR business_category IS NULL THEN
      RAISE EXCEPTION 'Business name and category are required for vendor registration';
    END IF;
    INSERT INTO public.vendors(owner_id,name,category,building,status,email)
    VALUES(NEW.id,business_name,business_category,nullif(trim(NEW.raw_user_meta_data->>'building'),''),'pending',NEW.email)
    RETURNING id INTO vid;
    UPDATE public.profiles SET vendor_id=vid WHERE id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;

-- No backfill: existing vendors retain their status, negotiated rates and orders.
-- New vendors enroll automatically. Existing vendors need an explicitly reviewed
-- enrollment later; there is deliberately no browser enrollment/rollout API.
CREATE TABLE private.vendor_activation_requirements (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  required_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.vendor_activation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES private.vendor_activation_requirements(vendor_id),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  acceptance_id uuid NOT NULL REFERENCES private.vendor_legal_acceptances(id),
  payment_profile_id uuid NOT NULL REFERENCES private.vendor_payment_profiles(id),
  -- Private references to independently checked documents, not public uploads.
  compliance_reference text NOT NULL CHECK(length(trim(compliance_reference)) >= 15),
  compliance_valid_until timestamptz NOT NULL,
  schedules_reference text NOT NULL CHECK(length(trim(schedules_reference)) >= 15),
  -- Hash must match the fee/schedule version in the existing acceptance receipt.
  schedules_hash text NOT NULL CHECK(schedules_hash ~ '^[0-9a-f]{64}$'),
  reviewed_by uuid NOT NULL REFERENCES public.profiles(id),
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(compliance_valid_until > reviewed_at),
  CHECK(reviewed_by <> owner_id)
);
CREATE INDEX vendor_activation_review_latest ON private.vendor_activation_reviews(vendor_id,reviewed_at DESC,id DESC);
ALTER TABLE private.vendor_activation_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.vendor_activation_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.vendor_activation_requirements, private.vendor_activation_reviews
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER activation_requirements_immutable BEFORE UPDATE OR DELETE ON private.vendor_activation_requirements
  FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
CREATE TRIGGER activation_reviews_immutable BEFORE UPDATE OR DELETE ON private.vendor_activation_reviews
  FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();

CREATE FUNCTION private.vendor_activation_ready(p_vendor uuid, p_owner uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r private.vendor_activation_reviews%ROWTYPE; a private.vendor_legal_acceptances%ROWTYPE;
  docs jsonb; bank_id uuid;
BEGIN
  -- Share the legal publication/acceptance serialization lock. No client inputs
  -- can substitute actor, document bytes, banking approval or verification time.
  PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
  IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE p.id=p_owner AND p.role='vendor' AND p.vendor_id=p_vendor
      AND NOT p.suspended AND p.deleted_at IS NULL) THEN RETURN false; END IF;
  SELECT * INTO r FROM private.vendor_activation_reviews WHERE vendor_id=p_vendor
    ORDER BY reviewed_at DESC,id DESC LIMIT 1;
  IF r.id IS NULL OR r.owner_id IS DISTINCT FROM p_owner OR r.compliance_valid_until<=clock_timestamp()
    OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
      WHERE p.id=r.reviewed_by AND p.role='admin' AND NOT p.suspended AND p.deleted_at IS NULL)
  THEN RETURN false; END IF;
  SELECT * INTO a FROM private.vendor_legal_acceptances WHERE id=r.acceptance_id;
  IF a.vendor_id IS DISTINCT FROM p_vendor OR a.actor_id IS DISTINCT FROM p_owner
    OR a.method IS DISTINCT FROM 'authenticated'
    OR a.documents->'vendor-fees'->>'content_hash' IS DISTINCT FROM r.schedules_hash
  THEN RETURN false; END IF;
  docs := private.validate_vendor_consent(
    jsonb_build_object('vendor-agreement',a.documents->'vendor-agreement'->>'id',
      'vendor-fees',a.documents->'vendor-fees'->>'id',
      'privacy',a.documents->'privacy'->>'id','refund-policy',a.documents->'refund-policy'->>'id'),
    a.acknowledgements);
  IF docs IS DISTINCT FROM a.documents THEN RETURN false; END IF;
  SELECT id INTO bank_id FROM private.vendor_payment_profiles WHERE vendor_id=p_vendor
    AND approved_at IS NOT NULL AND approved_by IS NOT NULL
    AND approved_by<>p_owner AND approved_by<>submitted_by
    AND length(trim(verification_evidence))>=15
    ORDER BY approved_at DESC,id DESC LIMIT 1;
  RETURN coalesce(bank_id=r.payment_profile_id,false);
END $$;

CREATE FUNCTION private.guard_vendor_creation_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending'::public.vendor_status THEN
      RAISE EXCEPTION 'New vendors must start pending' USING ERRCODE='42501';
    END IF;
    IF auth.uid() IS NOT NULL AND NOT private.is_admin() THEN
      IF NEW.owner_id IS DISTINCT FROM auth.uid()
        OR NEW.featured IS DISTINCT FROM false OR NEW.rating IS DISTINCT FROM 0
        OR NEW.review_count IS DISTINCT FROM 0 OR NEW.subscription_tier IS DISTINCT FROM 'basic'
        OR NEW.plan::text IS DISTINCT FROM 'marketplace' OR NEW.commission_rate IS DISTINCT FROM 0.17
        OR NEW.analytics_enabled IS DISTINCT FROM false OR NEW.recommendations_enabled IS DISTINCT FROM false
        OR NEW.corporate_orders_enabled IS DISTINCT FROM false OR NEW.archived_at IS NOT NULL
      THEN RAISE EXCEPTION 'Untrusted vendor ownership or commercial values' USING ERRCODE='42501'; END IF;
    END IF;
  ELSE
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      INSERT INTO private.vendor_activation_requirements(vendor_id,owner_id)
      VALUES(NEW.id,NEW.owner_id) ON CONFLICT(vendor_id) DO NOTHING;
    END IF;
    IF NEW.status='approved' AND
    (OLD.status IS DISTINCT FROM NEW.status OR OLD.owner_id IS DISTINCT FROM NEW.owner_id) THEN
    -- Owner transfers always need a new review, including legacy vendors.
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id OR
      EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=NEW.id) THEN
      IF NOT private.vendor_activation_ready(NEW.id,NEW.owner_id) THEN
        RAISE EXCEPTION 'Vendor activation requires current agreement, compliance, approved banking and completed schedules'
          USING ERRCODE='42501';
      END IF;
    END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_vendor_creation_activation BEFORE INSERT OR UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION private.guard_vendor_creation_activation();
CREATE FUNCTION private.enroll_vendor_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO private.vendor_activation_requirements(vendor_id,owner_id) VALUES(NEW.id,NEW.owner_id);
  RETURN NEW;
END $$;
CREATE TRIGGER enroll_vendor_activation AFTER INSERT ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION private.enroll_vendor_activation();

-- Harden the existing acceptance API without enabling it or duplicating receipts.
CREATE OR REPLACE FUNCTION private.accept_vendor_legal(p_vendor uuid,p_documents jsonb,p_ack jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE docs jsonb; result uuid;
BEGIN
  IF NOT private.active_account() OR NOT EXISTS(
    SELECT 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id
    WHERE v.id=p_vendor AND v.owner_id=auth.uid() AND p.role='vendor' AND p.vendor_id=v.id
      AND NOT p.suspended AND p.deleted_at IS NULL AND v.archived_at IS NULL AND v.status IN ('pending','approved'))
  THEN RAISE EXCEPTION 'Active vendor owner required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
  docs:=private.validate_vendor_consent(p_documents,p_ack);
  SELECT id INTO result FROM private.vendor_legal_acceptances
    WHERE vendor_id=p_vendor AND actor_id=auth.uid() AND documents=docs AND method='authenticated'
    ORDER BY accepted_at DESC,id DESC LIMIT 1;
  IF result IS NULL THEN
    INSERT INTO private.vendor_legal_acceptances(vendor_id,actor_id,documents,acknowledgements,method)
    VALUES(p_vendor,auth.uid(),docs,p_ack,'authenticated') RETURNING id INTO result;
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.vendor_activation_ready(uuid,uuid),
  private.guard_vendor_creation_activation(),private.enroll_vendor_activation()
  FROM PUBLIC, anon, authenticated, service_role;
-- No grants, document inserts, gateway updates, rollout switches or account backfill.


-- Source: 20261026091408_phase_c_vendor_agreement_assignments.sql
-- Phase C LOCAL CANDIDATE. Depends on Phase B. No legal publication or rollout.

SET LOCAL lock_timeout='10s';
ALTER TABLE private.commercial_settings ADD COLUMN vendor_clickwrap_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE private.legal_versions ADD COLUMN vendor_id uuid REFERENCES public.vendors(id);
ALTER TABLE private.legal_versions DROP CONSTRAINT legal_versions_kind_check;
ALTER TABLE private.legal_versions ADD CONSTRAINT legal_versions_kind_check
 CHECK(kind IN ('terms','privacy','refund-policy','vendor-agreement','vendor-fees','vendor-standards'));
CREATE TRIGGER legal_scope_immutable BEFORE UPDATE OF vendor_id ON private.legal_versions
 FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
-- Scoped commercial documents must never leak through the public legal portal.
CREATE OR REPLACE FUNCTION private.commercial_documents() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(kind,to_jsonb(d)),'{}') FROM (
 SELECT DISTINCT ON(kind) id,kind,version,title,content,content_hash,effective_at,created_at
 FROM private.legal_versions WHERE vendor_id IS NULL AND kind<>'vendor-standards'
 AND approved_at IS NOT NULL AND effective_at<=now()
 ORDER BY kind,effective_at DESC,created_at DESC,id DESC) d
$$;

-- Assignment is approved routing/version metadata, never a second acceptance store.
CREATE TABLE private.vendor_legal_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 owner_id uuid NOT NULL REFERENCES public.profiles(id),
 agreement_id uuid NOT NULL REFERENCES private.legal_versions(id),
 schedule_id uuid NOT NULL REFERENCES private.legal_versions(id),
 standards_id uuid NOT NULL REFERENCES private.legal_versions(id),
 privacy_id uuid NOT NULL REFERENCES private.legal_versions(id),
 refunds_id uuid NOT NULL REFERENCES private.legal_versions(id),
 change_basis text NOT NULL CHECK(change_basis IN ('initial','material','urgent','informational')),
 approval_reference text NOT NULL CHECK(length(trim(approval_reference))>=15),
 notified_at timestamptz NOT NULL, effective_at timestamptz NOT NULL,
 approved_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(effective_at>=notified_at),
 CHECK(change_basis<>'material' OR effective_at>=notified_at+interval '30 days'),
 UNIQUE(vendor_id,owner_id,effective_at)
);
ALTER TABLE private.vendor_legal_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.vendor_legal_assignments FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER assignment_immutable BEFORE UPDATE OR DELETE ON private.vendor_legal_assignments
 FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
ALTER TABLE private.vendor_legal_acceptances
 ADD COLUMN assignment_id uuid REFERENCES private.vendor_legal_assignments(id),
 ADD COLUMN acknowledgement_text text,
 ADD COLUMN signer_name text;
CREATE UNIQUE INDEX vendor_assigned_receipt_unique ON private.vendor_legal_acceptances(assignment_id,actor_id)
 WHERE assignment_id IS NOT NULL;

CREATE FUNCTION private.vendor_assignment_documents(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a private.vendor_legal_assignments%ROWTYPE; docs jsonb;
BEGIN
 SELECT * INTO a FROM private.vendor_legal_assignments WHERE id=p_id;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Assignment unavailable' USING ERRCODE='40001'; END IF;
 SELECT jsonb_object_agg(d.kind,jsonb_build_object('id',d.id,'kind',d.kind,'version',d.version,
   'title',d.title,'content',d.content,'content_hash',d.content_hash,'effective_at',d.effective_at,'created_at',d.created_at)) INTO docs
 FROM private.legal_versions d JOIN (VALUES
 ('vendor-agreement',a.agreement_id),('vendor-fees',a.schedule_id),('vendor-standards',a.standards_id),
 ('privacy',a.privacy_id),('refund-policy',a.refunds_id)) expected(kind,id) ON d.id=expected.id AND d.kind=expected.kind
 WHERE d.approved_at IS NOT NULL AND d.effective_at<=a.effective_at
 AND (d.vendor_id IS NULL OR d.vendor_id=a.vendor_id)
 AND (d.kind<>'vendor-fees' OR d.vendor_id=a.vendor_id)
 AND d.content_hash=encode(sha256(convert_to(d.content,'UTF8')),'hex');
 IF docs IS NULL OR (SELECT count(*) FROM jsonb_object_keys(docs))<>5 THEN
   RAISE EXCEPTION 'Complete approved vendor-specific documents required' USING ERRCODE='40001';
 END IF;
 RETURN docs;
END $$;
CREATE FUNCTION private.guard_vendor_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
   WHERE p.id=NEW.approved_by AND p.role='admin' AND NOT p.suspended AND p.deleted_at IS NULL)
 OR NEW.approved_by=NEW.owner_id
 OR NOT EXISTS(SELECT 1 FROM public.vendors WHERE id=NEW.vendor_id AND owner_id=NEW.owner_id)
 THEN RAISE EXCEPTION 'Independent legal approval and vendor ownership required'; END IF;
 IF NEW.change_basis='informational' AND NOT EXISTS(SELECT 1 FROM private.vendor_legal_assignments
   WHERE vendor_id=NEW.vendor_id AND owner_id=NEW.owner_id AND change_basis<>'informational') THEN
   RAISE EXCEPTION 'Initial agreement must require acceptance'; END IF;
 IF NEW.change_basis='initial' AND EXISTS(SELECT 1 FROM private.vendor_legal_assignments
   WHERE vendor_id=NEW.vendor_id AND owner_id=NEW.owner_id) THEN
   RAISE EXCEPTION 'Classify the approved change and notice requirements'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assignment_review BEFORE INSERT ON private.vendor_legal_assignments
 FOR EACH ROW EXECUTE FUNCTION private.guard_vendor_assignment();
CREATE FUNCTION private.check_vendor_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.vendor_assignment_documents(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER assignment_documents AFTER INSERT ON private.vendor_legal_assignments
 FOR EACH ROW EXECUTE FUNCTION private.check_vendor_assignment();

CREATE FUNCTION private.agreement_vendor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE vid uuid;
BEGIN
 SELECT v.id INTO vid FROM public.profiles p JOIN public.vendors v ON v.id=p.vendor_id AND v.owner_id=p.id
 WHERE p.id=auth.uid() AND p.role='vendor' AND NOT p.suspended AND p.deleted_at IS NULL
 AND v.archived_at IS NULL AND v.status IN ('pending','approved') AND private.active_account();
 IF vid IS NULL THEN RAISE EXCEPTION 'Active vendor owner required' USING ERRCODE='42501'; END IF;
 RETURN vid;
END $$;
CREATE FUNCTION private.current_vendor_assignment(p_vendor uuid,p_owner uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE required_id uuid; latest_id uuid;
BEGIN
 SELECT id INTO latest_id FROM private.vendor_legal_assignments WHERE vendor_id=p_vendor AND owner_id=p_owner
 AND effective_at<=now() ORDER BY effective_at DESC,id DESC LIMIT 1;
 SELECT id INTO required_id FROM private.vendor_legal_assignments WHERE vendor_id=p_vendor AND owner_id=p_owner
 AND effective_at<=now() AND change_basis<>'informational' ORDER BY effective_at DESC,id DESC LIMIT 1;
 -- An informational update must never hide an outstanding material acceptance.
 IF required_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM private.vendor_legal_acceptances
   WHERE assignment_id=required_id AND actor_id=p_owner) THEN RETURN required_id; END IF;
 RETURN latest_id;
END $$;
CREATE FUNCTION private.vendor_agreement_state() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE vid uuid:=private.agreement_vendor(); a private.vendor_legal_assignments%ROWTYPE;
 docs jsonb; history jsonb; accepted boolean; required boolean;
BEGIN
 SELECT * INTO a FROM private.vendor_legal_assignments WHERE id=private.current_vendor_assignment(vid,auth.uid());
 IF a.id IS NOT NULL THEN
   BEGIN docs:=private.vendor_assignment_documents(a.id);
   EXCEPTION WHEN SQLSTATE '40001' THEN docs:=NULL; END;
 END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY accepted_at DESC,id DESC),'[]') INTO history
 FROM private.vendor_legal_acceptances r WHERE vendor_id=vid AND actor_id=auth.uid();
 accepted:=EXISTS(SELECT 1 FROM private.vendor_legal_acceptances WHERE assignment_id=a.id AND actor_id=auth.uid());
 required:=a.id IS NOT NULL AND NOT accepted AND (a.change_basis<>'informational' OR NOT EXISTS(
 SELECT 1 FROM private.vendor_legal_acceptances WHERE vendor_id=vid AND actor_id=auth.uid() AND assignment_id IS NOT NULL));
 RETURN jsonb_build_object('vendorId',vid,'vendorStatus',(SELECT status FROM public.vendors WHERE id=vid),
 'businessReady',EXISTS(SELECT 1 FROM private.commercial_settings) AND private.commercial_business_ready(),
 'enabled',coalesce((SELECT vendor_clickwrap_enabled FROM private.commercial_settings),false),
 'assignment',CASE WHEN a.id IS NOT NULL THEN jsonb_build_object('id',a.id,'effectiveAt',a.effective_at,
 'changeBasis',a.change_basis,'documents',docs) END,'requiresAcceptance',required,'accepted',accepted,'history',history,
 'upcoming',(SELECT jsonb_build_object('effectiveAt',effective_at,'changeBasis',change_basis) FROM private.vendor_legal_assignments
 WHERE vendor_id=vid AND owner_id=auth.uid() AND effective_at>now() ORDER BY effective_at LIMIT 1));
END $$;
CREATE FUNCTION public.get_vendor_agreement_state() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.vendor_agreement_state() $$;

CREATE FUNCTION private.accept_assigned_vendor_agreement(p_assignment uuid,p_acknowledged boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE vid uuid; a private.vendor_legal_assignments%ROWTYPE; docs jsonb; rid uuid;
BEGIN
 vid:=private.agreement_vendor();
 -- Lock ownership/account before the legal lock, matching activation's vendor-
 -- then-legal order. A concurrent transfer/suspension cannot change the signer
 -- association halfway through receipt creation.
 PERFORM 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id
 WHERE v.id=vid AND v.owner_id=auth.uid() AND p.vendor_id=vid
 FOR SHARE OF v,p;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active vendor owner required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 IF NOT coalesce((SELECT vendor_clickwrap_enabled FROM private.commercial_settings),false) THEN
   RAISE EXCEPTION 'Agreement acceptance is not yet available' USING ERRCODE='42501'; END IF;
 IF p_acknowledged IS DISTINCT FROM true THEN RAISE EXCEPTION 'Express acknowledgement required' USING ERRCODE='22023'; END IF;
 IF p_assignment IS DISTINCT FROM private.current_vendor_assignment(vid,auth.uid()) THEN
   RAISE EXCEPTION 'Agreement changed. Reload and review the current documents' USING ERRCODE='40001'; END IF;
 SELECT * INTO a FROM private.vendor_legal_assignments WHERE id=p_assignment;
 docs:=private.vendor_assignment_documents(a.id);
 IF NOT private.commercial_business_ready() THEN RAISE EXCEPTION 'Approved business disclosures required'; END IF;
 -- Return the original receipt on retries, including a lost HTTP response.
 SELECT id INTO rid FROM private.vendor_legal_acceptances WHERE assignment_id=a.id AND actor_id=auth.uid();
 IF rid IS NULL THEN
   IF a.change_basis='informational' AND EXISTS(SELECT 1 FROM private.vendor_legal_acceptances
     WHERE vendor_id=vid AND actor_id=auth.uid() AND assignment_id IS NOT NULL) THEN
     RAISE EXCEPTION 'This update does not require new acceptance'; END IF;
   INSERT INTO private.vendor_legal_acceptances(vendor_id,actor_id,documents,fee_version,acknowledgements,method,
     assignment_id,acknowledgement_text,signer_name)
   VALUES(vid,auth.uid(),docs,docs->'vendor-fees'->>'version','[true]','authenticated',a.id,
     'I have read, understand and agree to the Vendor Agreement, Commercial Fee Schedule and Vendor Operating Standards. I have reviewed Privacy and Refunds. I am authorised to accept on behalf of this vendor.',
     (SELECT name FROM public.profiles WHERE id=auth.uid())) RETURNING id INTO rid;
 END IF;
 RETURN (SELECT to_jsonb(r) FROM private.vendor_legal_acceptances r WHERE id=rid);
END $$;
CREATE FUNCTION public.accept_assigned_vendor_agreement(p_assignment uuid,p_acknowledged boolean) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.accept_assigned_vendor_agreement(p_assignment,p_acknowledged) $$;
-- Old evidence remains readable. No generic-document route may bypass assignment.
CREATE OR REPLACE FUNCTION private.accept_vendor_legal(p_vendor uuid,p_documents jsonb,p_ack jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Use the assigned vendor agreement review' USING ERRCODE='42501'; END $$;

-- Preserve every Phase B prerequisite. Only assigned-receipt validation changes.
ALTER FUNCTION private.vendor_activation_ready(uuid,uuid) RENAME TO vendor_activation_ready_phase_b;
CREATE FUNCTION private.vendor_activation_ready(p_vendor uuid,p_owner uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r private.vendor_activation_reviews%ROWTYPE; a private.vendor_legal_acceptances%ROWTYPE;
 current_a private.vendor_legal_assignments%ROWTYPE; bank_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 SELECT * INTO current_a FROM private.vendor_legal_assignments WHERE id=private.current_vendor_assignment(p_vendor,p_owner);
 SELECT * INTO r FROM private.vendor_activation_reviews WHERE vendor_id=p_vendor ORDER BY reviewed_at DESC,id DESC LIMIT 1;
 SELECT * INTO a FROM private.vendor_legal_acceptances WHERE id=r.acceptance_id;
 -- Enrolled vendors must have assigned, vendor-specific evidence. Legacy generic
 -- consent remains archived but cannot substitute for a Phase C contract.
 -- Unenrolled legacy vendors retain Phase B's existing trigger compatibility.
 IF a.assignment_id IS NULL THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.commercial_settings) OR NOT private.commercial_business_ready() OR current_a.id IS NULL OR (current_a.change_basis<>'informational' AND a.assignment_id<>current_a.id)
 OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
   WHERE p.id=p_owner AND p.role='vendor' AND p.vendor_id=p_vendor AND NOT p.suspended AND p.deleted_at IS NULL)
 OR r.owner_id IS DISTINCT FROM p_owner OR r.compliance_valid_until<=clock_timestamp()
 OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
   WHERE p.id=r.reviewed_by AND p.role='admin' AND NOT p.suspended AND p.deleted_at IS NULL)
 OR a.assignment_id IS DISTINCT FROM (SELECT id FROM private.vendor_legal_assignments WHERE vendor_id=p_vendor AND owner_id=p_owner
   AND effective_at<=now() AND change_basis<>'informational' ORDER BY effective_at DESC,id DESC LIMIT 1)
 OR a.vendor_id IS DISTINCT FROM p_vendor OR a.actor_id IS DISTINCT FROM p_owner OR a.method<>'authenticated'
 OR a.documents IS DISTINCT FROM private.vendor_assignment_documents(a.assignment_id)
 OR a.documents->'vendor-fees'->>'content_hash' IS DISTINCT FROM r.schedules_hash
 THEN RETURN false; END IF;
 SELECT id INTO bank_id FROM private.vendor_payment_profiles WHERE vendor_id=p_vendor
 AND approved_at IS NOT NULL AND approved_by IS NOT NULL AND approved_by<>p_owner AND approved_by<>submitted_by
 AND length(trim(verification_evidence))>=15 ORDER BY approved_at DESC,id DESC LIMIT 1;
 RETURN coalesce(bank_id=r.payment_profile_id,false);
END $$;
REVOKE ALL ON FUNCTION private.vendor_assignment_documents(uuid),private.guard_vendor_assignment(),private.check_vendor_assignment(),
 private.agreement_vendor(),private.current_vendor_assignment(uuid,uuid),private.vendor_activation_ready(uuid,uuid),
 private.vendor_activation_ready_phase_b(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.vendor_agreement_state(),public.get_vendor_agreement_state(),
 private.accept_assigned_vendor_agreement(uuid,boolean),public.accept_assigned_vendor_agreement(uuid,boolean)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.vendor_agreement_state(),public.get_vendor_agreement_state(),
 private.accept_assigned_vendor_agreement(uuid,boolean),public.accept_assigned_vendor_agreement(uuid,boolean) TO authenticated;
-- No assignments, legal text, review evidence or acceptances are inserted. Rollout stays OFF.


-- Source: 20261026101346_phase_d_vendor_compliance.sql
-- Phase D LOCAL CANDIDATE, after B/C. No rollout, legal publication or gateway changes.

SET LOCAL lock_timeout='10s';
CREATE TABLE private.vendor_compliance_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 owner_id uuid NOT NULL REFERENCES public.profiles(id), kind text NOT NULL CHECK(kind IN('identity','food_premises','coa','operations')),
 note text NOT NULL CHECK(length(trim(note)) BETWEEN 5 AND 1000),
 object_path text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.vendor_compliance_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 vendor_id uuid NOT NULL REFERENCES public.vendors(id), owner_id uuid NOT NULL REFERENCES public.profiles(id),
 kind text NOT NULL CHECK(kind IN('identity','food_premises','coa','operations','bank','assignment','administration')),
 subject_id uuid, status text NOT NULL CHECK(status IN('submitted','verified','rejected','revoked','not_required','assigned','reviewed','activated','suspended','enrolled','legacy_approved','pending')),
 actor_id uuid NOT NULL REFERENCES public.profiles(id), at timestamptz NOT NULL DEFAULT clock_timestamp(),
 valid_until timestamptz, reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 1000), snapshot jsonb NOT NULL DEFAULT '{}',
 transaction_id bigint NOT NULL DEFAULT txid_current(),
 CHECK(status NOT IN('verified','not_required') OR (valid_until IS NOT NULL AND valid_until>at)),
 CHECK(status<>'not_required' OR kind='coa')
);
CREATE INDEX compliance_event_latest ON private.vendor_compliance_events(vendor_id,owner_id,kind,sequence DESC);
ALTER TABLE private.vendor_activation_reviews ADD COLUMN compliance_event_ids jsonb NOT NULL DEFAULT '{}';
ALTER TABLE private.vendor_compliance_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.vendor_compliance_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.vendor_compliance_submissions,private.vendor_compliance_events FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE private.vendor_compliance_events_sequence_seq FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER compliance_submission_immutable BEFORE UPDATE OR DELETE ON private.vendor_compliance_submissions FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
CREATE TRIGGER compliance_events_immutable BEFORE UPDATE OR DELETE ON private.vendor_compliance_events FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();

CREATE FUNCTION private.compliance_access(p_vendor uuid,p_admin boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND private.active_account() AND
 (private.is_admin() OR (NOT p_admin AND EXISTS(SELECT 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id
 WHERE v.id=p_vendor AND v.owner_id=auth.uid() AND p.role='vendor' AND p.vendor_id=v.id
 AND v.status IN('pending','approved') AND v.archived_at IS NULL)))
$$;
CREATE FUNCTION private.compliance_storage_access(p_name text,p_write boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.vendor_compliance_submissions s JOIN public.vendors v ON v.id=s.vendor_id
 WHERE s.object_path=p_name AND private.compliance_access(s.vendor_id) AND
 (NOT p_write OR (s.owner_id=auth.uid() AND v.owner_id=auth.uid() AND NOT EXISTS(
 SELECT 1 FROM private.vendor_compliance_events e WHERE e.subject_id=s.id))))
$$;
CREATE FUNCTION private.reserve_vendor_evidence(p_kind text,p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE vid uuid:=private.agreement_vendor(); sid uuid:=gen_random_uuid(); path text;
BEGIN
 PERFORM 1 FROM public.vendors WHERE id=vid FOR UPDATE;
 path:=vid::text||'/'||sid::text||'/evidence';
 INSERT INTO private.vendor_compliance_submissions(id,vendor_id,owner_id,kind,note,object_path)
 VALUES(sid,vid,auth.uid(),p_kind,p_note,path);
 RETURN jsonb_build_object('id',sid,'path',path,'bucket','vendor-compliance');
END $$;
CREATE FUNCTION public.reserve_vendor_evidence(p_kind text,p_note text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.reserve_vendor_evidence(p_kind,p_note) $$;
CREATE FUNCTION private.finalize_vendor_evidence(p_submission uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.vendor_compliance_submissions%ROWTYPE; o storage.objects%ROWTYPE;
BEGIN
 SELECT * INTO STRICT s FROM private.vendor_compliance_submissions WHERE id=p_submission;
 IF NOT private.compliance_access(s.vendor_id) OR s.owner_id<>auth.uid() THEN RAISE EXCEPTION 'Vendor evidence ownership required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.vendors WHERE id=s.vendor_id AND owner_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vendor ownership changed'; END IF;
 IF EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE subject_id=s.id AND status='submitted') THEN RETURN; END IF;
 SELECT * INTO o FROM storage.objects WHERE bucket_id='vendor-compliance' AND name=s.object_path;
 IF o.id IS NULL OR coalesce(o.metadata->>'mimetype','') NOT IN('application/pdf','image/jpeg','image/png')
 OR coalesce(o.metadata->>'size','') !~ '^[0-9]{1,8}$' THEN RAISE EXCEPTION 'Private PDF/JPEG/PNG upload required'; END IF;
 IF (o.metadata->>'size')::bigint NOT BETWEEN 1 AND 5242880 THEN RAISE EXCEPTION 'Evidence must be at most 5MB'; END IF;
 INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,reason,snapshot)
 VALUES(s.vendor_id,s.owner_id,s.kind,s.id,'submitted',auth.uid(),s.note,jsonb_build_object('objectId',o.id,'metadata',o.metadata,'path',s.object_path));
END $$;
CREATE FUNCTION public.finalize_vendor_evidence(p_submission uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.finalize_vendor_evidence(p_submission) $$;

-- Only submission authorization changes. manual_operator/receipt verification stay approved-only.
CREATE OR REPLACE FUNCTION public.submit_vendor_payment_profile(p_vendor_id uuid,p_destination jsonb,p_eft boolean,p_payshap boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;d jsonb;
BEGIN
 IF NOT private.compliance_access(p_vendor_id) THEN RAISE EXCEPTION 'Vendor ownership required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.vendors WHERE id=p_vendor_id FOR UPDATE;
 d:=jsonb_build_object('accountHolder',btrim(p_destination->>'accountHolder'),'bank',btrim(p_destination->>'bank'),'accountNumber',btrim(p_destination->>'accountNumber'),'accountType',btrim(p_destination->>'accountType'),'branchCode',btrim(p_destination->>'branchCode'),'shapId',btrim(p_destination->>'shapId'));
 IF length(coalesce(d->>'accountHolder','')) NOT BETWEEN 2 AND 150 OR length(coalesce(d->>'bank','')) NOT BETWEEN 2 AND 100 OR NOT (p_eft OR p_payshap) OR p_eft IS NULL OR p_payshap IS NULL THEN RAISE EXCEPTION 'Recipient, bank and supported payment method required';END IF;
 IF p_eft AND (coalesce(d->>'accountNumber','') !~ '^[0-9]{6,20}$' OR coalesce(d->>'branchCode','') !~ '^[0-9]{6}$' OR length(coalesce(d->>'accountType','')) NOT BETWEEN 2 AND 50) THEN RAISE EXCEPTION 'Valid EFT account, branch code and account type required';END IF;
 IF p_payshap AND length(coalesce(d->>'shapId','')) NOT BETWEEN 3 AND 150 THEN RAISE EXCEPTION 'Registered ShapID required';END IF;
 INSERT INTO private.vendor_payment_profiles(vendor_id,destination,eft,payshap,submitted_by) VALUES(p_vendor_id,d,p_eft,p_payshap,auth.uid()) RETURNING id INTO result;
 INSERT INTO private.manual_payment_events(profile_id,actor_id,action,note) VALUES(result,auth.uid(),'profile_submitted','New version pending independent recipient and bank capability verification');
 RETURN result;
END $$;

CREATE FUNCTION private.latest_compliance_events(p_vendor uuid,p_owner uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(kind,to_jsonb(e)),'{}') FROM
 (SELECT DISTINCT ON(kind) * FROM private.vendor_compliance_events WHERE vendor_id=p_vendor AND owner_id=p_owner
 AND kind IN('identity','food_premises','coa','operations','bank') ORDER BY kind,sequence DESC) e
$$;
CREATE FUNCTION private.bank_compliance_valid(p_vendor uuid,p_profile uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT e.subject_id=p_profile AND e.status='verified' AND e.valid_until>clock_timestamp()
 FROM private.vendor_compliance_events e JOIN public.vendors v ON v.id=e.vendor_id AND v.owner_id=e.owner_id
 WHERE e.vendor_id=p_vendor AND e.kind='bank' ORDER BY e.sequence DESC LIMIT 1),false)
$$;
ALTER FUNCTION private.vendor_assignment_documents(uuid) RENAME TO vendor_assignment_documents_phase_c;
CREATE FUNCTION private.vendor_assignment_documents(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE kind='assignment' AND subject_id=p_id AND status='revoked')
 THEN RAISE EXCEPTION 'Agreement assignment revoked; approved replacement required' USING ERRCODE='40001'; END IF;
 RETURN private.vendor_assignment_documents_phase_c(p_id);
END $$;
ALTER FUNCTION private.vendor_activation_ready(uuid,uuid) RENAME TO vendor_activation_ready_phase_c;
CREATE FUNCTION private.vendor_activation_ready(p_vendor uuid,p_owner uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r private.vendor_activation_reviews%ROWTYPE; events jsonb; k text; e jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 SELECT * INTO r FROM private.vendor_activation_reviews WHERE vendor_id=p_vendor ORDER BY reviewed_at DESC,id DESC LIMIT 1;
 events:=private.latest_compliance_events(p_vendor,p_owner);
 FOREACH k IN ARRAY ARRAY['identity','food_premises','coa','operations','bank'] LOOP
  e:=events->k;
  IF e IS NULL OR e->>'id' IS DISTINCT FROM r.compliance_event_ids->>k
  OR (e->>'status'<>'verified' AND NOT(k='coa' AND e->>'status'='not_required'))
  OR (e->>'valid_until')::timestamptz<=clock_timestamp() OR e->>'valid_until' IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE p.id=(e->>'actor_id')::uuid AND p.role='admin' AND NOT p.suspended AND p.deleted_at IS NULL)
  OR (e->>'actor_id')::uuid=p_owner THEN RETURN false; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE kind='assignment' AND status='revoked' AND subject_id=(SELECT assignment_id FROM private.vendor_legal_acceptances WHERE id=r.acceptance_id)) THEN RETURN false; END IF;
 IF NOT private.bank_compliance_valid(p_vendor,r.payment_profile_id) THEN RETURN false; END IF;
 RETURN private.vendor_activation_ready_phase_c(p_vendor,p_owner);
EXCEPTION WHEN SQLSTATE '40001' THEN RETURN false;
END $$;
-- Revoked/expired evidence stops NEW enrolled-vendor orders, never rewrites confirmed ones.
CREATE FUNCTION private.compliance_new_order_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=NEW.vendor_id) THEN
  SELECT owner_id INTO owner FROM public.vendors WHERE id=NEW.vendor_id FOR SHARE;
  IF NOT private.vendor_activation_ready(NEW.vendor_id,owner) THEN RAISE EXCEPTION 'Vendor compliance requires review; new ordering unavailable'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER compliance_new_order BEFORE INSERT ON public.order_suborders FOR EACH ROW EXECUTE FUNCTION private.compliance_new_order_guard();
-- A legacy exception needs an explicit, audited approval in this SAME transaction.
CREATE FUNCTION private.compliance_legacy_approval_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='approved' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.owner_id IS DISTINCT FROM NEW.owner_id)
 AND NOT EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE vendor_id=NEW.id AND owner_id=NEW.owner_id
 AND status=CASE WHEN EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=NEW.id) THEN 'activated' ELSE 'legacy_approved' END AND actor_id=auth.uid() AND transaction_id=txid_current()
 AND snapshot->>'fromStatus'=OLD.status::text) THEN
 RAISE EXCEPTION 'Explicit audited existing-vendor transition approval required' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER compliance_legacy_approval BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION private.compliance_legacy_approval_guard();

CREATE FUNCTION private.vendor_compliance_state(p_vendor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.vendors%ROWTYPE; admin boolean; events jsonb; enrolled boolean; ready boolean; assignment uuid; accepted boolean; assignment_valid boolean:=false; workflow text;
BEGIN
 IF NOT private.compliance_access(p_vendor) THEN RAISE EXCEPTION 'Vendor owner or active administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT v FROM public.vendors WHERE id=p_vendor;
 admin:=private.is_admin(); events:=private.latest_compliance_events(v.id,v.owner_id);
 enrolled:=EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=v.id);
 assignment:=private.current_vendor_assignment(v.id,v.owner_id);
 accepted:=EXISTS(SELECT 1 FROM private.vendor_legal_acceptances a JOIN private.vendor_legal_assignments d ON d.id=a.assignment_id
 WHERE a.vendor_id=v.id AND a.actor_id=v.owner_id AND d.change_basis<>'informational'
 AND d.id=(SELECT id FROM private.vendor_legal_assignments WHERE vendor_id=v.id AND owner_id=v.owner_id
 AND effective_at<=now() AND change_basis<>'informational' ORDER BY effective_at DESC,id DESC LIMIT 1));
 IF assignment IS NOT NULL THEN BEGIN PERFORM private.vendor_assignment_documents(assignment); assignment_valid:=true; EXCEPTION WHEN SQLSTATE '40001' THEN assignment_valid:=false; END; END IF;
 ready:=enrolled AND private.vendor_activation_ready(v.id,v.owner_id);
 workflow:=CASE WHEN v.status='suspended' THEN 'suspended' WHEN v.status='approved' AND (ready OR NOT enrolled) THEN 'approved'
 WHEN assignment IS NULL THEN 'pending documents' WHEN NOT accepted THEN 'awaiting vendor acceptance'
 WHEN ready THEN 'ready for approval' ELSE 'verification required' END;
 RETURN jsonb_build_object('admin',admin,'vendor',jsonb_build_object('id',v.id,'name',v.name,'status',v.status,'ownerId',v.owner_id,'archived',v.archived_at IS NOT NULL),
 'enrolled',enrolled,'legacyException',NOT enrolled,'ready',ready,'workflow',workflow,'accepted',accepted,'assignmentValid',assignment_valid,'events',events,
 'submissions',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY created_at DESC),'[]') FROM private.vendor_compliance_submissions s WHERE vendor_id=v.id),
 'bankHistory',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC),'[]') FROM private.manual_payment_events e JOIN private.vendor_payment_profiles p ON p.id=e.profile_id WHERE p.vendor_id=v.id),
 'bankProfiles',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY created_at DESC),'[]') FROM private.vendor_payment_profiles p WHERE vendor_id=v.id),
 'assignments',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY effective_at DESC),'[]') FROM private.vendor_legal_assignments a WHERE vendor_id=v.id),
 'documents',CASE WHEN admin THEN (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY kind,created_at DESC),'[]') FROM private.legal_versions d
 WHERE approved_at IS NOT NULL AND kind IN('vendor-agreement','vendor-fees','vendor-standards','privacy','refund-policy') AND (vendor_id IS NULL OR vendor_id=v.id)) ELSE '[]'::jsonb END,
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY sequence DESC),'[]') FROM private.vendor_compliance_events e WHERE vendor_id=v.id));
END $$;
CREATE FUNCTION public.get_vendor_compliance(p_vendor uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.vendor_compliance_state(p_vendor) $$;

CREATE FUNCTION private.admin_vendor_compliance(p_vendor uuid,p_action text,p_value jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.vendors%ROWTYPE; s private.vendor_compliance_submissions%ROWTYPE; a private.vendor_legal_assignments%ROWTYPE;
 bank private.vendor_payment_profiles%ROWTYPE; receipt private.vendor_legal_acceptances%ROWTYPE;
 reason text:=trim(p_value->>'reason'); subject uuid:=nullif(p_value->>'id','')::uuid; expiry timestamptz;
 events jsonb; evidence jsonb:='{}'; k text; e jsonb; until_at timestamptz; rid uuid; next_status public.vendor_status;
BEGIN
 IF NOT private.compliance_access(p_vendor,true) THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT v FROM public.vendors WHERE id=p_vendor FOR UPDATE;
 IF v.owner_id=auth.uid() THEN RAISE EXCEPTION 'Independent administrator required; no self-approval' USING ERRCODE='42501'; END IF;
 IF p_value ? 'expectedStatus' AND p_value->>'expectedStatus' IS DISTINCT FROM v.status::text THEN RAISE EXCEPTION 'Vendor status changed; reload before reviewing' USING ERRCODE='40001'; END IF;
 IF v.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Archived vendor cannot be reviewed'; END IF;
 IF length(coalesce(reason,'')) NOT BETWEEN 15 AND 1000 THEN RAISE EXCEPTION 'Documented review reason or approval reference required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 IF p_action IN('verify','waive_coa','verify_bank') THEN
  expiry:=(p_value->>'validUntil')::timestamptz;
  IF expiry IS NULL OR expiry<=clock_timestamp() THEN RAISE EXCEPTION 'Future verification expiry required'; END IF;
 END IF;
 CASE p_action
 WHEN 'assign' THEN
  INSERT INTO private.vendor_legal_assignments(vendor_id,owner_id,agreement_id,schedule_id,standards_id,privacy_id,refunds_id,change_basis,approval_reference,notified_at,effective_at,approved_by)
  VALUES(v.id,v.owner_id,(p_value->>'agreement')::uuid,(p_value->>'schedule')::uuid,(p_value->>'standards')::uuid,
    (p_value->>'privacy')::uuid,(p_value->>'refunds')::uuid,p_value->>'changeBasis',reason,(p_value->>'notifiedAt')::timestamptz,(p_value->>'effectiveAt')::timestamptz,auth.uid()) RETURNING * INTO a;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,reason,snapshot)
  VALUES(v.id,v.owner_id,'assignment',a.id,'assigned',auth.uid(),reason,jsonb_build_object('assignment',to_jsonb(a),'documents',private.vendor_assignment_documents(a.id)));
 WHEN 'verify','reject','revoke' THEN
  SELECT * INTO STRICT s FROM private.vendor_compliance_submissions WHERE id=subject AND vendor_id=v.id AND owner_id=v.owner_id;
  IF NOT EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE subject_id=s.id AND status='submitted') THEN RAISE EXCEPTION 'Uploaded and submitted evidence required'; END IF;
  IF p_action='verify' AND EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE subject_id=subject AND status='revoked') THEN RAISE EXCEPTION 'Revoked evidence requires a new submission'; END IF;
  IF p_action<>'revoke' AND subject IS DISTINCT FROM (SELECT subject_id FROM private.vendor_compliance_events WHERE vendor_id=v.id AND owner_id=v.owner_id AND kind=s.kind AND status='submitted' ORDER BY sequence DESC LIMIT 1) THEN RAISE EXCEPTION 'Review the latest submitted evidence'; END IF;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,valid_until,reason,snapshot)
  VALUES(v.id,v.owner_id,s.kind,s.id,CASE p_action WHEN 'verify' THEN 'verified' WHEN 'reject' THEN 'rejected' ELSE 'revoked' END,auth.uid(),expiry,reason,
    (SELECT snapshot FROM private.vendor_compliance_events WHERE subject_id=s.id AND status='submitted' ORDER BY sequence DESC LIMIT 1));
 WHEN 'waive_coa' THEN
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,status,actor_id,valid_until,reason)
  VALUES(v.id,v.owner_id,'coa','not_required',auth.uid(),expiry,reason);
 WHEN 'verify_bank','revoke_bank' THEN
  SELECT * INTO STRICT bank FROM private.vendor_payment_profiles WHERE id=subject AND vendor_id=v.id;
  IF bank.submitted_by=auth.uid() THEN RAISE EXCEPTION 'Independent bank reviewer required'; END IF;
  IF p_action='verify_bank' THEN
    IF EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE kind='bank' AND subject_id=subject AND status='revoked') THEN RAISE EXCEPTION 'Revoked banking requires a new profile version'; END IF;
    IF subject IS DISTINCT FROM (SELECT id FROM private.vendor_payment_profiles WHERE vendor_id=v.id ORDER BY created_at DESC,id DESC LIMIT 1) THEN RAISE EXCEPTION 'Review the latest submitted banking version'; END IF;
    PERFORM public.approve_vendor_payment_profile(subject,reason);
  END IF;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,valid_until,reason)
  VALUES(v.id,v.owner_id,'bank',subject,CASE WHEN p_action='verify_bank' THEN 'verified' ELSE 'revoked' END,auth.uid(),expiry,reason);
 WHEN 'revoke_assignment' THEN
  IF NOT EXISTS(SELECT 1 FROM private.vendor_legal_assignments WHERE id=subject AND vendor_id=v.id) THEN RAISE EXCEPTION 'Vendor-specific assignment required'; END IF;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,reason)
  VALUES(v.id,v.owner_id,'assignment',subject,'revoked',auth.uid(),reason);
 WHEN 'enroll' THEN
  IF coalesce((p_value->>'confirm')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Explicit transition confirmation required'; END IF;
  INSERT INTO private.vendor_activation_requirements(vendor_id,owner_id) VALUES(v.id,v.owner_id) ON CONFLICT(vendor_id) DO NOTHING;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,status,actor_id,reason) VALUES(v.id,v.owner_id,'administration','enrolled',auth.uid(),reason);
 WHEN 'complete_review' THEN
  IF NOT EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=v.id) THEN RAISE EXCEPTION 'Explicitly enroll this existing vendor before strict review'; END IF;
  events:=private.latest_compliance_events(v.id,v.owner_id);
  FOREACH k IN ARRAY ARRAY['identity','food_premises','coa','operations','bank'] LOOP
   e:=events->k;
   IF e IS NULL OR (e->>'status'<>'verified' AND NOT(k='coa' AND e->>'status'='not_required')) OR e->>'valid_until' IS NULL OR (e->>'valid_until')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'Current verified evidence required: %',k; END IF;
   evidence:=evidence||jsonb_build_object(k,e->>'id'); until_at:=least(until_at,(e->>'valid_until')::timestamptz);
  END LOOP;
  SELECT r.* INTO receipt FROM private.vendor_legal_acceptances r JOIN private.vendor_legal_assignments d ON d.id=r.assignment_id
   WHERE r.vendor_id=v.id AND r.actor_id=v.owner_id AND d.id=(SELECT id FROM private.vendor_legal_assignments WHERE vendor_id=v.id AND owner_id=v.owner_id AND effective_at<=now() AND change_basis<>'informational' ORDER BY effective_at DESC,id DESC LIMIT 1);
  IF receipt.id IS NULL THEN RAISE EXCEPTION 'Current vendor agreement acceptance required'; END IF;
  INSERT INTO private.vendor_activation_reviews(vendor_id,owner_id,acceptance_id,payment_profile_id,compliance_reference,compliance_valid_until,schedules_reference,schedules_hash,reviewed_by,compliance_event_ids)
  VALUES(v.id,v.owner_id,receipt.id,(events->'bank'->>'subject_id')::uuid,'Verified evidence event IDs: '||evidence::text,until_at,reason,receipt.documents->'vendor-fees'->>'content_hash',auth.uid(),evidence) RETURNING id INTO rid;
  IF NOT private.vendor_activation_ready(v.id,v.owner_id) THEN RAISE EXCEPTION 'Activation prerequisites are incomplete or revoked'; END IF;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,reason,snapshot)
  VALUES(v.id,v.owner_id,'administration',rid,'reviewed',auth.uid(),reason,evidence);
 WHEN 'activate' THEN
  IF v.status NOT IN('pending','suspended') THEN RAISE EXCEPTION 'Pending or suspended vendor required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=v.id) THEN
   IF coalesce((p_value->>'legacyAcknowledged')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Explicit existing-vendor exception acknowledgement required'; END IF;
   INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,status,actor_id,reason,snapshot)
   VALUES(v.id,v.owner_id,'administration','legacy_approved',auth.uid(),reason,jsonb_build_object('fromStatus',v.status,'exception','pre-B unenrolled vendor'));
  ELSIF NOT private.vendor_activation_ready(v.id,v.owner_id) THEN RAISE EXCEPTION 'Verified activation prerequisites required'; END IF;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,status,actor_id,reason,snapshot) VALUES(v.id,v.owner_id,'administration','activated',auth.uid(),reason,jsonb_build_object('fromStatus',v.status));
  UPDATE public.vendors SET status='approved' WHERE id=v.id;
 WHEN 'suspend','request_changes' THEN
  next_status:=CASE WHEN p_action='suspend' THEN 'suspended'::public.vendor_status ELSE 'pending'::public.vendor_status END;
  UPDATE public.vendors SET status=next_status WHERE id=v.id;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,status,actor_id,reason) VALUES(v.id,v.owner_id,'administration',next_status::text,auth.uid(),reason);
 ELSE RAISE EXCEPTION 'Unknown compliance action';
 END CASE;
 RETURN jsonb_build_object('saved',true);
END $$;
CREATE FUNCTION public.admin_vendor_compliance(p_vendor uuid,p_action text,p_value jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.admin_vendor_compliance(p_vendor,p_action,p_value) $$;

-- Never expose newly revoked banking instructions for new orders. No gateway flag changes.
ALTER FUNCTION public.get_vendor_manual_methods(uuid) RENAME TO get_vendor_manual_methods_phase_c;
CREATE FUNCTION public.get_vendor_manual_methods(p_vendor_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE bid uuid;
BEGIN
 SELECT id INTO bid FROM private.vendor_payment_profiles WHERE vendor_id=p_vendor_id AND approved_at IS NOT NULL ORDER BY approved_at DESC,id DESC LIMIT 1;
 IF EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE vendor_id=p_vendor_id AND kind='bank' AND subject_id=bid AND status='revoked')
 OR (EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=p_vendor_id) AND NOT private.bank_compliance_valid(p_vendor_id,bid)) THEN RETURN '{}'::jsonb; END IF;
 RETURN public.get_vendor_manual_methods_phase_c(p_vendor_id);
END $$;
REVOKE ALL ON FUNCTION public.get_vendor_manual_methods_phase_c(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_vendor_manual_methods(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_manual_methods(uuid) TO anon,authenticated;
-- RPC-only access. RLS helpers return only a boolean and cannot mutate evidence.
REVOKE ALL ON FUNCTION private.compliance_access(uuid,boolean),private.compliance_storage_access(text,boolean),
 private.latest_compliance_events(uuid,uuid),private.bank_compliance_valid(uuid,uuid),private.vendor_assignment_documents(uuid),
 private.vendor_assignment_documents_phase_c(uuid),private.vendor_activation_ready(uuid,uuid),private.vendor_activation_ready_phase_c(uuid,uuid),
 private.compliance_new_order_guard(),private.compliance_legacy_approval_guard(),private.reserve_vendor_evidence(text,text),
 public.reserve_vendor_evidence(text,text),private.finalize_vendor_evidence(uuid),public.finalize_vendor_evidence(uuid),
 private.vendor_compliance_state(uuid),public.get_vendor_compliance(uuid),private.admin_vendor_compliance(uuid,text,jsonb),public.admin_vendor_compliance(uuid,text,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.compliance_storage_access(text,boolean),private.compliance_access(uuid,boolean),
 private.reserve_vendor_evidence(text,text),public.reserve_vendor_evidence(text,text),private.finalize_vendor_evidence(uuid),public.finalize_vendor_evidence(uuid),
 private.vendor_compliance_state(uuid),public.get_vendor_compliance(uuid),private.admin_vendor_compliance(uuid,text,jsonb),public.admin_vendor_compliance(uuid,text,jsonb) TO authenticated;


-- Source: 20261026112602_phase_e_legal_publication_checkout_evidence.sql
-- Phase E LOCAL CANDIDATE. No publication, acceptance rollout, payment or marketing activation.

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


-- Narrow managed-owner dependency for defining scoped Storage policies.
-- Does not grant table access, application admin privileges, role membership or BYPASSRLS.
GRANT USAGE ON SCHEMA private TO supabase_storage_admin;
GRANT EXECUTE ON FUNCTION private.compliance_storage_access(text,boolean) TO supabase_storage_admin;

-- LOCAL REVIEW CANDIDATE ONLY, AFTER reconciled manual foundations and B/C/D/E.
-- Not standalone, not a production installer. No rows or activation flags changed.

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
 SELECT owner_id INTO owner FROM public.vendors WHERE id=p_vendor AND status='approved' AND archived_at IS NULL AND commission_rate=0.17;
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


ALTER TABLE private.manual_order_payments ADD COLUMN vendor_acceptance_id uuid REFERENCES private.vendor_legal_acceptances(id), ADD COLUMN fee_snapshot jsonb;
CREATE FUNCTION private.manual_contract_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rate numeric; receipt private.vendor_legal_acceptances%ROWTYPE;
BEGIN
 SELECT v.commission_rate INTO rate FROM public.vendors v WHERE v.id=NEW.vendor_id FOR SHARE;
 IF rate IS DISTINCT FROM 0.17 THEN RAISE EXCEPTION 'Reviewed 15 percent plus 2 percent launch fee basis required'; END IF;
 SELECT a.* INTO receipt FROM private.vendor_activation_reviews r JOIN private.vendor_legal_acceptances a ON a.id=r.acceptance_id
 JOIN public.vendors v ON v.id=r.vendor_id AND v.owner_id=r.owner_id
 WHERE r.vendor_id=NEW.vendor_id ORDER BY r.reviewed_at DESC,r.id DESC LIMIT 1;
 IF receipt.id IS NULL OR receipt.assignment_id IS NULL THEN RAISE EXCEPTION 'Assigned vendor contract receipt required'; END IF;
 NEW.vendor_acceptance_id:=receipt.id;
 NEW.fee_snapshot:=jsonb_build_object('platformRate',0.15,'transactionRate',0.02,'combinedRate',0.17,
 'feeVersion',receipt.documents->'vendor-fees'->>'version','scheduleHash',receipt.documents->'vendor-fees'->>'content_hash',
 'calculation','round(product subtotal * combinedRate, 2)','taxTreatment','unresolved; VAT not calculated','marketingEnabled',false);
 RETURN NEW;
END $$;
CREATE TRIGGER manual_contract_snapshot BEFORE INSERT ON private.manual_order_payments FOR EACH ROW EXECUTE FUNCTION private.manual_contract_snapshot();
CREATE TRIGGER manual_contract_immutable BEFORE UPDATE OF vendor_acceptance_id,fee_snapshot ON private.manual_order_payments FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();
REVOKE ALL ON FUNCTION private.manual_contract_snapshot() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.snapshot_paid_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND OLD.commission_amount IS NOT NULL AND (NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
  OR NEW.commission_rate_snapshot IS DISTINCT FROM OLD.commission_rate_snapshot OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
  OR NEW.paid_at IS DISTINCT FROM OLD.paid_at OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id OR NEW.payment_status IS DISTINCT FROM OLD.payment_status) THEN RAISE EXCEPTION 'Paid financial snapshots are immutable'; END IF;
 IF TG_OP='UPDATE' AND OLD.payment_status IS DISTINCT FROM 'paid' AND NEW.payment_status='paid' THEN
  SELECT coalesce((m.fee_snapshot->>'combinedRate')::numeric,v.commission_rate),v.name INTO NEW.commission_rate_snapshot,NEW.vendor_name_snapshot
 FROM public.vendors v LEFT JOIN private.manual_order_payments m ON m.order_id=NEW.order_id WHERE v.id=NEW.vendor_id FOR SHARE OF v;
  NEW.commission_amount:=round(NEW.subtotal*NEW.commission_rate_snapshot,2); NEW.paid_at:=clock_timestamp(); NEW.commission_evidence:='captured at verified paid transition';
 ELSIF TG_OP='INSERT' AND NEW.payment_status='paid' THEN RAISE EXCEPTION 'Create unpaid suborders; confirmation must perform the paid transition';
 ELSIF TG_OP='UPDATE' AND OLD.commission_amount IS NOT NULL AND (NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
  OR NEW.commission_rate_snapshot IS DISTINCT FROM OLD.commission_rate_snapshot OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
  OR NEW.paid_at IS DISTINCT FROM OLD.paid_at OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id) THEN RAISE EXCEPTION 'Paid financial snapshots are immutable'; END IF;
 RETURN NEW;
END $function$
;

-- Forward-only LOCAL REVIEW CANDIDATE. Not an automatic or approved hosted migration.
-- Requires the corrected singleton RPC; after EFT-only installation if that package
-- is chosen. Adding this first invalidates its frozen baseline/retry fingerprints.
-- The SQL marker is not project identity proof. Independent control-plane target
-- verification and explicit installation/configuration approvals remain mandatory.

SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF to_regprocedure('private.vendor_launch_ready(uuid)') IS NULL OR to_regclass('private.order_legal_acceptances') IS NULL
 OR EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled)
 THEN RAISE EXCEPTION 'Closed staging integrated foundation required'; END IF;
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed postgres ownership required'; END IF;
 IF strpos(pg_get_functiondef('public.admin_manual_settings(boolean,boolean,integer,numeric,text)'::regprocedure),'updated_rows')=0
 THEN RAISE EXCEPTION 'Corrected singleton RPC prerequisite missing'; END IF;
END $$;

ALTER TABLE private.manual_payment_settings ADD COLUMN revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0);
CREATE FUNCTION private.manual_settings_revision_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.revision:=OLD.revision+1;
 RETURN NEW;
END $$;
CREATE TRIGGER manual_settings_revision BEFORE UPDATE ON private.manual_payment_settings
 FOR EACH ROW EXECUTE FUNCTION private.manual_settings_revision_guard();
REVOKE ALL ON FUNCTION private.manual_settings_revision_guard() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.manual_settings_revision() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT md5(jsonb_build_object('settings',(SELECT to_jsonb(s) FROM private.manual_payment_settings s WHERE singleton),
 'gateways',(SELECT jsonb_agg(to_jsonb(g) ORDER BY provider) FROM private.gateway_settings g WHERE provider IN('manual_eft','manual_payshap')))::text)
$$;
REVOKE ALL ON FUNCTION private.manual_settings_revision() FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.manual_payment_workspace(boolean) RENAME TO manual_payment_workspace_before_checked_settings;
REVOKE ALL ON FUNCTION public.manual_payment_workspace_before_checked_settings(boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.manual_payment_workspace(p_test_only boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 -- Original identity/role/scope checks remain authoritative.
 result:=public.manual_payment_workspace_before_checked_settings(p_test_only);
 IF private.is_admin() THEN result:=jsonb_set(result,'{settings,settings_revision}',to_jsonb(private.manual_settings_revision())); END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.manual_payment_workspace(boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.manual_payment_workspace(boolean) TO authenticated,service_role;

CREATE FUNCTION public.admin_manual_settings_checked(p_eft boolean,p_payshap boolean,p_minutes integer,p_threshold numeric,p_reason text,p_expected_revision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501'; END IF;
 IF p_eft IS NULL OR p_payshap IS NULL OR p_minutes IS NULL OR p_minutes NOT BETWEEN 5 AND 60
 OR p_threshold IS NULL OR p_threshold<=0 OR p_threshold::text IN('NaN','Infinity','-Infinity')
 OR p_threshold<>round(p_threshold,2) OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 500
 THEN RAISE EXCEPTION 'Valid manual settings and reason required' USING ERRCODE='22023'; END IF;
 -- Same order as legacy setter: settings, then the manual gateway rows.
 PERFORM 1 FROM private.manual_payment_settings WHERE singleton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Manual settings singleton missing'; END IF;
 PERFORM 1 FROM private.gateway_settings WHERE provider IN('manual_eft','manual_payshap') ORDER BY provider FOR UPDATE;
 IF p_expected_revision IS NULL OR p_expected_revision IS DISTINCT FROM private.manual_settings_revision()
 THEN RAISE EXCEPTION 'Settings changed; reload and review' USING ERRCODE='40001'; END IF;
 -- Reuse original active-admin, singleton, audit and collection activation guards.
 PERFORM public.admin_manual_settings(p_eft,p_payshap,p_minutes,p_threshold,btrim(p_reason));
END $$;
REVOKE ALL ON FUNCTION public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text) TO authenticated;
-- No gateway invocation, actors, banking, publication or settings value update here.


INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('20261027123110','staging_integrated_vendor_legal_payments',ARRAY[$artifact_094bb368b642668e$-- LOCAL REVIEW ONLY. Captured staging foundation prerequisite; all rollout states must remain OFF.
BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s';

DO $staging_preimage$
DECLARE e record; actual text;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed application postgres executor required'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>54
 OR (SELECT md5(string_agg(version||':'||coalesce(name,''),E'\n' ORDER BY version)) FROM supabase_migrations.schema_migrations)<>'9befc9e98322a4517850501c61be9696'
 THEN RAISE EXCEPTION 'Staging 54-entry history changed; obtain a fresh preimage'; END IF;
 FOR e IN SELECT * FROM (VALUES ('private.active_account()','5bda4a148d4f52474014f31f90b49cdf'),
('private.create_order_core(uuid, text, text, text, date, text, jsonb)','d66dff3346ea0241a989a2c060227236'),
('private.create_order_with_delivery(uuid, text, text, text, date, text, jsonb, uuid)','36d73e384b63626498cbe054c1d5da31'),
('public.admin_manual_settings(boolean, boolean, integer, numeric, text)','7c0a398be18ece9e1940840fe692ea6c'),
('public.cancel_unpaid_order(uuid, text, text)','6a52338e78c097c55bb8721bbcf451fe'),
('public.create_manual_order(uuid, text, text, text, date, text, jsonb, uuid, text, uuid)','c4dc553530f2998f26e91475b7503a5e'),
('public.get_vendor_manual_methods(uuid)','52ac2c375a04a31aa46470456260c929'),
('public.order_to_json(orders)','1185d494ac41ab09d2b83f3e263582cd'),
('public.record_manual_refund_status(uuid, text, numeric, numeric, text)','7996f9c65a3cf770c3eb91f7a2b650a2'),
('public.verify_manual_payment(uuid, numeric, text, boolean)','c35b9e7c3fecb979f70c81cda16938cb'),
('public.handle_new_user()','086649c1a17a57fbcfde261ea7bdba6a'),
('public.guard_vendor_privileged_fields()','405aaa6295945413607a5413a8d965a3'),
('public.guard_profile_privileged_fields()','389319aa4e0b30ada46bc315e97afbad')) x(signature,hash) LOOP
  SELECT md5(pg_get_functiondef(to_regprocedure(e.signature))) INTO actual;
  IF actual IS DISTINCT FROM e.hash THEN RAISE EXCEPTION 'Staging function preimage changed: %',e.signature; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled)
 OR EXISTS(SELECT 1 FROM private.commercial_settings WHERE onboarding_enforced OR acquisition_enabled OR standard_breakdown_enabled)
 OR to_regclass('private.vendor_activation_requirements') IS NOT NULL
 OR to_regclass('private.vendor_legal_assignments') IS NOT NULL
 OR to_regclass('private.vendor_compliance_events') IS NOT NULL
 OR to_regclass('private.order_legal_acceptances') IS NOT NULL
 OR to_regprocedure('public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'Closed, pre-B-E staging prerequisites required; no flag change or partial-install retry'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','private') AND c.relkind IN('r','p','v') AND pg_get_userbyid(c.relowner)<>'postgres')
 THEN RAISE EXCEPTION 'Unexpected application object owner'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Existing managed Storage RLS required'; END IF;
END $staging_preimage$;
REVOKE TRUNCATE,TRIGGER,REFERENCES ON ALL TABLES IN SCHEMA public,private FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public,private REVOKE TRUNCATE,TRIGGER,REFERENCES ON TABLES FROM PUBLIC,anon,authenticated;

-- Source: 20261026073911_phase_b_vendor_security_activation.sql
-- Phase B LOCAL CANDIDATE. No publication, acceptance rollout or gateway activation.
-- Dependencies: legal_corporate_framework + vendor_direct_manual_payments.

SET LOCAL lock_timeout = '10s';

-- Browser row creation is not an onboarding API. SECURITY DEFINER signup and
-- become_vendor retain their existing contracts and execute as their DB owner.
REVOKE INSERT ON public.profiles, public.vendors FROM PUBLIC, anon, authenticated;
-- Column grants can survive a table-level REVOKE.
DO $$ DECLARE t text; cols text; BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','vendors'] LOOP
    SELECT string_agg(quote_ident(column_name), ',') INTO cols
    FROM information_schema.columns WHERE table_schema='public' AND table_name=t;
    EXECUTE format('REVOKE INSERT (%s) ON public.%I FROM PUBLIC, anon, authenticated', cols, t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS vendors_insert_admin_or_self ON public.vendors;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE requested_role public.user_role; vid uuid; business_name text; business_category text;
BEGIN
  -- Only the nonprivileged vendor application choice is honored. Unknown,
  -- malformed and privileged values become customer, without an enum cast.
  requested_role := CASE WHEN NEW.raw_user_meta_data->>'role' = 'vendor'
    THEN 'vendor'::public.user_role ELSE 'customer'::public.user_role END;
  INSERT INTO public.profiles(id,name,email,role,building)
  VALUES(NEW.id,coalesce(nullif(trim(NEW.raw_user_meta_data->>'name'),''),split_part(NEW.email,'@',1)),
    NEW.email,requested_role,nullif(trim(NEW.raw_user_meta_data->>'building'),''));
  IF requested_role = 'vendor' THEN
    business_name := nullif(trim(NEW.raw_user_meta_data->>'business_name'),'');
    business_category := nullif(trim(NEW.raw_user_meta_data->>'business_category'),'');
    IF business_name IS NULL OR business_category IS NULL THEN
      RAISE EXCEPTION 'Business name and category are required for vendor registration';
    END IF;
    INSERT INTO public.vendors(owner_id,name,category,building,status,email)
    VALUES(NEW.id,business_name,business_category,nullif(trim(NEW.raw_user_meta_data->>'building'),''),'pending',NEW.email)
    RETURNING id INTO vid;
    UPDATE public.profiles SET vendor_id=vid WHERE id=NEW.id;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated, service_role;

-- No backfill: existing vendors retain their status, negotiated rates and orders.
-- New vendors enroll automatically. Existing vendors need an explicitly reviewed
-- enrollment later; there is deliberately no browser enrollment/rollout API.
CREATE TABLE private.vendor_activation_requirements (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  required_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.vendor_activation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES private.vendor_activation_requirements(vendor_id),
  owner_id uuid NOT NULL REFERENCES public.profiles(id),
  acceptance_id uuid NOT NULL REFERENCES private.vendor_legal_acceptances(id),
  payment_profile_id uuid NOT NULL REFERENCES private.vendor_payment_profiles(id),
  -- Private references to independently checked documents, not public uploads.
  compliance_reference text NOT NULL CHECK(length(trim(compliance_reference)) >= 15),
  compliance_valid_until timestamptz NOT NULL,
  schedules_reference text NOT NULL CHECK(length(trim(schedules_reference)) >= 15),
  -- Hash must match the fee/schedule version in the existing acceptance receipt.
  schedules_hash text NOT NULL CHECK(schedules_hash ~ '^[0-9a-f]{64}$'),
  reviewed_by uuid NOT NULL REFERENCES public.profiles(id),
  reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(compliance_valid_until > reviewed_at),
  CHECK(reviewed_by <> owner_id)
);
CREATE INDEX vendor_activation_review_latest ON private.vendor_activation_reviews(vendor_id,reviewed_at DESC,id DESC);
ALTER TABLE private.vendor_activation_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.vendor_activation_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.vendor_activation_requirements, private.vendor_activation_reviews
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER activation_requirements_immutable BEFORE UPDATE OR DELETE ON private.vendor_activation_requirements
  FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
CREATE TRIGGER activation_reviews_immutable BEFORE UPDATE OR DELETE ON private.vendor_activation_reviews
  FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();

CREATE FUNCTION private.vendor_activation_ready(p_vendor uuid, p_owner uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r private.vendor_activation_reviews%ROWTYPE; a private.vendor_legal_acceptances%ROWTYPE;
  docs jsonb; bank_id uuid;
BEGIN
  -- Share the legal publication/acceptance serialization lock. No client inputs
  -- can substitute actor, document bytes, banking approval or verification time.
  PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
  IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE p.id=p_owner AND p.role='vendor' AND p.vendor_id=p_vendor
      AND NOT p.suspended AND p.deleted_at IS NULL) THEN RETURN false; END IF;
  SELECT * INTO r FROM private.vendor_activation_reviews WHERE vendor_id=p_vendor
    ORDER BY reviewed_at DESC,id DESC LIMIT 1;
  IF r.id IS NULL OR r.owner_id IS DISTINCT FROM p_owner OR r.compliance_valid_until<=clock_timestamp()
    OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
      WHERE p.id=r.reviewed_by AND p.role='admin' AND NOT p.suspended AND p.deleted_at IS NULL)
  THEN RETURN false; END IF;
  SELECT * INTO a FROM private.vendor_legal_acceptances WHERE id=r.acceptance_id;
  IF a.vendor_id IS DISTINCT FROM p_vendor OR a.actor_id IS DISTINCT FROM p_owner
    OR a.method IS DISTINCT FROM 'authenticated'
    OR a.documents->'vendor-fees'->>'content_hash' IS DISTINCT FROM r.schedules_hash
  THEN RETURN false; END IF;
  docs := private.validate_vendor_consent(
    jsonb_build_object('vendor-agreement',a.documents->'vendor-agreement'->>'id',
      'vendor-fees',a.documents->'vendor-fees'->>'id',
      'privacy',a.documents->'privacy'->>'id','refund-policy',a.documents->'refund-policy'->>'id'),
    a.acknowledgements);
  IF docs IS DISTINCT FROM a.documents THEN RETURN false; END IF;
  SELECT id INTO bank_id FROM private.vendor_payment_profiles WHERE vendor_id=p_vendor
    AND approved_at IS NOT NULL AND approved_by IS NOT NULL
    AND approved_by<>p_owner AND approved_by<>submitted_by
    AND length(trim(verification_evidence))>=15
    ORDER BY approved_at DESC,id DESC LIMIT 1;
  RETURN coalesce(bank_id=r.payment_profile_id,false);
END $$;

CREATE FUNCTION private.guard_vendor_creation_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending'::public.vendor_status THEN
      RAISE EXCEPTION 'New vendors must start pending' USING ERRCODE='42501';
    END IF;
    IF auth.uid() IS NOT NULL AND NOT private.is_admin() THEN
      IF NEW.owner_id IS DISTINCT FROM auth.uid()
        OR NEW.featured IS DISTINCT FROM false OR NEW.rating IS DISTINCT FROM 0
        OR NEW.review_count IS DISTINCT FROM 0 OR NEW.subscription_tier IS DISTINCT FROM 'basic'
        OR NEW.plan::text IS DISTINCT FROM 'marketplace' OR NEW.commission_rate IS DISTINCT FROM 0.17
        OR NEW.analytics_enabled IS DISTINCT FROM false OR NEW.recommendations_enabled IS DISTINCT FROM false
        OR NEW.corporate_orders_enabled IS DISTINCT FROM false OR NEW.archived_at IS NOT NULL
      THEN RAISE EXCEPTION 'Untrusted vendor ownership or commercial values' USING ERRCODE='42501'; END IF;
    END IF;
  ELSE
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
      INSERT INTO private.vendor_activation_requirements(vendor_id,owner_id)
      VALUES(NEW.id,NEW.owner_id) ON CONFLICT(vendor_id) DO NOTHING;
    END IF;
    IF NEW.status='approved' AND
    (OLD.status IS DISTINCT FROM NEW.status OR OLD.owner_id IS DISTINCT FROM NEW.owner_id) THEN
    -- Owner transfers always need a new review, including legacy vendors.
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id OR
      EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=NEW.id) THEN
      IF NOT private.vendor_activation_ready(NEW.id,NEW.owner_id) THEN
        RAISE EXCEPTION 'Vendor activation requires current agreement, compliance, approved banking and completed schedules'
          USING ERRCODE='42501';
      END IF;
    END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_vendor_creation_activation BEFORE INSERT OR UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION private.guard_vendor_creation_activation();
CREATE FUNCTION private.enroll_vendor_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO private.vendor_activation_requirements(vendor_id,owner_id) VALUES(NEW.id,NEW.owner_id);
  RETURN NEW;
END $$;
CREATE TRIGGER enroll_vendor_activation AFTER INSERT ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION private.enroll_vendor_activation();

-- Harden the existing acceptance API without enabling it or duplicating receipts.
CREATE OR REPLACE FUNCTION private.accept_vendor_legal(p_vendor uuid,p_documents jsonb,p_ack jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE docs jsonb; result uuid;
BEGIN
  IF NOT private.active_account() OR NOT EXISTS(
    SELECT 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id
    WHERE v.id=p_vendor AND v.owner_id=auth.uid() AND p.role='vendor' AND p.vendor_id=v.id
      AND NOT p.suspended AND p.deleted_at IS NULL AND v.archived_at IS NULL AND v.status IN ('pending','approved'))
  THEN RAISE EXCEPTION 'Active vendor owner required' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
  docs:=private.validate_vendor_consent(p_documents,p_ack);
  SELECT id INTO result FROM private.vendor_legal_acceptances
    WHERE vendor_id=p_vendor AND actor_id=auth.uid() AND documents=docs AND method='authenticated'
    ORDER BY accepted_at DESC,id DESC LIMIT 1;
  IF result IS NULL THEN
    INSERT INTO private.vendor_legal_acceptances(vendor_id,actor_id,documents,acknowledgements,method)
    VALUES(p_vendor,auth.uid(),docs,p_ack,'authenticated') RETURNING id INTO result;
  END IF;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION private.vendor_activation_ready(uuid,uuid),
  private.guard_vendor_creation_activation(),private.enroll_vendor_activation()
  FROM PUBLIC, anon, authenticated, service_role;
-- No grants, document inserts, gateway updates, rollout switches or account backfill.


-- Source: 20261026091408_phase_c_vendor_agreement_assignments.sql
-- Phase C LOCAL CANDIDATE. Depends on Phase B. No legal publication or rollout.

SET LOCAL lock_timeout='10s';
ALTER TABLE private.commercial_settings ADD COLUMN vendor_clickwrap_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE private.legal_versions ADD COLUMN vendor_id uuid REFERENCES public.vendors(id);
ALTER TABLE private.legal_versions DROP CONSTRAINT legal_versions_kind_check;
ALTER TABLE private.legal_versions ADD CONSTRAINT legal_versions_kind_check
 CHECK(kind IN ('terms','privacy','refund-policy','vendor-agreement','vendor-fees','vendor-standards'));
CREATE TRIGGER legal_scope_immutable BEFORE UPDATE OF vendor_id ON private.legal_versions
 FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
-- Scoped commercial documents must never leak through the public legal portal.
CREATE OR REPLACE FUNCTION private.commercial_documents() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(kind,to_jsonb(d)),'{}') FROM (
 SELECT DISTINCT ON(kind) id,kind,version,title,content,content_hash,effective_at,created_at
 FROM private.legal_versions WHERE vendor_id IS NULL AND kind<>'vendor-standards'
 AND approved_at IS NOT NULL AND effective_at<=now()
 ORDER BY kind,effective_at DESC,created_at DESC,id DESC) d
$$;

-- Assignment is approved routing/version metadata, never a second acceptance store.
CREATE TABLE private.vendor_legal_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 owner_id uuid NOT NULL REFERENCES public.profiles(id),
 agreement_id uuid NOT NULL REFERENCES private.legal_versions(id),
 schedule_id uuid NOT NULL REFERENCES private.legal_versions(id),
 standards_id uuid NOT NULL REFERENCES private.legal_versions(id),
 privacy_id uuid NOT NULL REFERENCES private.legal_versions(id),
 refunds_id uuid NOT NULL REFERENCES private.legal_versions(id),
 change_basis text NOT NULL CHECK(change_basis IN ('initial','material','urgent','informational')),
 approval_reference text NOT NULL CHECK(length(trim(approval_reference))>=15),
 notified_at timestamptz NOT NULL, effective_at timestamptz NOT NULL,
 approved_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(effective_at>=notified_at),
 CHECK(change_basis<>'material' OR effective_at>=notified_at+interval '30 days'),
 UNIQUE(vendor_id,owner_id,effective_at)
);
ALTER TABLE private.vendor_legal_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.vendor_legal_assignments FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER assignment_immutable BEFORE UPDATE OR DELETE ON private.vendor_legal_assignments
 FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
ALTER TABLE private.vendor_legal_acceptances
 ADD COLUMN assignment_id uuid REFERENCES private.vendor_legal_assignments(id),
 ADD COLUMN acknowledgement_text text,
 ADD COLUMN signer_name text;
CREATE UNIQUE INDEX vendor_assigned_receipt_unique ON private.vendor_legal_acceptances(assignment_id,actor_id)
 WHERE assignment_id IS NOT NULL;

CREATE FUNCTION private.vendor_assignment_documents(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE a private.vendor_legal_assignments%ROWTYPE; docs jsonb;
BEGIN
 SELECT * INTO a FROM private.vendor_legal_assignments WHERE id=p_id;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Assignment unavailable' USING ERRCODE='40001'; END IF;
 SELECT jsonb_object_agg(d.kind,jsonb_build_object('id',d.id,'kind',d.kind,'version',d.version,
   'title',d.title,'content',d.content,'content_hash',d.content_hash,'effective_at',d.effective_at,'created_at',d.created_at)) INTO docs
 FROM private.legal_versions d JOIN (VALUES
 ('vendor-agreement',a.agreement_id),('vendor-fees',a.schedule_id),('vendor-standards',a.standards_id),
 ('privacy',a.privacy_id),('refund-policy',a.refunds_id)) expected(kind,id) ON d.id=expected.id AND d.kind=expected.kind
 WHERE d.approved_at IS NOT NULL AND d.effective_at<=a.effective_at
 AND (d.vendor_id IS NULL OR d.vendor_id=a.vendor_id)
 AND (d.kind<>'vendor-fees' OR d.vendor_id=a.vendor_id)
 AND d.content_hash=encode(sha256(convert_to(d.content,'UTF8')),'hex');
 IF docs IS NULL OR (SELECT count(*) FROM jsonb_object_keys(docs))<>5 THEN
   RAISE EXCEPTION 'Complete approved vendor-specific documents required' USING ERRCODE='40001';
 END IF;
 RETURN docs;
END $$;
CREATE FUNCTION private.guard_vendor_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
   WHERE p.id=NEW.approved_by AND p.role='admin' AND NOT p.suspended AND p.deleted_at IS NULL)
 OR NEW.approved_by=NEW.owner_id
 OR NOT EXISTS(SELECT 1 FROM public.vendors WHERE id=NEW.vendor_id AND owner_id=NEW.owner_id)
 THEN RAISE EXCEPTION 'Independent legal approval and vendor ownership required'; END IF;
 IF NEW.change_basis='informational' AND NOT EXISTS(SELECT 1 FROM private.vendor_legal_assignments
   WHERE vendor_id=NEW.vendor_id AND owner_id=NEW.owner_id AND change_basis<>'informational') THEN
   RAISE EXCEPTION 'Initial agreement must require acceptance'; END IF;
 IF NEW.change_basis='initial' AND EXISTS(SELECT 1 FROM private.vendor_legal_assignments
   WHERE vendor_id=NEW.vendor_id AND owner_id=NEW.owner_id) THEN
   RAISE EXCEPTION 'Classify the approved change and notice requirements'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assignment_review BEFORE INSERT ON private.vendor_legal_assignments
 FOR EACH ROW EXECUTE FUNCTION private.guard_vendor_assignment();
CREATE FUNCTION private.check_vendor_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.vendor_assignment_documents(NEW.id); RETURN NEW; END $$;
CREATE TRIGGER assignment_documents AFTER INSERT ON private.vendor_legal_assignments
 FOR EACH ROW EXECUTE FUNCTION private.check_vendor_assignment();

CREATE FUNCTION private.agreement_vendor() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE vid uuid;
BEGIN
 SELECT v.id INTO vid FROM public.profiles p JOIN public.vendors v ON v.id=p.vendor_id AND v.owner_id=p.id
 WHERE p.id=auth.uid() AND p.role='vendor' AND NOT p.suspended AND p.deleted_at IS NULL
 AND v.archived_at IS NULL AND v.status IN ('pending','approved') AND private.active_account();
 IF vid IS NULL THEN RAISE EXCEPTION 'Active vendor owner required' USING ERRCODE='42501'; END IF;
 RETURN vid;
END $$;
CREATE FUNCTION private.current_vendor_assignment(p_vendor uuid,p_owner uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE required_id uuid; latest_id uuid;
BEGIN
 SELECT id INTO latest_id FROM private.vendor_legal_assignments WHERE vendor_id=p_vendor AND owner_id=p_owner
 AND effective_at<=now() ORDER BY effective_at DESC,id DESC LIMIT 1;
 SELECT id INTO required_id FROM private.vendor_legal_assignments WHERE vendor_id=p_vendor AND owner_id=p_owner
 AND effective_at<=now() AND change_basis<>'informational' ORDER BY effective_at DESC,id DESC LIMIT 1;
 -- An informational update must never hide an outstanding material acceptance.
 IF required_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM private.vendor_legal_acceptances
   WHERE assignment_id=required_id AND actor_id=p_owner) THEN RETURN required_id; END IF;
 RETURN latest_id;
END $$;
CREATE FUNCTION private.vendor_agreement_state() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE vid uuid:=private.agreement_vendor(); a private.vendor_legal_assignments%ROWTYPE;
 docs jsonb; history jsonb; accepted boolean; required boolean;
BEGIN
 SELECT * INTO a FROM private.vendor_legal_assignments WHERE id=private.current_vendor_assignment(vid,auth.uid());
 IF a.id IS NOT NULL THEN
   BEGIN docs:=private.vendor_assignment_documents(a.id);
   EXCEPTION WHEN SQLSTATE '40001' THEN docs:=NULL; END;
 END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY accepted_at DESC,id DESC),'[]') INTO history
 FROM private.vendor_legal_acceptances r WHERE vendor_id=vid AND actor_id=auth.uid();
 accepted:=EXISTS(SELECT 1 FROM private.vendor_legal_acceptances WHERE assignment_id=a.id AND actor_id=auth.uid());
 required:=a.id IS NOT NULL AND NOT accepted AND (a.change_basis<>'informational' OR NOT EXISTS(
 SELECT 1 FROM private.vendor_legal_acceptances WHERE vendor_id=vid AND actor_id=auth.uid() AND assignment_id IS NOT NULL));
 RETURN jsonb_build_object('vendorId',vid,'vendorStatus',(SELECT status FROM public.vendors WHERE id=vid),
 'businessReady',EXISTS(SELECT 1 FROM private.commercial_settings) AND private.commercial_business_ready(),
 'enabled',coalesce((SELECT vendor_clickwrap_enabled FROM private.commercial_settings),false),
 'assignment',CASE WHEN a.id IS NOT NULL THEN jsonb_build_object('id',a.id,'effectiveAt',a.effective_at,
 'changeBasis',a.change_basis,'documents',docs) END,'requiresAcceptance',required,'accepted',accepted,'history',history,
 'upcoming',(SELECT jsonb_build_object('effectiveAt',effective_at,'changeBasis',change_basis) FROM private.vendor_legal_assignments
 WHERE vendor_id=vid AND owner_id=auth.uid() AND effective_at>now() ORDER BY effective_at LIMIT 1));
END $$;
CREATE FUNCTION public.get_vendor_agreement_state() RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.vendor_agreement_state() $$;

CREATE FUNCTION private.accept_assigned_vendor_agreement(p_assignment uuid,p_acknowledged boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE vid uuid; a private.vendor_legal_assignments%ROWTYPE; docs jsonb; rid uuid;
BEGIN
 vid:=private.agreement_vendor();
 -- Lock ownership/account before the legal lock, matching activation's vendor-
 -- then-legal order. A concurrent transfer/suspension cannot change the signer
 -- association halfway through receipt creation.
 PERFORM 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id
 WHERE v.id=vid AND v.owner_id=auth.uid() AND p.vendor_id=vid
 FOR SHARE OF v,p;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active vendor owner required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 IF NOT coalesce((SELECT vendor_clickwrap_enabled FROM private.commercial_settings),false) THEN
   RAISE EXCEPTION 'Agreement acceptance is not yet available' USING ERRCODE='42501'; END IF;
 IF p_acknowledged IS DISTINCT FROM true THEN RAISE EXCEPTION 'Express acknowledgement required' USING ERRCODE='22023'; END IF;
 IF p_assignment IS DISTINCT FROM private.current_vendor_assignment(vid,auth.uid()) THEN
   RAISE EXCEPTION 'Agreement changed. Reload and review the current documents' USING ERRCODE='40001'; END IF;
 SELECT * INTO a FROM private.vendor_legal_assignments WHERE id=p_assignment;
 docs:=private.vendor_assignment_documents(a.id);
 IF NOT private.commercial_business_ready() THEN RAISE EXCEPTION 'Approved business disclosures required'; END IF;
 -- Return the original receipt on retries, including a lost HTTP response.
 SELECT id INTO rid FROM private.vendor_legal_acceptances WHERE assignment_id=a.id AND actor_id=auth.uid();
 IF rid IS NULL THEN
   IF a.change_basis='informational' AND EXISTS(SELECT 1 FROM private.vendor_legal_acceptances
     WHERE vendor_id=vid AND actor_id=auth.uid() AND assignment_id IS NOT NULL) THEN
     RAISE EXCEPTION 'This update does not require new acceptance'; END IF;
   INSERT INTO private.vendor_legal_acceptances(vendor_id,actor_id,documents,fee_version,acknowledgements,method,
     assignment_id,acknowledgement_text,signer_name)
   VALUES(vid,auth.uid(),docs,docs->'vendor-fees'->>'version','[true]','authenticated',a.id,
     'I have read, understand and agree to the Vendor Agreement, Commercial Fee Schedule and Vendor Operating Standards. I have reviewed Privacy and Refunds. I am authorised to accept on behalf of this vendor.',
     (SELECT name FROM public.profiles WHERE id=auth.uid())) RETURNING id INTO rid;
 END IF;
 RETURN (SELECT to_jsonb(r) FROM private.vendor_legal_acceptances r WHERE id=rid);
END $$;
CREATE FUNCTION public.accept_assigned_vendor_agreement(p_assignment uuid,p_acknowledged boolean) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.accept_assigned_vendor_agreement(p_assignment,p_acknowledged) $$;
-- Old evidence remains readable. No generic-document route may bypass assignment.
CREATE OR REPLACE FUNCTION private.accept_vendor_legal(p_vendor uuid,p_documents jsonb,p_ack jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Use the assigned vendor agreement review' USING ERRCODE='42501'; END $$;

-- Preserve every Phase B prerequisite. Only assigned-receipt validation changes.
ALTER FUNCTION private.vendor_activation_ready(uuid,uuid) RENAME TO vendor_activation_ready_phase_b;
CREATE FUNCTION private.vendor_activation_ready(p_vendor uuid,p_owner uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r private.vendor_activation_reviews%ROWTYPE; a private.vendor_legal_acceptances%ROWTYPE;
 current_a private.vendor_legal_assignments%ROWTYPE; bank_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 SELECT * INTO current_a FROM private.vendor_legal_assignments WHERE id=private.current_vendor_assignment(p_vendor,p_owner);
 SELECT * INTO r FROM private.vendor_activation_reviews WHERE vendor_id=p_vendor ORDER BY reviewed_at DESC,id DESC LIMIT 1;
 SELECT * INTO a FROM private.vendor_legal_acceptances WHERE id=r.acceptance_id;
 -- Enrolled vendors must have assigned, vendor-specific evidence. Legacy generic
 -- consent remains archived but cannot substitute for a Phase C contract.
 -- Unenrolled legacy vendors retain Phase B's existing trigger compatibility.
 IF a.assignment_id IS NULL THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.commercial_settings) OR NOT private.commercial_business_ready() OR current_a.id IS NULL OR (current_a.change_basis<>'informational' AND a.assignment_id<>current_a.id)
 OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
   WHERE p.id=p_owner AND p.role='vendor' AND p.vendor_id=p_vendor AND NOT p.suspended AND p.deleted_at IS NULL)
 OR r.owner_id IS DISTINCT FROM p_owner OR r.compliance_valid_until<=clock_timestamp()
 OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
   WHERE p.id=r.reviewed_by AND p.role='admin' AND NOT p.suspended AND p.deleted_at IS NULL)
 OR a.assignment_id IS DISTINCT FROM (SELECT id FROM private.vendor_legal_assignments WHERE vendor_id=p_vendor AND owner_id=p_owner
   AND effective_at<=now() AND change_basis<>'informational' ORDER BY effective_at DESC,id DESC LIMIT 1)
 OR a.vendor_id IS DISTINCT FROM p_vendor OR a.actor_id IS DISTINCT FROM p_owner OR a.method<>'authenticated'
 OR a.documents IS DISTINCT FROM private.vendor_assignment_documents(a.assignment_id)
 OR a.documents->'vendor-fees'->>'content_hash' IS DISTINCT FROM r.schedules_hash
 THEN RETURN false; END IF;
 SELECT id INTO bank_id FROM private.vendor_payment_profiles WHERE vendor_id=p_vendor
 AND approved_at IS NOT NULL AND approved_by IS NOT NULL AND approved_by<>p_owner AND approved_by<>submitted_by
 AND length(trim(verification_evidence))>=15 ORDER BY approved_at DESC,id DESC LIMIT 1;
 RETURN coalesce(bank_id=r.payment_profile_id,false);
END $$;
REVOKE ALL ON FUNCTION private.vendor_assignment_documents(uuid),private.guard_vendor_assignment(),private.check_vendor_assignment(),
 private.agreement_vendor(),private.current_vendor_assignment(uuid,uuid),private.vendor_activation_ready(uuid,uuid),
 private.vendor_activation_ready_phase_b(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.vendor_agreement_state(),public.get_vendor_agreement_state(),
 private.accept_assigned_vendor_agreement(uuid,boolean),public.accept_assigned_vendor_agreement(uuid,boolean)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.vendor_agreement_state(),public.get_vendor_agreement_state(),
 private.accept_assigned_vendor_agreement(uuid,boolean),public.accept_assigned_vendor_agreement(uuid,boolean) TO authenticated;
-- No assignments, legal text, review evidence or acceptances are inserted. Rollout stays OFF.


-- Source: 20261026101346_phase_d_vendor_compliance.sql
-- Phase D LOCAL CANDIDATE, after B/C. No rollout, legal publication or gateway changes.

SET LOCAL lock_timeout='10s';
CREATE TABLE private.vendor_compliance_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 owner_id uuid NOT NULL REFERENCES public.profiles(id), kind text NOT NULL CHECK(kind IN('identity','food_premises','coa','operations')),
 note text NOT NULL CHECK(length(trim(note)) BETWEEN 5 AND 1000),
 object_path text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.vendor_compliance_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 vendor_id uuid NOT NULL REFERENCES public.vendors(id), owner_id uuid NOT NULL REFERENCES public.profiles(id),
 kind text NOT NULL CHECK(kind IN('identity','food_premises','coa','operations','bank','assignment','administration')),
 subject_id uuid, status text NOT NULL CHECK(status IN('submitted','verified','rejected','revoked','not_required','assigned','reviewed','activated','suspended','enrolled','legacy_approved','pending')),
 actor_id uuid NOT NULL REFERENCES public.profiles(id), at timestamptz NOT NULL DEFAULT clock_timestamp(),
 valid_until timestamptz, reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 5 AND 1000), snapshot jsonb NOT NULL DEFAULT '{}',
 transaction_id bigint NOT NULL DEFAULT txid_current(),
 CHECK(status NOT IN('verified','not_required') OR (valid_until IS NOT NULL AND valid_until>at)),
 CHECK(status<>'not_required' OR kind='coa')
);
CREATE INDEX compliance_event_latest ON private.vendor_compliance_events(vendor_id,owner_id,kind,sequence DESC);
ALTER TABLE private.vendor_activation_reviews ADD COLUMN compliance_event_ids jsonb NOT NULL DEFAULT '{}';
ALTER TABLE private.vendor_compliance_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.vendor_compliance_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.vendor_compliance_submissions,private.vendor_compliance_events FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON SEQUENCE private.vendor_compliance_events_sequence_seq FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER compliance_submission_immutable BEFORE UPDATE OR DELETE ON private.vendor_compliance_submissions FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
CREATE TRIGGER compliance_events_immutable BEFORE UPDATE OR DELETE ON private.vendor_compliance_events FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();

CREATE FUNCTION private.compliance_access(p_vendor uuid,p_admin boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND private.active_account() AND
 (private.is_admin() OR (NOT p_admin AND EXISTS(SELECT 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id
 WHERE v.id=p_vendor AND v.owner_id=auth.uid() AND p.role='vendor' AND p.vendor_id=v.id
 AND v.status IN('pending','approved') AND v.archived_at IS NULL)))
$$;
CREATE FUNCTION private.compliance_storage_access(p_name text,p_write boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.vendor_compliance_submissions s JOIN public.vendors v ON v.id=s.vendor_id
 WHERE s.object_path=p_name AND private.compliance_access(s.vendor_id) AND
 (NOT p_write OR (s.owner_id=auth.uid() AND v.owner_id=auth.uid() AND NOT EXISTS(
 SELECT 1 FROM private.vendor_compliance_events e WHERE e.subject_id=s.id))))
$$;
CREATE FUNCTION private.reserve_vendor_evidence(p_kind text,p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE vid uuid:=private.agreement_vendor(); sid uuid:=gen_random_uuid(); path text;
BEGIN
 PERFORM 1 FROM public.vendors WHERE id=vid FOR UPDATE;
 path:=vid::text||'/'||sid::text||'/evidence';
 INSERT INTO private.vendor_compliance_submissions(id,vendor_id,owner_id,kind,note,object_path)
 VALUES(sid,vid,auth.uid(),p_kind,p_note,path);
 RETURN jsonb_build_object('id',sid,'path',path,'bucket','vendor-compliance');
END $$;
CREATE FUNCTION public.reserve_vendor_evidence(p_kind text,p_note text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.reserve_vendor_evidence(p_kind,p_note) $$;
CREATE FUNCTION private.finalize_vendor_evidence(p_submission uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.vendor_compliance_submissions%ROWTYPE; o storage.objects%ROWTYPE;
BEGIN
 SELECT * INTO STRICT s FROM private.vendor_compliance_submissions WHERE id=p_submission;
 IF NOT private.compliance_access(s.vendor_id) OR s.owner_id<>auth.uid() THEN RAISE EXCEPTION 'Vendor evidence ownership required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.vendors WHERE id=s.vendor_id AND owner_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vendor ownership changed'; END IF;
 IF EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE subject_id=s.id AND status='submitted') THEN RETURN; END IF;
 SELECT * INTO o FROM storage.objects WHERE bucket_id='vendor-compliance' AND name=s.object_path;
 IF o.id IS NULL OR coalesce(o.metadata->>'mimetype','') NOT IN('application/pdf','image/jpeg','image/png')
 OR coalesce(o.metadata->>'size','') !~ '^[0-9]{1,8}$' THEN RAISE EXCEPTION 'Private PDF/JPEG/PNG upload required'; END IF;
 IF (o.metadata->>'size')::bigint NOT BETWEEN 1 AND 5242880 THEN RAISE EXCEPTION 'Evidence must be at most 5MB'; END IF;
 INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,reason,snapshot)
 VALUES(s.vendor_id,s.owner_id,s.kind,s.id,'submitted',auth.uid(),s.note,jsonb_build_object('objectId',o.id,'metadata',o.metadata,'path',s.object_path));
END $$;
CREATE FUNCTION public.finalize_vendor_evidence(p_submission uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.finalize_vendor_evidence(p_submission) $$;

-- Only submission authorization changes. manual_operator/receipt verification stay approved-only.
CREATE OR REPLACE FUNCTION public.submit_vendor_payment_profile(p_vendor_id uuid,p_destination jsonb,p_eft boolean,p_payshap boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result uuid;d jsonb;
BEGIN
 IF NOT private.compliance_access(p_vendor_id) THEN RAISE EXCEPTION 'Vendor ownership required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.vendors WHERE id=p_vendor_id FOR UPDATE;
 d:=jsonb_build_object('accountHolder',btrim(p_destination->>'accountHolder'),'bank',btrim(p_destination->>'bank'),'accountNumber',btrim(p_destination->>'accountNumber'),'accountType',btrim(p_destination->>'accountType'),'branchCode',btrim(p_destination->>'branchCode'),'shapId',btrim(p_destination->>'shapId'));
 IF length(coalesce(d->>'accountHolder','')) NOT BETWEEN 2 AND 150 OR length(coalesce(d->>'bank','')) NOT BETWEEN 2 AND 100 OR NOT (p_eft OR p_payshap) OR p_eft IS NULL OR p_payshap IS NULL THEN RAISE EXCEPTION 'Recipient, bank and supported payment method required';END IF;
 IF p_eft AND (coalesce(d->>'accountNumber','') !~ '^[0-9]{6,20}$' OR coalesce(d->>'branchCode','') !~ '^[0-9]{6}$' OR length(coalesce(d->>'accountType','')) NOT BETWEEN 2 AND 50) THEN RAISE EXCEPTION 'Valid EFT account, branch code and account type required';END IF;
 IF p_payshap AND length(coalesce(d->>'shapId','')) NOT BETWEEN 3 AND 150 THEN RAISE EXCEPTION 'Registered ShapID required';END IF;
 INSERT INTO private.vendor_payment_profiles(vendor_id,destination,eft,payshap,submitted_by) VALUES(p_vendor_id,d,p_eft,p_payshap,auth.uid()) RETURNING id INTO result;
 INSERT INTO private.manual_payment_events(profile_id,actor_id,action,note) VALUES(result,auth.uid(),'profile_submitted','New version pending independent recipient and bank capability verification');
 RETURN result;
END $$;

CREATE FUNCTION private.latest_compliance_events(p_vendor uuid,p_owner uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(kind,to_jsonb(e)),'{}') FROM
 (SELECT DISTINCT ON(kind) * FROM private.vendor_compliance_events WHERE vendor_id=p_vendor AND owner_id=p_owner
 AND kind IN('identity','food_premises','coa','operations','bank') ORDER BY kind,sequence DESC) e
$$;
CREATE FUNCTION private.bank_compliance_valid(p_vendor uuid,p_profile uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT e.subject_id=p_profile AND e.status='verified' AND e.valid_until>clock_timestamp()
 FROM private.vendor_compliance_events e JOIN public.vendors v ON v.id=e.vendor_id AND v.owner_id=e.owner_id
 WHERE e.vendor_id=p_vendor AND e.kind='bank' ORDER BY e.sequence DESC LIMIT 1),false)
$$;
ALTER FUNCTION private.vendor_assignment_documents(uuid) RENAME TO vendor_assignment_documents_phase_c;
CREATE FUNCTION private.vendor_assignment_documents(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE kind='assignment' AND subject_id=p_id AND status='revoked')
 THEN RAISE EXCEPTION 'Agreement assignment revoked; approved replacement required' USING ERRCODE='40001'; END IF;
 RETURN private.vendor_assignment_documents_phase_c(p_id);
END $$;
ALTER FUNCTION private.vendor_activation_ready(uuid,uuid) RENAME TO vendor_activation_ready_phase_c;
CREATE FUNCTION private.vendor_activation_ready(p_vendor uuid,p_owner uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r private.vendor_activation_reviews%ROWTYPE; events jsonb; k text; e jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 SELECT * INTO r FROM private.vendor_activation_reviews WHERE vendor_id=p_vendor ORDER BY reviewed_at DESC,id DESC LIMIT 1;
 events:=private.latest_compliance_events(p_vendor,p_owner);
 FOREACH k IN ARRAY ARRAY['identity','food_premises','coa','operations','bank'] LOOP
  e:=events->k;
  IF e IS NULL OR e->>'id' IS DISTINCT FROM r.compliance_event_ids->>k
  OR (e->>'status'<>'verified' AND NOT(k='coa' AND e->>'status'='not_required'))
  OR (e->>'valid_until')::timestamptz<=clock_timestamp() OR e->>'valid_until' IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE p.id=(e->>'actor_id')::uuid AND p.role='admin' AND NOT p.suspended AND p.deleted_at IS NULL)
  OR (e->>'actor_id')::uuid=p_owner THEN RETURN false; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE kind='assignment' AND status='revoked' AND subject_id=(SELECT assignment_id FROM private.vendor_legal_acceptances WHERE id=r.acceptance_id)) THEN RETURN false; END IF;
 IF NOT private.bank_compliance_valid(p_vendor,r.payment_profile_id) THEN RETURN false; END IF;
 RETURN private.vendor_activation_ready_phase_c(p_vendor,p_owner);
EXCEPTION WHEN SQLSTATE '40001' THEN RETURN false;
END $$;
-- Revoked/expired evidence stops NEW enrolled-vendor orders, never rewrites confirmed ones.
CREATE FUNCTION private.compliance_new_order_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE owner uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=NEW.vendor_id) THEN
  SELECT owner_id INTO owner FROM public.vendors WHERE id=NEW.vendor_id FOR SHARE;
  IF NOT private.vendor_activation_ready(NEW.vendor_id,owner) THEN RAISE EXCEPTION 'Vendor compliance requires review; new ordering unavailable'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER compliance_new_order BEFORE INSERT ON public.order_suborders FOR EACH ROW EXECUTE FUNCTION private.compliance_new_order_guard();
-- A legacy exception needs an explicit, audited approval in this SAME transaction.
CREATE FUNCTION private.compliance_legacy_approval_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='approved' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.owner_id IS DISTINCT FROM NEW.owner_id)
 AND NOT EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE vendor_id=NEW.id AND owner_id=NEW.owner_id
 AND status=CASE WHEN EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=NEW.id) THEN 'activated' ELSE 'legacy_approved' END AND actor_id=auth.uid() AND transaction_id=txid_current()
 AND snapshot->>'fromStatus'=OLD.status::text) THEN
 RAISE EXCEPTION 'Explicit audited existing-vendor transition approval required' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER compliance_legacy_approval BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION private.compliance_legacy_approval_guard();

CREATE FUNCTION private.vendor_compliance_state(p_vendor uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.vendors%ROWTYPE; admin boolean; events jsonb; enrolled boolean; ready boolean; assignment uuid; accepted boolean; assignment_valid boolean:=false; workflow text;
BEGIN
 IF NOT private.compliance_access(p_vendor) THEN RAISE EXCEPTION 'Vendor owner or active administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT v FROM public.vendors WHERE id=p_vendor;
 admin:=private.is_admin(); events:=private.latest_compliance_events(v.id,v.owner_id);
 enrolled:=EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=v.id);
 assignment:=private.current_vendor_assignment(v.id,v.owner_id);
 accepted:=EXISTS(SELECT 1 FROM private.vendor_legal_acceptances a JOIN private.vendor_legal_assignments d ON d.id=a.assignment_id
 WHERE a.vendor_id=v.id AND a.actor_id=v.owner_id AND d.change_basis<>'informational'
 AND d.id=(SELECT id FROM private.vendor_legal_assignments WHERE vendor_id=v.id AND owner_id=v.owner_id
 AND effective_at<=now() AND change_basis<>'informational' ORDER BY effective_at DESC,id DESC LIMIT 1));
 IF assignment IS NOT NULL THEN BEGIN PERFORM private.vendor_assignment_documents(assignment); assignment_valid:=true; EXCEPTION WHEN SQLSTATE '40001' THEN assignment_valid:=false; END; END IF;
 ready:=enrolled AND private.vendor_activation_ready(v.id,v.owner_id);
 workflow:=CASE WHEN v.status='suspended' THEN 'suspended' WHEN v.status='approved' AND (ready OR NOT enrolled) THEN 'approved'
 WHEN assignment IS NULL THEN 'pending documents' WHEN NOT accepted THEN 'awaiting vendor acceptance'
 WHEN ready THEN 'ready for approval' ELSE 'verification required' END;
 RETURN jsonb_build_object('admin',admin,'vendor',jsonb_build_object('id',v.id,'name',v.name,'status',v.status,'ownerId',v.owner_id,'archived',v.archived_at IS NOT NULL),
 'enrolled',enrolled,'legacyException',NOT enrolled,'ready',ready,'workflow',workflow,'accepted',accepted,'assignmentValid',assignment_valid,'events',events,
 'submissions',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY created_at DESC),'[]') FROM private.vendor_compliance_submissions s WHERE vendor_id=v.id),
 'bankHistory',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC),'[]') FROM private.manual_payment_events e JOIN private.vendor_payment_profiles p ON p.id=e.profile_id WHERE p.vendor_id=v.id),
 'bankProfiles',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY created_at DESC),'[]') FROM private.vendor_payment_profiles p WHERE vendor_id=v.id),
 'assignments',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY effective_at DESC),'[]') FROM private.vendor_legal_assignments a WHERE vendor_id=v.id),
 'documents',CASE WHEN admin THEN (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY kind,created_at DESC),'[]') FROM private.legal_versions d
 WHERE approved_at IS NOT NULL AND kind IN('vendor-agreement','vendor-fees','vendor-standards','privacy','refund-policy') AND (vendor_id IS NULL OR vendor_id=v.id)) ELSE '[]'::jsonb END,
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY sequence DESC),'[]') FROM private.vendor_compliance_events e WHERE vendor_id=v.id));
END $$;
CREATE FUNCTION public.get_vendor_compliance(p_vendor uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.vendor_compliance_state(p_vendor) $$;

CREATE FUNCTION private.admin_vendor_compliance(p_vendor uuid,p_action text,p_value jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.vendors%ROWTYPE; s private.vendor_compliance_submissions%ROWTYPE; a private.vendor_legal_assignments%ROWTYPE;
 bank private.vendor_payment_profiles%ROWTYPE; receipt private.vendor_legal_acceptances%ROWTYPE;
 reason text:=trim(p_value->>'reason'); subject uuid:=nullif(p_value->>'id','')::uuid; expiry timestamptz;
 events jsonb; evidence jsonb:='{}'; k text; e jsonb; until_at timestamptz; rid uuid; next_status public.vendor_status;
BEGIN
 IF NOT private.compliance_access(p_vendor,true) THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT v FROM public.vendors WHERE id=p_vendor FOR UPDATE;
 IF v.owner_id=auth.uid() THEN RAISE EXCEPTION 'Independent administrator required; no self-approval' USING ERRCODE='42501'; END IF;
 IF p_value ? 'expectedStatus' AND p_value->>'expectedStatus' IS DISTINCT FROM v.status::text THEN RAISE EXCEPTION 'Vendor status changed; reload before reviewing' USING ERRCODE='40001'; END IF;
 IF v.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Archived vendor cannot be reviewed'; END IF;
 IF length(coalesce(reason,'')) NOT BETWEEN 15 AND 1000 THEN RAISE EXCEPTION 'Documented review reason or approval reference required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 IF p_action IN('verify','waive_coa','verify_bank') THEN
  expiry:=(p_value->>'validUntil')::timestamptz;
  IF expiry IS NULL OR expiry<=clock_timestamp() THEN RAISE EXCEPTION 'Future verification expiry required'; END IF;
 END IF;
 CASE p_action
 WHEN 'assign' THEN
  INSERT INTO private.vendor_legal_assignments(vendor_id,owner_id,agreement_id,schedule_id,standards_id,privacy_id,refunds_id,change_basis,approval_reference,notified_at,effective_at,approved_by)
  VALUES(v.id,v.owner_id,(p_value->>'agreement')::uuid,(p_value->>'schedule')::uuid,(p_value->>'standards')::uuid,
    (p_value->>'privacy')::uuid,(p_value->>'refunds')::uuid,p_value->>'changeBasis',reason,(p_value->>'notifiedAt')::timestamptz,(p_value->>'effectiveAt')::timestamptz,auth.uid()) RETURNING * INTO a;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,reason,snapshot)
  VALUES(v.id,v.owner_id,'assignment',a.id,'assigned',auth.uid(),reason,jsonb_build_object('assignment',to_jsonb(a),'documents',private.vendor_assignment_documents(a.id)));
 WHEN 'verify','reject','revoke' THEN
  SELECT * INTO STRICT s FROM private.vendor_compliance_submissions WHERE id=subject AND vendor_id=v.id AND owner_id=v.owner_id;
  IF NOT EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE subject_id=s.id AND status='submitted') THEN RAISE EXCEPTION 'Uploaded and submitted evidence required'; END IF;
  IF p_action='verify' AND EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE subject_id=subject AND status='revoked') THEN RAISE EXCEPTION 'Revoked evidence requires a new submission'; END IF;
  IF p_action<>'revoke' AND subject IS DISTINCT FROM (SELECT subject_id FROM private.vendor_compliance_events WHERE vendor_id=v.id AND owner_id=v.owner_id AND kind=s.kind AND status='submitted' ORDER BY sequence DESC LIMIT 1) THEN RAISE EXCEPTION 'Review the latest submitted evidence'; END IF;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,valid_until,reason,snapshot)
  VALUES(v.id,v.owner_id,s.kind,s.id,CASE p_action WHEN 'verify' THEN 'verified' WHEN 'reject' THEN 'rejected' ELSE 'revoked' END,auth.uid(),expiry,reason,
    (SELECT snapshot FROM private.vendor_compliance_events WHERE subject_id=s.id AND status='submitted' ORDER BY sequence DESC LIMIT 1));
 WHEN 'waive_coa' THEN
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,status,actor_id,valid_until,reason)
  VALUES(v.id,v.owner_id,'coa','not_required',auth.uid(),expiry,reason);
 WHEN 'verify_bank','revoke_bank' THEN
  SELECT * INTO STRICT bank FROM private.vendor_payment_profiles WHERE id=subject AND vendor_id=v.id;
  IF bank.submitted_by=auth.uid() THEN RAISE EXCEPTION 'Independent bank reviewer required'; END IF;
  IF p_action='verify_bank' THEN
    IF EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE kind='bank' AND subject_id=subject AND status='revoked') THEN RAISE EXCEPTION 'Revoked banking requires a new profile version'; END IF;
    IF subject IS DISTINCT FROM (SELECT id FROM private.vendor_payment_profiles WHERE vendor_id=v.id ORDER BY created_at DESC,id DESC LIMIT 1) THEN RAISE EXCEPTION 'Review the latest submitted banking version'; END IF;
    PERFORM public.approve_vendor_payment_profile(subject,reason);
  END IF;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,valid_until,reason)
  VALUES(v.id,v.owner_id,'bank',subject,CASE WHEN p_action='verify_bank' THEN 'verified' ELSE 'revoked' END,auth.uid(),expiry,reason);
 WHEN 'revoke_assignment' THEN
  IF NOT EXISTS(SELECT 1 FROM private.vendor_legal_assignments WHERE id=subject AND vendor_id=v.id) THEN RAISE EXCEPTION 'Vendor-specific assignment required'; END IF;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,reason)
  VALUES(v.id,v.owner_id,'assignment',subject,'revoked',auth.uid(),reason);
 WHEN 'enroll' THEN
  IF coalesce((p_value->>'confirm')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Explicit transition confirmation required'; END IF;
  INSERT INTO private.vendor_activation_requirements(vendor_id,owner_id) VALUES(v.id,v.owner_id) ON CONFLICT(vendor_id) DO NOTHING;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,status,actor_id,reason) VALUES(v.id,v.owner_id,'administration','enrolled',auth.uid(),reason);
 WHEN 'complete_review' THEN
  IF NOT EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=v.id) THEN RAISE EXCEPTION 'Explicitly enroll this existing vendor before strict review'; END IF;
  events:=private.latest_compliance_events(v.id,v.owner_id);
  FOREACH k IN ARRAY ARRAY['identity','food_premises','coa','operations','bank'] LOOP
   e:=events->k;
   IF e IS NULL OR (e->>'status'<>'verified' AND NOT(k='coa' AND e->>'status'='not_required')) OR e->>'valid_until' IS NULL OR (e->>'valid_until')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'Current verified evidence required: %',k; END IF;
   evidence:=evidence||jsonb_build_object(k,e->>'id'); until_at:=least(until_at,(e->>'valid_until')::timestamptz);
  END LOOP;
  SELECT r.* INTO receipt FROM private.vendor_legal_acceptances r JOIN private.vendor_legal_assignments d ON d.id=r.assignment_id
   WHERE r.vendor_id=v.id AND r.actor_id=v.owner_id AND d.id=(SELECT id FROM private.vendor_legal_assignments WHERE vendor_id=v.id AND owner_id=v.owner_id AND effective_at<=now() AND change_basis<>'informational' ORDER BY effective_at DESC,id DESC LIMIT 1);
  IF receipt.id IS NULL THEN RAISE EXCEPTION 'Current vendor agreement acceptance required'; END IF;
  INSERT INTO private.vendor_activation_reviews(vendor_id,owner_id,acceptance_id,payment_profile_id,compliance_reference,compliance_valid_until,schedules_reference,schedules_hash,reviewed_by,compliance_event_ids)
  VALUES(v.id,v.owner_id,receipt.id,(events->'bank'->>'subject_id')::uuid,'Verified evidence event IDs: '||evidence::text,until_at,reason,receipt.documents->'vendor-fees'->>'content_hash',auth.uid(),evidence) RETURNING id INTO rid;
  IF NOT private.vendor_activation_ready(v.id,v.owner_id) THEN RAISE EXCEPTION 'Activation prerequisites are incomplete or revoked'; END IF;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,subject_id,status,actor_id,reason,snapshot)
  VALUES(v.id,v.owner_id,'administration',rid,'reviewed',auth.uid(),reason,evidence);
 WHEN 'activate' THEN
  IF v.status NOT IN('pending','suspended') THEN RAISE EXCEPTION 'Pending or suspended vendor required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=v.id) THEN
   IF coalesce((p_value->>'legacyAcknowledged')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'Explicit existing-vendor exception acknowledgement required'; END IF;
   INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,status,actor_id,reason,snapshot)
   VALUES(v.id,v.owner_id,'administration','legacy_approved',auth.uid(),reason,jsonb_build_object('fromStatus',v.status,'exception','pre-B unenrolled vendor'));
  ELSIF NOT private.vendor_activation_ready(v.id,v.owner_id) THEN RAISE EXCEPTION 'Verified activation prerequisites required'; END IF;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,status,actor_id,reason,snapshot) VALUES(v.id,v.owner_id,'administration','activated',auth.uid(),reason,jsonb_build_object('fromStatus',v.status));
  UPDATE public.vendors SET status='approved' WHERE id=v.id;
 WHEN 'suspend','request_changes' THEN
  next_status:=CASE WHEN p_action='suspend' THEN 'suspended'::public.vendor_status ELSE 'pending'::public.vendor_status END;
  UPDATE public.vendors SET status=next_status WHERE id=v.id;
  INSERT INTO private.vendor_compliance_events(vendor_id,owner_id,kind,status,actor_id,reason) VALUES(v.id,v.owner_id,'administration',next_status::text,auth.uid(),reason);
 ELSE RAISE EXCEPTION 'Unknown compliance action';
 END CASE;
 RETURN jsonb_build_object('saved',true);
END $$;
CREATE FUNCTION public.admin_vendor_compliance(p_vendor uuid,p_action text,p_value jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.admin_vendor_compliance(p_vendor,p_action,p_value) $$;

-- Never expose newly revoked banking instructions for new orders. No gateway flag changes.
ALTER FUNCTION public.get_vendor_manual_methods(uuid) RENAME TO get_vendor_manual_methods_phase_c;
CREATE FUNCTION public.get_vendor_manual_methods(p_vendor_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE bid uuid;
BEGIN
 SELECT id INTO bid FROM private.vendor_payment_profiles WHERE vendor_id=p_vendor_id AND approved_at IS NOT NULL ORDER BY approved_at DESC,id DESC LIMIT 1;
 IF EXISTS(SELECT 1 FROM private.vendor_compliance_events WHERE vendor_id=p_vendor_id AND kind='bank' AND subject_id=bid AND status='revoked')
 OR (EXISTS(SELECT 1 FROM private.vendor_activation_requirements WHERE vendor_id=p_vendor_id) AND NOT private.bank_compliance_valid(p_vendor_id,bid)) THEN RETURN '{}'::jsonb; END IF;
 RETURN public.get_vendor_manual_methods_phase_c(p_vendor_id);
END $$;
REVOKE ALL ON FUNCTION public.get_vendor_manual_methods_phase_c(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_vendor_manual_methods(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_vendor_manual_methods(uuid) TO anon,authenticated;
-- RPC-only access. RLS helpers return only a boolean and cannot mutate evidence.
REVOKE ALL ON FUNCTION private.compliance_access(uuid,boolean),private.compliance_storage_access(text,boolean),
 private.latest_compliance_events(uuid,uuid),private.bank_compliance_valid(uuid,uuid),private.vendor_assignment_documents(uuid),
 private.vendor_assignment_documents_phase_c(uuid),private.vendor_activation_ready(uuid,uuid),private.vendor_activation_ready_phase_c(uuid,uuid),
 private.compliance_new_order_guard(),private.compliance_legacy_approval_guard(),private.reserve_vendor_evidence(text,text),
 public.reserve_vendor_evidence(text,text),private.finalize_vendor_evidence(uuid),public.finalize_vendor_evidence(uuid),
 private.vendor_compliance_state(uuid),public.get_vendor_compliance(uuid),private.admin_vendor_compliance(uuid,text,jsonb),public.admin_vendor_compliance(uuid,text,jsonb)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.compliance_storage_access(text,boolean),private.compliance_access(uuid,boolean),
 private.reserve_vendor_evidence(text,text),public.reserve_vendor_evidence(text,text),private.finalize_vendor_evidence(uuid),public.finalize_vendor_evidence(uuid),
 private.vendor_compliance_state(uuid),public.get_vendor_compliance(uuid),private.admin_vendor_compliance(uuid,text,jsonb),public.admin_vendor_compliance(uuid,text,jsonb) TO authenticated;


-- Source: 20261026112602_phase_e_legal_publication_checkout_evidence.sql
-- Phase E LOCAL CANDIDATE. No publication, acceptance rollout, payment or marketing activation.

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


-- Narrow managed-owner dependency for defining scoped Storage policies.
-- Does not grant table access, application admin privileges, role membership or BYPASSRLS.
GRANT USAGE ON SCHEMA private TO supabase_storage_admin;
GRANT EXECUTE ON FUNCTION private.compliance_storage_access(text,boolean) TO supabase_storage_admin;

-- LOCAL REVIEW CANDIDATE ONLY, AFTER reconciled manual foundations and B/C/D/E.
-- Not standalone, not a production installer. No rows or activation flags changed.

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
 SELECT owner_id INTO owner FROM public.vendors WHERE id=p_vendor AND status='approved' AND archived_at IS NULL AND commission_rate=0.17;
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


ALTER TABLE private.manual_order_payments ADD COLUMN vendor_acceptance_id uuid REFERENCES private.vendor_legal_acceptances(id), ADD COLUMN fee_snapshot jsonb;
CREATE FUNCTION private.manual_contract_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rate numeric; receipt private.vendor_legal_acceptances%ROWTYPE;
BEGIN
 SELECT v.commission_rate INTO rate FROM public.vendors v WHERE v.id=NEW.vendor_id FOR SHARE;
 IF rate IS DISTINCT FROM 0.17 THEN RAISE EXCEPTION 'Reviewed 15 percent plus 2 percent launch fee basis required'; END IF;
 SELECT a.* INTO receipt FROM private.vendor_activation_reviews r JOIN private.vendor_legal_acceptances a ON a.id=r.acceptance_id
 JOIN public.vendors v ON v.id=r.vendor_id AND v.owner_id=r.owner_id
 WHERE r.vendor_id=NEW.vendor_id ORDER BY r.reviewed_at DESC,r.id DESC LIMIT 1;
 IF receipt.id IS NULL OR receipt.assignment_id IS NULL THEN RAISE EXCEPTION 'Assigned vendor contract receipt required'; END IF;
 NEW.vendor_acceptance_id:=receipt.id;
 NEW.fee_snapshot:=jsonb_build_object('platformRate',0.15,'transactionRate',0.02,'combinedRate',0.17,
 'feeVersion',receipt.documents->'vendor-fees'->>'version','scheduleHash',receipt.documents->'vendor-fees'->>'content_hash',
 'calculation','round(product subtotal * combinedRate, 2)','taxTreatment','unresolved; VAT not calculated','marketingEnabled',false);
 RETURN NEW;
END $$;
CREATE TRIGGER manual_contract_snapshot BEFORE INSERT ON private.manual_order_payments FOR EACH ROW EXECUTE FUNCTION private.manual_contract_snapshot();
CREATE TRIGGER manual_contract_immutable BEFORE UPDATE OF vendor_acceptance_id,fee_snapshot ON private.manual_order_payments FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();
REVOKE ALL ON FUNCTION private.manual_contract_snapshot() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.snapshot_paid_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF TG_OP='UPDATE' AND OLD.commission_amount IS NOT NULL AND (NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
  OR NEW.commission_rate_snapshot IS DISTINCT FROM OLD.commission_rate_snapshot OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
  OR NEW.paid_at IS DISTINCT FROM OLD.paid_at OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id OR NEW.payment_status IS DISTINCT FROM OLD.payment_status) THEN RAISE EXCEPTION 'Paid financial snapshots are immutable'; END IF;
 IF TG_OP='UPDATE' AND OLD.payment_status IS DISTINCT FROM 'paid' AND NEW.payment_status='paid' THEN
  SELECT coalesce((m.fee_snapshot->>'combinedRate')::numeric,v.commission_rate),v.name INTO NEW.commission_rate_snapshot,NEW.vendor_name_snapshot
 FROM public.vendors v LEFT JOIN private.manual_order_payments m ON m.order_id=NEW.order_id WHERE v.id=NEW.vendor_id FOR SHARE OF v;
  NEW.commission_amount:=round(NEW.subtotal*NEW.commission_rate_snapshot,2); NEW.paid_at:=clock_timestamp(); NEW.commission_evidence:='captured at verified paid transition';
 ELSIF TG_OP='INSERT' AND NEW.payment_status='paid' THEN RAISE EXCEPTION 'Create unpaid suborders; confirmation must perform the paid transition';
 ELSIF TG_OP='UPDATE' AND OLD.commission_amount IS NOT NULL AND (NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
  OR NEW.commission_rate_snapshot IS DISTINCT FROM OLD.commission_rate_snapshot OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
  OR NEW.paid_at IS DISTINCT FROM OLD.paid_at OR NEW.vendor_id IS DISTINCT FROM OLD.vendor_id) THEN RAISE EXCEPTION 'Paid financial snapshots are immutable'; END IF;
 RETURN NEW;
END $function$
;

-- Forward-only LOCAL REVIEW CANDIDATE. Not an automatic or approved hosted migration.
-- Requires the corrected singleton RPC; after EFT-only installation if that package
-- is chosen. Adding this first invalidates its frozen baseline/retry fingerprints.
-- The SQL marker is not project identity proof. Independent control-plane target
-- verification and explicit installation/configuration approvals remain mandatory.

SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF to_regprocedure('private.vendor_launch_ready(uuid)') IS NULL OR to_regclass('private.order_legal_acceptances') IS NULL
 OR EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled)
 THEN RAISE EXCEPTION 'Closed staging integrated foundation required'; END IF;
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed postgres ownership required'; END IF;
 IF strpos(pg_get_functiondef('public.admin_manual_settings(boolean,boolean,integer,numeric,text)'::regprocedure),'updated_rows')=0
 THEN RAISE EXCEPTION 'Corrected singleton RPC prerequisite missing'; END IF;
END $$;

ALTER TABLE private.manual_payment_settings ADD COLUMN revision bigint NOT NULL DEFAULT 0 CHECK(revision>=0);
CREATE FUNCTION private.manual_settings_revision_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.revision:=OLD.revision+1;
 RETURN NEW;
END $$;
CREATE TRIGGER manual_settings_revision BEFORE UPDATE ON private.manual_payment_settings
 FOR EACH ROW EXECUTE FUNCTION private.manual_settings_revision_guard();
REVOKE ALL ON FUNCTION private.manual_settings_revision_guard() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.manual_settings_revision() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT md5(jsonb_build_object('settings',(SELECT to_jsonb(s) FROM private.manual_payment_settings s WHERE singleton),
 'gateways',(SELECT jsonb_agg(to_jsonb(g) ORDER BY provider) FROM private.gateway_settings g WHERE provider IN('manual_eft','manual_payshap')))::text)
$$;
REVOKE ALL ON FUNCTION private.manual_settings_revision() FROM PUBLIC,anon,authenticated,service_role;

ALTER FUNCTION public.manual_payment_workspace(boolean) RENAME TO manual_payment_workspace_before_checked_settings;
REVOKE ALL ON FUNCTION public.manual_payment_workspace_before_checked_settings(boolean) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.manual_payment_workspace(p_test_only boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 -- Original identity/role/scope checks remain authoritative.
 result:=public.manual_payment_workspace_before_checked_settings(p_test_only);
 IF private.is_admin() THEN result:=jsonb_set(result,'{settings,settings_revision}',to_jsonb(private.manual_settings_revision())); END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.manual_payment_workspace(boolean) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.manual_payment_workspace(boolean) TO authenticated,service_role;

CREATE FUNCTION public.admin_manual_settings_checked(p_eft boolean,p_payshap boolean,p_minutes integer,p_threshold numeric,p_reason text,p_expected_revision text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT private.active_account() OR NOT private.is_admin() THEN RAISE EXCEPTION 'Active administrator required' USING ERRCODE='42501'; END IF;
 IF p_eft IS NULL OR p_payshap IS NULL OR p_minutes IS NULL OR p_minutes NOT BETWEEN 5 AND 60
 OR p_threshold IS NULL OR p_threshold<=0 OR p_threshold::text IN('NaN','Infinity','-Infinity')
 OR p_threshold<>round(p_threshold,2) OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 10 AND 500
 THEN RAISE EXCEPTION 'Valid manual settings and reason required' USING ERRCODE='22023'; END IF;
 -- Same order as legacy setter: settings, then the manual gateway rows.
 PERFORM 1 FROM private.manual_payment_settings WHERE singleton FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Manual settings singleton missing'; END IF;
 PERFORM 1 FROM private.gateway_settings WHERE provider IN('manual_eft','manual_payshap') ORDER BY provider FOR UPDATE;
 IF p_expected_revision IS NULL OR p_expected_revision IS DISTINCT FROM private.manual_settings_revision()
 THEN RAISE EXCEPTION 'Settings changed; reload and review' USING ERRCODE='40001'; END IF;
 -- Reuse original active-admin, singleton, audit and collection activation guards.
 PERFORM public.admin_manual_settings(p_eft,p_payshap,p_minutes,p_threshold,btrim(p_reason));
END $$;
REVOKE ALL ON FUNCTION public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text) TO authenticated;
-- No gateway invocation, actors, banking, publication or settings value update here.


COMMIT;$artifact_094bb368b642668e$]);
COMMIT;