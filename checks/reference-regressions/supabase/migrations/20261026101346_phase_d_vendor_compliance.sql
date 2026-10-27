-- Phase D LOCAL CANDIDATE, after B/C. No rollout, legal publication or gateway changes.
BEGIN;
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
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('vendor-compliance','vendor-compliance',false,5242880,ARRAY['application/pdf','image/jpeg','image/png']) ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='vendor-compliance' AND NOT public
 AND file_size_limit=5242880 AND allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png'])
 THEN RAISE EXCEPTION 'Unexpected compliance bucket configuration; review before applying'; END IF; END $$;
CREATE POLICY compliance_object_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='vendor-compliance' AND private.compliance_storage_access(name,true));
CREATE POLICY compliance_object_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='vendor-compliance' AND private.compliance_storage_access(name,false));
-- Intersect permissive legacy storage policies; evidence cannot be replaced/deleted by clients.
CREATE POLICY compliance_insert_boundary ON storage.objects AS RESTRICTIVE FOR INSERT TO anon,authenticated
 WITH CHECK(bucket_id<>'vendor-compliance' OR private.compliance_storage_access(name,true));
CREATE POLICY compliance_read_boundary ON storage.objects AS RESTRICTIVE FOR SELECT TO anon,authenticated
 USING(bucket_id<>'vendor-compliance' OR private.compliance_storage_access(name,false));
CREATE POLICY compliance_no_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
 USING(bucket_id<>'vendor-compliance') WITH CHECK(bucket_id<>'vendor-compliance');
CREATE POLICY compliance_no_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(bucket_id<>'vendor-compliance');

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
COMMIT;
