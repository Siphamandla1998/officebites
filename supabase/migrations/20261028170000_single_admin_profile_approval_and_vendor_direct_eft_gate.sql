-- Support a documented single-admin approval path for the current OfficeBites pilot.
-- Approval still requires an active admin and explicit verification evidence.
CREATE OR REPLACE FUNCTION public.approve_vendor_payment_profile(p_profile_id uuid, p_evidence text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  p private.vendor_payment_profiles%rowtype;
  single_admin boolean;
BEGIN
  IF NOT private.active_account() OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Active admin required' USING ERRCODE='42501';
  END IF;
  IF length(btrim(coalesce(p_evidence,''))) NOT BETWEEN 15 AND 1000 THEN
    RAISE EXCEPTION 'Bank ownership, recipient and EFT receiving-capability verification evidence required';
  END IF;
  SELECT * INTO STRICT p FROM private.vendor_payment_profiles WHERE id=p_profile_id FOR UPDATE;
  single_admin := p.submitted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.vendors WHERE id=p.vendor_id AND owner_id=auth.uid());
  IF p.approved_at IS NOT NULL THEN RETURN; END IF;
  UPDATE private.vendor_payment_profiles
  SET approved_by=auth.uid(), approved_at=clock_timestamp(),
      modified_at=clock_timestamp(), verification_evidence=btrim(p_evidence)
  WHERE id=p.id;
  INSERT INTO private.manual_payment_events(profile_id,actor_id,action,note)
  VALUES (p.id,auth.uid(),
    CASE WHEN single_admin THEN 'profile_approved_single_admin' ELSE 'profile_approved' END,
    CASE WHEN single_admin THEN 'Single-admin approval with recorded verification evidence: ' ELSE 'Approval with recorded verification evidence: ' END || btrim(p_evidence));
END
$function$;

-- Keep EFT vendor-direct checkout usable when the collection pilot is disabled.
-- If the collection pilot is enabled, retain the separate time-limited unlock requirement.
CREATE OR REPLACE FUNCTION public.get_vendor_manual_methods(p_vendor_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT private.get_vendor_manual_methods(p_vendor_id)
    || jsonb_build_object(
      'cash', private.phase_unlocked('cash') AND private.cash_vendor(p_vendor_id),
      'manual_payshap', false,
      'manual_eft',
        coalesce((private.get_vendor_manual_methods(p_vendor_id)->>'manual_eft')::boolean, false)
        AND (
          NOT EXISTS (SELECT 1 FROM private.pilot_policy WHERE singleton=true AND enabled)
          OR EXISTS (
            SELECT 1 FROM private.collection_activation a
            WHERE a.singleton=true AND a.eft_until>clock_timestamp()
              AND length(btrim(coalesce(a.approval_reference,'')))>=15
          )
        )
    )
$function$;
