-- Phase C LOCAL CANDIDATE. Depends on Phase B. No legal publication or rollout.
BEGIN;
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
COMMIT;
