-- Forward-only fix for the existing manual settings RPC. Does not invoke it,
-- change settings, enable gateways, or alter its owner/ACL/security contract.
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE OR REPLACE FUNCTION public.admin_manual_settings(
  p_eft boolean,
  p_payshap boolean,
  p_minutes integer,
  p_threshold numeric,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_rows bigint;
BEGIN
  IF NOT private.active_account() OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Active admin required';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 1000 THEN
    RAISE EXCEPTION 'Configuration reason required';
  END IF;

  UPDATE private.manual_payment_settings
  SET deadline_minutes = p_minutes,
      review_threshold = p_threshold
  WHERE singleton = true;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one manual payment settings singleton row';
  END IF;

  PERFORM public.admin_update_payment_gateway('manual_eft', p_eft, false, p_reason);
  PERFORM public.admin_update_payment_gateway('manual_payshap', p_payshap, false, p_reason);
  INSERT INTO private.manual_payment_events(actor_id, action, note)
  VALUES (
    auth.uid(),
    'settings_changed',
    p_reason || ' ' || jsonb_build_object(
      'eft', p_eft, 'payshap', p_payshap,
      'minutes', p_minutes, 'reviewThreshold', p_threshold
    )::text
  );
END
$$;

COMMIT;
