-- Production legal foundation, additive only. No historical acceptance/backfill.
-- Leaves business disclosures incomplete until an administrator enters verified information.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(hashtextextended('officebites-production-legal-foundation-20261028',0));
DO $preflight$
BEGIN
 IF to_regclass('public.profiles') IS NULL
 OR to_regclass('public.vendors') IS NULL
 OR to_regclass('public.orders') IS NULL
 OR to_regclass('public.order_suborders') IS NULL
 OR to_regclass('public.payout_allocations') IS NULL
 OR to_regprocedure('private.is_admin()') IS NULL
 THEN RAISE EXCEPTION 'Required production base schema missing; no legal changes applied'; END IF;
 IF to_regclass('private.commercial_settings') IS NOT NULL
 OR to_regclass('private.legal_versions') IS NOT NULL
 OR to_regclass('private.vendor_legal_acceptances') IS NOT NULL
 OR to_regclass('private.vendor_consent_intents') IS NOT NULL
 OR to_regclass('private.corporate_accounts') IS NOT NULL
 OR to_regclass('private.acquisition_ledger') IS NOT NULL
 OR to_regprocedure('public.get_legal_portal()') IS NOT NULL
 OR to_regprocedure('public.get_commercial_workspace()') IS NOT NULL
 THEN RAISE EXCEPTION 'Existing or partial legal foundation detected; reconcile before retry'; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('standard_contract_insert','standard_contract_paid','vendor_legal_application','acquisition_completed','corporate_settlement_hold'))
 THEN RAISE EXCEPTION 'Legal foundation trigger already exists; reconcile before retry'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_suborders' AND column_name='delivery_snapshot')
 THEN RAISE EXCEPTION 'delivery_snapshot already exists; reconcile column ownership before retry'; END IF;
END
$preflight$;
CREATE TEMP TABLE officebites_legal_foundation_baseline ON COMMIT DROP AS
SELECT
 (SELECT count(*) FROM public.orders) AS orders,
 (SELECT count(*) FROM public.order_suborders) AS suborders,
 (SELECT count(*) FROM public.vendors) AS vendors,
 (SELECT count(*) FROM public.profiles) AS profiles,
 (SELECT count(*) FROM public.payout_allocations) AS payout_allocations;
-- Nullable, no backfill: existing suborders retain no invented delivery snapshot.
ALTER TABLE public.order_suborders ADD COLUMN delivery_snapshot jsonb;
-- Additive staging framework. No historical backfill, payment rewrite or activation.
CREATE TABLE private.commercial_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 onboarding_enforced boolean NOT NULL DEFAULT false,
 acquisition_enabled boolean NOT NULL DEFAULT false CHECK (NOT acquisition_enabled),
 standard_breakdown_enabled boolean NOT NULL DEFAULT false CHECK (NOT standard_breakdown_enabled),
 -- Hard activation interlocks: settlement/refund integration needs separate reviewed release.
 business jsonb NOT NULL DEFAULT '{"legalName":"","registrationNumber":"","tradingName":"OfficeBites","email":"","telephone":"","website":"https://officebites.co.za","businessAddress":"","legalNoticeAddress":"","vatTreatment":"","informationOfficer":"","informationOfficerContact":""}'
);
INSERT INTO private.commercial_settings DEFAULT VALUES;
CREATE TABLE private.legal_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK(kind IN ('terms','privacy','refund-policy','vendor-agreement','vendor-fees')),
 version text NOT NULL CHECK(length(version) BETWEEN 1 AND 60),
 title text NOT NULL, content text NOT NULL CHECK(length(content) BETWEEN 50 AND 200000),
 content_hash text NOT NULL, effective_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 approved_at timestamptz, approved_by uuid REFERENCES public.profiles(id),
 UNIQUE(kind,version)
);
CREATE TABLE private.vendor_legal_acceptances (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 actor_id uuid NOT NULL REFERENCES public.profiles(id),documents jsonb NOT NULL,
 fee_version text NOT NULL DEFAULT 'standard-15-2-v1',
 acknowledgements jsonb NOT NULL,method text NOT NULL CHECK(method IN ('application','authenticated')),
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX vendor_legal_acceptances_vendor ON private.vendor_legal_acceptances(vendor_id,accepted_at DESC);
CREATE TABLE private.vendor_consent_intents (
 actor_id uuid PRIMARY KEY REFERENCES public.profiles(id),documents jsonb NOT NULL,acknowledgements jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.corporate_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 200),
 internal_identifier text NOT NULL UNIQUE,contact_name text,contact_email text,contact_phone text,
 location text,estimated_employees integer CHECK(estimated_employees>=0),notes text,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','suspended','closed')),
 secured_at date,created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.corporate_memberships (
 account_id uuid NOT NULL REFERENCES private.corporate_accounts(id),customer_id uuid NOT NULL REFERENCES public.profiles(id),
 verified_by uuid NOT NULL REFERENCES public.profiles(id),evidence text NOT NULL CHECK(length(trim(evidence))>=10),
 verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),revoked_at timestamptz,
 PRIMARY KEY(account_id,customer_id)
);
CREATE UNIQUE INDEX corporate_one_active_membership ON private.corporate_memberships(customer_id) WHERE revoked_at IS NULL;
CREATE TABLE private.corporate_agreements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),account_id uuid NOT NULL REFERENCES private.corporate_accounts(id),
 vendor_id uuid NOT NULL REFERENCES public.vendors(id),document_id uuid NOT NULL REFERENCES private.legal_versions(id),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','offered','accepted','active','expired','rejected','terminated')),
 starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 terms jsonb NOT NULL DEFAULT '{"version":"acquisition-progressive-v1","rates":[0.05,0.075,0.10],"lastPositions":[49,99],"base":"net product subtotal; delivery excluded","week":"Africa/Johannesburg Monday","renewal":"none"}',
 accepted_by uuid REFERENCES public.profiles(id),accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK(ends_at>starts_at),
 CHECK(status NOT IN ('accepted','active') OR (accepted_by IS NOT NULL AND accepted_at IS NOT NULL))
);
CREATE INDEX corporate_agreements_scope ON private.corporate_agreements(account_id,vendor_id,starts_at,ends_at);
CREATE TABLE private.corporate_attributions (
 order_id uuid NOT NULL REFERENCES public.orders(id),vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 agreement_id uuid NOT NULL REFERENCES private.corporate_agreements(id),
 verified_by uuid NOT NULL REFERENCES public.profiles(id),evidence text NOT NULL CHECK(length(trim(evidence))>=10),
 verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),disputed_at timestamptz,
 PRIMARY KEY(order_id,vendor_id)
);
CREATE TABLE private.commercial_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid REFERENCES public.profiles(id),
 action text NOT NULL,record_id uuid,before_value jsonb,after_value jsonb,at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- Future eligible events are server-owned. Not attached to checkout until settlement integration passes.
CREATE TABLE private.acquisition_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),agreement_id uuid NOT NULL REFERENCES private.corporate_agreements(id),
 account_id uuid NOT NULL REFERENCES private.corporate_accounts(id),vendor_id uuid NOT NULL REFERENCES public.vendors(id),
 order_id uuid NOT NULL REFERENCES public.orders(id),week_start date NOT NULL,position bigint NOT NULL CHECK(position>0),
 rate numeric NOT NULL CHECK(rate IN (0.05,0.075,0.10)),eligible_subtotal numeric(14,2) NOT NULL CHECK(eligible_subtotal>0),
 amount numeric(14,2) NOT NULL CHECK(amount>=0),eligible_at timestamptz NOT NULL,
 calculation_version text NOT NULL DEFAULT 'acquisition-progressive-v1',
 UNIQUE(order_id,vendor_id),UNIQUE(agreement_id,vendor_id,week_start,position)
);
CREATE TABLE private.commercial_refund_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),entry_id uuid NOT NULL REFERENCES private.acquisition_ledger(id),
 provider text NOT NULL CHECK(provider IN ('payfast','ozow')),provider_event_id text NOT NULL,
 refunded_subtotal numeric(14,2) NOT NULL CHECK(refunded_subtotal>0),
 acquisition_credit numeric(14,2) NOT NULL CHECK(acquisition_credit>=0),
 confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(provider,provider_event_id,entry_id)
);
CREATE TABLE private.standard_sale_contracts (
 suborder_id uuid PRIMARY KEY REFERENCES public.order_suborders(id),
 acceptance_id uuid NOT NULL REFERENCES private.vendor_legal_acceptances(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.standard_fee_ledger (
 suborder_id uuid PRIMARY KEY REFERENCES public.order_suborders(id),
 acceptance_id uuid NOT NULL REFERENCES private.vendor_legal_acceptances(id),
 gross_product_subtotal numeric(14,2) NOT NULL, vendor_discount numeric(14,2) NOT NULL CHECK(vendor_discount=0),
 eligible_net_subtotal numeric(14,2) NOT NULL,platform_amount numeric(14,2) NOT NULL,
 internal_processing_amount numeric(14,2) NOT NULL,combined_amount numeric(14,2) NOT NULL,
 delivery_allocated numeric(14,2) NOT NULL,net_before_acquisition_provider_tax numeric(14,2) NOT NULL,
 tax_treatment text NOT NULL,calculation_version text NOT NULL DEFAULT 'standard-15-2-v1',
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(platform_amount+internal_processing_amount=combined_amount),
 CHECK(gross_product_subtotal-vendor_discount=eligible_net_subtotal)
);
CREATE FUNCTION private.standard_contract_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE acceptance uuid; policy text;
BEGIN
 IF NOT (SELECT standard_breakdown_enabled FROM private.commercial_settings) THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
  SELECT id INTO acceptance FROM private.vendor_legal_acceptances WHERE vendor_id=NEW.vendor_id ORDER BY accepted_at DESC,id DESC LIMIT 1;
  IF acceptance IS NOT NULL THEN INSERT INTO private.standard_sale_contracts(suborder_id,acceptance_id) VALUES(NEW.id,acceptance); END IF;
 ELSIF NEW.payment_status='paid' AND OLD.payment_status IS DISTINCT FROM 'paid' AND NEW.commission_rate_snapshot=0.17 THEN
  SELECT acceptance_id INTO acceptance FROM private.standard_sale_contracts WHERE suborder_id=NEW.id;
  IF acceptance IS NOT NULL THEN
   SELECT business->>'vatTreatment' INTO policy FROM private.commercial_settings;
   -- No discount model exists yet. Current subtotal is the server-calculated meal value;
   -- this adapter supports undiscounted sales only, and cannot be activated by the UI.
   INSERT INTO private.standard_fee_ledger(suborder_id,acceptance_id,gross_product_subtotal,vendor_discount,eligible_net_subtotal,platform_amount,internal_processing_amount,combined_amount,delivery_allocated,net_before_acquisition_provider_tax,tax_treatment)
   VALUES(NEW.id,acceptance,NEW.subtotal,0,NEW.subtotal,round(NEW.subtotal*.15,2),NEW.commission_amount-round(NEW.subtotal*.15,2),NEW.commission_amount,coalesce((NEW.delivery_snapshot->>'allocatedCharge')::numeric,0),NEW.subtotal-NEW.commission_amount,coalesce(policy,'Unconfirmed'));
  END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER standard_contract_insert AFTER INSERT ON public.order_suborders FOR EACH ROW EXECUTE FUNCTION private.standard_contract_event();
CREATE TRIGGER standard_contract_paid AFTER UPDATE OF payment_status ON public.order_suborders FOR EACH ROW EXECUTE FUNCTION private.standard_contract_event();

CREATE FUNCTION private.commercial_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Immutable commercial evidence: append a new version or compensation'; END $$;
CREATE TRIGGER legal_content_immutable BEFORE UPDATE OF kind,version,title,content,content_hash,effective_at,created_at,created_by OR DELETE ON private.legal_versions FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
CREATE TRIGGER acceptance_immutable BEFORE UPDATE OR DELETE ON private.vendor_legal_acceptances FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
CREATE TRIGGER commercial_audit_immutable BEFORE UPDATE OR DELETE ON private.commercial_audit FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
CREATE TRIGGER acquisition_immutable BEFORE UPDATE OR DELETE ON private.acquisition_ledger FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
CREATE TRIGGER refund_adjustment_immutable BEFORE UPDATE OR DELETE ON private.commercial_refund_adjustments FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
CREATE TRIGGER standard_contract_immutable BEFORE UPDATE OR DELETE ON private.standard_sale_contracts FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();
CREATE TRIGGER standard_fee_immutable BEFORE UPDATE OR DELETE ON private.standard_fee_ledger FOR EACH ROW EXECUTE FUNCTION private.commercial_immutable();

CREATE FUNCTION private.commercial_admin() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin' AND NOT suspended) THEN RAISE EXCEPTION 'Active administrator required'; END IF;
END $$;
CREATE FUNCTION private.commercial_business_ready() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM private.commercial_settings s CROSS JOIN unnest(ARRAY['legalName','registrationNumber','businessAddress','legalNoticeAddress','vatTreatment','informationOfficer','informationOfficerContact']) k WHERE nullif(trim(s.business->>k),'') IS NULL)
$$;
CREATE FUNCTION private.commercial_documents() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_object_agg(kind,to_jsonb(d)),'{}') FROM (
 SELECT DISTINCT ON(kind) id,kind,version,title,content,content_hash,effective_at,created_at
 FROM private.legal_versions WHERE approved_at IS NOT NULL AND effective_at<=now() ORDER BY kind,effective_at DESC,created_at DESC,id DESC) d
$$;
CREATE FUNCTION private.legal_portal() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('business',business,'businessReady',private.commercial_business_ready(),'documents',private.commercial_documents(),
 'onboardingEnforced',onboarding_enforced,'acquisitionEnabled',acquisition_enabled,'standardBreakdownEnabled',standard_breakdown_enabled)
 FROM private.commercial_settings
$$;
CREATE FUNCTION public.get_legal_portal() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.legal_portal() $$;

CREATE FUNCTION private.validate_vendor_consent(p_documents jsonb,p_ack jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE docs jsonb:=private.commercial_documents(); k text; result jsonb:='{}';
BEGIN
 IF NOT private.commercial_business_ready() THEN RAISE EXCEPTION 'Business disclosures incomplete'; END IF;
 FOR k IN SELECT unnest(ARRAY['vendor-agreement','vendor-fees','privacy','refund-policy']) LOOP
 IF docs->k IS NULL OR p_documents->>k IS DISTINCT FROM docs->k->>'id' THEN RAISE EXCEPTION 'Current approved documents required: %',k; END IF;
 result:=result||jsonb_build_object(k,docs->k);
 END LOOP;
 IF jsonb_typeof(p_ack) IS DISTINCT FROM 'array' OR jsonb_array_length(p_ack)<>8 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_ack) a WHERE a IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'Eight explicit acknowledgements required'; END IF;
 RETURN result;
END $$;
CREATE FUNCTION private.prepare_vendor_consent(p_documents jsonb,p_ack jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND NOT suspended) THEN RAISE EXCEPTION 'Active account required'; END IF;
 PERFORM private.validate_vendor_consent(p_documents,p_ack);
 INSERT INTO private.vendor_consent_intents(actor_id,documents,acknowledgements) VALUES(auth.uid(),p_documents,p_ack)
 ON CONFLICT(actor_id) DO UPDATE SET documents=excluded.documents,acknowledgements=excluded.acknowledgements,created_at=clock_timestamp();
END $$;
CREATE FUNCTION public.prepare_vendor_consent(p_documents jsonb,p_ack jsonb) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.prepare_vendor_consent(p_documents,p_ack) $$;
CREATE FUNCTION private.accept_vendor_legal(p_vendor uuid,p_documents jsonb,p_ack jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE docs jsonb; result uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id WHERE v.id=p_vendor AND v.owner_id=auth.uid() AND NOT p.suspended AND v.status IN ('pending','approved')) THEN RAISE EXCEPTION 'Active vendor owner required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 docs:=private.validate_vendor_consent(p_documents,p_ack);
 SELECT id INTO result FROM private.vendor_legal_acceptances WHERE vendor_id=p_vendor AND actor_id=auth.uid() AND documents=docs ORDER BY accepted_at DESC LIMIT 1;
 IF result IS NULL THEN
 INSERT INTO private.vendor_legal_acceptances(vendor_id,actor_id,documents,acknowledgements,method) VALUES(p_vendor,auth.uid(),docs,p_ack,'authenticated') RETURNING id INTO result;
 END IF;RETURN result;
END $$;
CREATE FUNCTION public.accept_vendor_legal(p_vendor uuid,p_documents jsonb,p_ack jsonb) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.accept_vendor_legal(p_vendor,p_documents,p_ack) $$;
REVOKE ALL ON FUNCTION private.accept_vendor_legal(uuid,jsonb,jsonb),public.accept_vendor_legal(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.accept_vendor_legal(uuid,jsonb,jsonb),public.accept_vendor_legal(uuid,jsonb,jsonb) TO authenticated;
CREATE FUNCTION private.enforce_vendor_consent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE claim jsonb; docs jsonb; ack jsonb; method text;
BEGIN
 IF NOT (SELECT onboarding_enforced FROM private.commercial_settings) THEN RETURN NEW; END IF;
 SELECT documents,acknowledgements INTO docs,ack FROM private.vendor_consent_intents WHERE actor_id=NEW.owner_id AND created_at>now()-interval '15 minutes';
 method:='authenticated';
 IF docs IS NULL THEN
   SELECT raw_user_meta_data->'vendor_consent' INTO claim FROM auth.users WHERE id=NEW.owner_id;
   docs:=claim->'documents';ack:=claim->'acknowledgements';method:='application';
 END IF;
 docs:=private.validate_vendor_consent(docs,ack);
 INSERT INTO private.vendor_legal_acceptances(vendor_id,actor_id,documents,acknowledgements,method) VALUES(NEW.id,NEW.owner_id,docs,ack,method);
 DELETE FROM private.vendor_consent_intents WHERE actor_id=NEW.owner_id;
 RETURN NEW;
END $$;
CREATE TRIGGER vendor_legal_application AFTER INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION private.enforce_vendor_consent();

CREATE FUNCTION private.commercial_admin_action(p_action text,p_value jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rid uuid; old_value jsonb; output jsonb; a private.corporate_agreements%ROWTYPE; d private.legal_versions%ROWTYPE;
BEGIN
 PERFORM private.commercial_admin();
 -- Serialize edits/offers to avoid overlapping agreement activation and lost admin changes.
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 rid:=nullif(p_value->>'id','')::uuid;
 CASE p_action
 WHEN 'business' THEN
 SELECT business INTO old_value FROM private.commercial_settings FOR UPDATE;
 UPDATE private.commercial_settings SET business=business|| (p_value - 'owner' - 'beneficiary') RETURNING business INTO output;
 WHEN 'document' THEN
 INSERT INTO private.legal_versions(kind,version,title,content,content_hash,effective_at,created_by)
 VALUES(p_value->>'kind',p_value->>'version',p_value->>'title',p_value->>'content',encode(sha256(convert_to(p_value->>'content','UTF8')),'hex'),(p_value->>'effective_at')::timestamptz,auth.uid()) RETURNING id,to_jsonb(legal_versions.*) INTO rid,output;
 WHEN 'approve_document' THEN
 IF NOT private.commercial_business_ready() OR p_value->>'approvalReference' IS NULL OR length(trim(p_value->>'approvalReference'))<10 THEN RAISE EXCEPTION 'Completed disclosures and legal approval reference required'; END IF;
 UPDATE private.legal_versions SET approved_at=clock_timestamp(),approved_by=auth.uid() WHERE id=rid AND approved_at IS NULL RETURNING to_jsonb(legal_versions.*) INTO output;
 IF output IS NULL THEN RAISE EXCEPTION 'Unapproved document not found'; END IF;
 WHEN 'onboarding' THEN
 IF (p_value->>'enabled')::boolean THEN PERFORM private.validate_vendor_consent(p_value->'documents','[true,true,true,true,true,true,true,true]'); END IF;
 UPDATE private.commercial_settings SET onboarding_enforced=(p_value->>'enabled')::boolean RETURNING to_jsonb(commercial_settings.*) INTO output;
 WHEN 'account' THEN
 IF rid IS NULL THEN
 INSERT INTO private.corporate_accounts(name,internal_identifier) VALUES(p_value->>'name',p_value->>'internal_identifier') RETURNING id INTO rid;
 END IF;
 SELECT to_jsonb(c.*) INTO old_value FROM private.corporate_accounts c WHERE id=rid FOR UPDATE;
 UPDATE private.corporate_accounts SET name=coalesce(p_value->>'name',name),contact_name=p_value->>'contact_name',contact_email=p_value->>'contact_email',contact_phone=p_value->>'contact_phone',location=p_value->>'location',estimated_employees=nullif(p_value->>'estimated_employees','')::integer,notes=p_value->>'notes',status=coalesce(p_value->>'status',status),secured_at=nullif(p_value->>'secured_at','')::date WHERE id=rid RETURNING to_jsonb(corporate_accounts.*) INTO output;
 WHEN 'membership' THEN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=(p_value->>'customer_id')::uuid AND role='customer' AND NOT suspended) THEN RAISE EXCEPTION 'Active customer required'; END IF;
 INSERT INTO private.corporate_memberships(account_id,customer_id,verified_by,evidence) VALUES((p_value->>'account_id')::uuid,(p_value->>'customer_id')::uuid,auth.uid(),p_value->>'evidence')
 ON CONFLICT(account_id,customer_id) DO UPDATE SET verified_by=auth.uid(),evidence=excluded.evidence,verified_at=clock_timestamp(),revoked_at=NULL RETURNING to_jsonb(corporate_memberships.*) INTO output;
 WHEN 'revoke_membership' THEN
 UPDATE private.corporate_memberships SET revoked_at=clock_timestamp() WHERE account_id=(p_value->>'account_id')::uuid AND customer_id=(p_value->>'customer_id')::uuid RETURNING to_jsonb(corporate_memberships.*) INTO output;
 WHEN 'offer' THEN
 SELECT * INTO d FROM private.legal_versions WHERE id=(p_value->>'document_id')::uuid AND kind='vendor-agreement' AND approved_at IS NOT NULL AND effective_at<=now();
 IF d.id IS NULL THEN RAISE EXCEPTION 'Approved agreement document required'; END IF;
 INSERT INTO private.corporate_agreements(account_id,vendor_id,document_id,status,starts_at,ends_at)
 VALUES((p_value->>'account_id')::uuid,(p_value->>'vendor_id')::uuid,d.id,'offered',(p_value->>'starts_at')::timestamptz,coalesce((p_value->>'ends_at')::timestamptz,(p_value->>'starts_at')::timestamptz+interval '12 weeks')) RETURNING id,to_jsonb(corporate_agreements.*) INTO rid,output;
 WHEN 'activate' THEN
 IF NOT (SELECT acquisition_enabled FROM private.commercial_settings) THEN RAISE EXCEPTION 'Acquisition disabled pending settlement and refund integration'; END IF;
 SELECT * INTO a FROM private.corporate_agreements WHERE id=rid FOR UPDATE;
 IF a.status<>'accepted' OR a.ends_at<=now() OR NOT EXISTS(SELECT 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id WHERE v.id=a.vendor_id AND v.status='approved' AND NOT p.suspended) OR NOT EXISTS(SELECT 1 FROM private.corporate_accounts WHERE id=a.account_id AND status='active') THEN RAISE EXCEPTION 'Agreement activation prerequisites missing'; END IF;
 IF EXISTS(SELECT 1 FROM private.corporate_agreements WHERE id<>rid AND account_id=a.account_id AND vendor_id=a.vendor_id AND status='active' AND starts_at<a.ends_at AND ends_at>a.starts_at) THEN RAISE EXCEPTION 'Overlapping acquisition agreement'; END IF;
 UPDATE private.corporate_agreements SET status='active' WHERE id=rid RETURNING to_jsonb(corporate_agreements.*) INTO output;
 WHEN 'terminate' THEN
 UPDATE private.corporate_agreements SET status='terminated' WHERE id=rid AND status IN ('offered','accepted','active') RETURNING to_jsonb(corporate_agreements.*) INTO output;
 WHEN 'dispute' THEN
 UPDATE private.corporate_attributions SET disputed_at=clock_timestamp() WHERE order_id=(p_value->>'order_id')::uuid AND vendor_id=(p_value->>'vendor_id')::uuid RETURNING to_jsonb(corporate_attributions.*) INTO output;
 ELSE RAISE EXCEPTION 'Unknown commercial action';
 END CASE;
 IF output IS NULL THEN RAISE EXCEPTION 'Record not found or transition invalid'; END IF;
 INSERT INTO private.commercial_audit(actor_id,action,record_id,before_value,after_value) VALUES(auth.uid(),p_action,rid,old_value,jsonb_build_object('result',output,'approvalReference',p_value->>'approvalReference'));
 RETURN output;
END $$;
CREATE FUNCTION public.admin_commercial_action(p_action text,p_value jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.commercial_admin_action(p_action,p_value) $$;

CREATE FUNCTION private.respond_corporate_agreement(p_id uuid,p_accept boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a private.corporate_agreements%ROWTYPE; output jsonb;
BEGIN
 SELECT * INTO a FROM private.corporate_agreements WHERE id=p_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM public.vendors v JOIN public.profiles p ON p.id=v.owner_id WHERE v.id=a.vendor_id AND v.owner_id=auth.uid() AND NOT p.suspended AND v.status='approved') THEN RAISE EXCEPTION 'Active vendor owner required'; END IF;
 IF a.status<>'offered' OR a.ends_at<=now() THEN RAISE EXCEPTION 'Offer unavailable'; END IF;
 UPDATE private.corporate_agreements SET status=CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,accepted_by=CASE WHEN p_accept THEN auth.uid() END,accepted_at=CASE WHEN p_accept THEN clock_timestamp() END WHERE id=p_id RETURNING to_jsonb(corporate_agreements.*) INTO output;
 INSERT INTO private.commercial_audit(actor_id,action,record_id,after_value) VALUES(auth.uid(),CASE WHEN p_accept THEN 'accept_corporate' ELSE 'decline_corporate' END,p_id,output);
 RETURN output;
END $$;
CREATE FUNCTION public.respond_corporate_agreement(p_id uuid,p_accept boolean) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.respond_corporate_agreement(p_id,p_accept) $$;

CREATE FUNCTION private.commercial_workspace() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE admin boolean; vid uuid; output jsonb;
BEGIN
 SELECT p.role='admin',p.vendor_id INTO admin,vid FROM public.profiles p WHERE p.id=auth.uid() AND NOT p.suspended;
 IF admin IS NOT TRUE AND vid IS NULL THEN RAISE EXCEPTION 'Administrator or vendor required'; END IF;
 SELECT jsonb_build_object('admin',admin,'enabled',false,'business',CASE WHEN admin THEN (SELECT business FROM private.commercial_settings) END,
 'documents',CASE WHEN admin THEN (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY created_at DESC),'[]') FROM private.legal_versions d) ELSE private.commercial_documents() END,
 'accounts',CASE WHEN admin THEN (SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM private.corporate_accounts c) ELSE '[]'::jsonb END,
 'agreements',(SELECT coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('corporate_name',c.name,'effective_status',CASE WHEN a.status IN ('active','accepted') AND a.ends_at<=now() THEN 'expired' ELSE a.status END,'document',(SELECT to_jsonb(d) FROM private.legal_versions d WHERE d.id=a.document_id))),'[]') FROM private.corporate_agreements a JOIN private.corporate_accounts c ON c.id=a.account_id WHERE admin OR a.vendor_id=vid),
 'acceptances',(SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') FROM private.vendor_legal_acceptances v WHERE admin OR v.vendor_id=vid),
 'ledger',(SELECT coalesce(jsonb_agg(to_jsonb(l)),'[]') FROM private.acquisition_ledger l WHERE admin OR l.vendor_id=vid),
 'adjustments',(SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') FROM private.commercial_refund_adjustments r JOIN private.acquisition_ledger l ON l.id=r.entry_id WHERE admin OR l.vendor_id=vid),
 'standardFees',(SELECT coalesce(jsonb_agg(to_jsonb(f)),'[]') FROM private.standard_fee_ledger f JOIN public.order_suborders s ON s.id=f.suborder_id WHERE admin OR s.vendor_id=vid),
 'memberships',CASE WHEN admin THEN (SELECT coalesce(jsonb_agg(to_jsonb(m)),'[]') FROM private.corporate_memberships m) ELSE '[]'::jsonb END,
 'attributions',CASE WHEN admin THEN (SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') FROM private.corporate_attributions t) ELSE '[]'::jsonb END) INTO output;
 RETURN output;
END $$;
CREATE FUNCTION public.get_commercial_workspace() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.commercial_workspace() $$;

-- Scalar reference arithmetic used in DB tests. No financial mutations or authority.
CREATE FUNCTION private.acquisition_rate(p_position bigint) RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_position<1 THEN NULL WHEN p_position<=49 THEN 0.05 WHEN p_position<=99 THEN 0.075 ELSE 0.10 END
$$;
CREATE FUNCTION private.record_acquisition(p_order uuid,p_vendor uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
CREATE FUNCTION private.acquisition_completed_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='completed' AND NEW.payment_status='paid' THEN PERFORM private.record_acquisition(NEW.order_id,NEW.vendor_id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER acquisition_completed AFTER UPDATE OF status,payment_status ON public.order_suborders FOR EACH ROW EXECUTE FUNCTION private.acquisition_completed_event();
-- Intentionally no public/service-role grant: a verified provider refund adapter is outstanding.
-- Amount is the refunded meal subtotal, excluding delivery; provider event must be independently confirmed.
CREATE FUNCTION private.record_acquisition_refund(p_entry uuid,p_provider text,p_event text,p_subtotal numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e private.acquisition_ledger%ROWTYPE; prior numeric; credit numeric; result uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 SELECT id INTO result FROM private.commercial_refund_adjustments WHERE entry_id=p_entry AND provider=p_provider AND provider_event_id=p_event;
 IF result IS NOT NULL THEN
 IF NOT EXISTS(SELECT 1 FROM private.commercial_refund_adjustments WHERE id=result AND refunded_subtotal=p_subtotal) THEN RAISE EXCEPTION 'Refund event replay mismatch'; END IF;
 RETURN result; END IF;
 SELECT * INTO e FROM private.acquisition_ledger WHERE id=p_entry;
 IF e.id IS NULL OR p_subtotal IS NULL OR p_subtotal<=0 OR p_subtotal<>round(p_subtotal,2) OR length(trim(p_event))<3 THEN RAISE EXCEPTION 'Invalid confirmed refund'; END IF;
 SELECT coalesce(sum(refunded_subtotal),0) INTO prior FROM private.commercial_refund_adjustments WHERE entry_id=p_entry;
 IF prior+p_subtotal>e.eligible_subtotal THEN RAISE EXCEPTION 'Refund exceeds eligible sale'; END IF;
 credit:=round((prior+p_subtotal)*e.rate,2)-round(prior*e.rate,2);
 INSERT INTO private.commercial_refund_adjustments(entry_id,provider,provider_event_id,refunded_subtotal,acquisition_credit) VALUES(p_entry,p_provider,p_event,p_subtotal,credit) RETURNING id INTO result;
 RETURN result;
END $$;
-- Until the existing payout allocator consumes this ledger, fail closed rather than overpay.
CREATE FUNCTION private.commercial_payout_hold() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.order_suborders s JOIN private.acquisition_ledger l ON l.vendor_id=s.vendor_id WHERE s.id=NEW.suborder_id) THEN
 RAISE EXCEPTION 'Corporate settlement integration required before allocating this vendor payout';
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER corporate_settlement_hold BEFORE INSERT ON public.payout_allocations FOR EACH ROW EXECUTE FUNCTION private.commercial_payout_hold();
REVOKE ALL ON FUNCTION private.record_acquisition(uuid,uuid),private.acquisition_completed_event(),private.record_acquisition_refund(uuid,text,text,numeric),private.commercial_payout_hold() FROM PUBLIC,anon,authenticated,service_role;
-- Access is RPC-only. No direct API table access, including service_role default grants.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['commercial_settings','legal_versions','vendor_legal_acceptances','vendor_consent_intents','corporate_accounts','corporate_memberships','corporate_agreements','corporate_attributions','commercial_audit','acquisition_ledger','commercial_refund_adjustments','standard_sale_contracts','standard_fee_ledger'] LOOP
 EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated,service_role',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION private.commercial_admin(),private.commercial_business_ready(),private.commercial_documents(),private.legal_portal(),private.validate_vendor_consent(jsonb,jsonb),private.prepare_vendor_consent(jsonb,jsonb),private.enforce_vendor_consent(),private.commercial_admin_action(text,jsonb),private.respond_corporate_agreement(uuid,boolean),private.commercial_workspace(),private.acquisition_rate(bigint),private.commercial_immutable() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION private.standard_contract_event() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_legal_portal(),public.prepare_vendor_consent(jsonb,jsonb),public.admin_commercial_action(text,jsonb),public.respond_corporate_agreement(uuid,boolean),public.get_commercial_workspace() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.legal_portal(),public.get_legal_portal() TO anon,authenticated;
GRANT EXECUTE ON FUNCTION private.prepare_vendor_consent(jsonb,jsonb),public.prepare_vendor_consent(jsonb,jsonb),private.commercial_admin_action(text,jsonb),public.admin_commercial_action(text,jsonb),private.respond_corporate_agreement(uuid,boolean),public.respond_corporate_agreement(uuid,boolean),private.commercial_workspace(),public.get_commercial_workspace() TO authenticated;


DO $verify$
DECLARE before_row record;
BEGIN
 SELECT * INTO STRICT before_row FROM officebites_legal_foundation_baseline;
 IF before_row.orders<>(SELECT count(*) FROM public.orders)
 OR before_row.suborders<>(SELECT count(*) FROM public.order_suborders)
 OR before_row.vendors<>(SELECT count(*) FROM public.vendors)
 OR before_row.profiles<>(SELECT count(*) FROM public.profiles)
 OR before_row.payout_allocations<>(SELECT count(*) FROM public.payout_allocations)
 THEN RAISE EXCEPTION 'Existing production record counts changed; roll back legal foundation'; END IF;
 IF (SELECT count(*) FROM private.legal_versions)<>0
 OR (SELECT count(*) FROM private.vendor_legal_acceptances)<>0
 OR (SELECT count(*) FROM private.vendor_consent_intents)<>0
 THEN RAISE EXCEPTION 'Legal foundation must not seed documents, acceptances or consent intents'; END IF;
 IF (SELECT onboarding_enforced OR acquisition_enabled OR standard_breakdown_enabled FROM private.commercial_settings WHERE singleton)
 THEN RAISE EXCEPTION 'Legal/commercial feature gate unexpectedly enabled'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.legal_versions'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='private.vendor_legal_acceptances'::regclass)
 THEN RAISE EXCEPTION 'Legal tables must have RLS enabled'; END IF;
END
$verify$;
COMMIT;
