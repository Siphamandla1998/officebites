-- Phase B LOCAL CANDIDATE. No publication, acceptance rollout or gateway activation.
-- Dependencies: legal_corporate_framework + vendor_direct_manual_payments.
BEGIN;
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
COMMIT;

