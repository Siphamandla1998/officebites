-- Forward-only admin manual-payment settings contract.
-- Keeps manual EFT / PayShap, PayFast and Ozow flags unchanged.
-- Creates the revision-aware RPC expected by ManualSettingsForm.jsx.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
  IF to_regclass('private.manual_payment_settings') IS NULL
     OR to_regclass('private.gateway_settings') IS NULL
     OR to_regprocedure('public.manual_payment_workspace(boolean)') IS NULL
     OR to_regprocedure('public.admin_manual_settings(boolean,boolean,integer,numeric,text)') IS NULL
     OR to_regprocedure('private.active_account()') IS NULL
  THEN
    RAISE EXCEPTION 'Reviewed manual-settings prerequisites are missing; no changes applied';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='private' AND table_name='manual_payment_settings' AND column_name='revision'
  ) OR to_regprocedure('public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text)') IS NOT NULL
  THEN
    RAISE EXCEPTION 'Checked manual settings already appears installed; reconcile before retrying';
  END IF;
END
$preflight$;

ALTER TABLE private.manual_payment_settings
  ADD COLUMN revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0);

CREATE FUNCTION private.manual_settings_revision_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION private.manual_settings_revision_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER manual_settings_revision
BEFORE UPDATE ON private.manual_payment_settings
FOR EACH ROW EXECUTE FUNCTION private.manual_settings_revision_guard();

CREATE FUNCTION private.manual_settings_revision()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT md5(jsonb_build_object(
    'settings', (SELECT to_jsonb(s) FROM private.manual_payment_settings s WHERE singleton),
    'gateways', (SELECT jsonb_agg(to_jsonb(g) ORDER BY provider)
                 FROM private.gateway_settings g
                 WHERE provider IN ('manual_eft','manual_payshap'))
  )::text)
$$;
REVOKE ALL ON FUNCTION private.manual_settings_revision() FROM PUBLIC, anon, authenticated, service_role;

ALTER FUNCTION public.manual_payment_workspace(boolean)
  RENAME TO manual_payment_workspace_before_checked_settings;
REVOKE ALL ON FUNCTION public.manual_payment_workspace_before_checked_settings(boolean)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.manual_payment_workspace(p_test_only boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  result := public.manual_payment_workspace_before_checked_settings(p_test_only);
  IF private.is_admin() THEN
    result := jsonb_set(
      result,
      '{settings,settings_revision}',
      to_jsonb(private.manual_settings_revision()),
      true
    );
  END IF;
  RETURN result;
END
$$;
REVOKE ALL ON FUNCTION public.manual_payment_workspace(boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manual_payment_workspace(boolean) TO authenticated, service_role;

CREATE FUNCTION public.admin_manual_settings_checked(
  p_eft boolean,
  p_payshap boolean,
  p_minutes integer,
  p_threshold numeric,
  p_reason text,
  p_expected_revision text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.active_account() OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'Active administrator required' USING ERRCODE = '42501';
  END IF;

  IF p_eft IS NULL OR p_payshap IS NULL OR p_minutes IS NULL
     OR p_minutes NOT BETWEEN 5 AND 60
     OR p_threshold IS NULL OR p_threshold <= 0
     OR p_threshold::text IN ('NaN','Infinity','-Infinity')
     OR p_threshold <> round(p_threshold, 2)
     OR length(btrim(coalesce(p_reason, ''))) NOT BETWEEN 10 AND 500
  THEN
    RAISE EXCEPTION 'Valid manual settings and reason required' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM private.manual_payment_settings WHERE singleton FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Manual settings singleton missing';
  END IF;

  PERFORM 1
  FROM private.gateway_settings
  WHERE provider IN ('manual_eft','manual_payshap')
  ORDER BY provider
  FOR UPDATE;

  IF p_expected_revision IS NULL
     OR p_expected_revision IS DISTINCT FROM private.manual_settings_revision()
  THEN
    RAISE EXCEPTION 'Settings changed; reload and review' USING ERRCODE = '40001';
  END IF;

  PERFORM public.admin_manual_settings(
    p_eft, p_payshap, p_minutes, p_threshold, btrim(p_reason)
  );
END
$$;
REVOKE ALL ON FUNCTION public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text)
  TO authenticated;

COMMIT;
