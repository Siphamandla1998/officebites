-- Forward-only LOCAL REVIEW CANDIDATE. Not an automatic or approved hosted migration.
-- Requires the corrected singleton RPC; after EFT-only installation if that package
-- is chosen. Adding this first invalidates its frozen baseline/retry fingerprints.
-- The SQL marker is not project identity proof. Independent control-plane target
-- verification and explicit installation/configuration approvals remain mandatory.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_setting('officebites.local_fixture',true) IS DISTINCT FROM 'isolated-checkout'
 AND current_setting('officebites.verified_project_ref',true) IS DISTINCT FROM 'eyhmarmekioovcjibcbr'
 THEN RAISE EXCEPTION 'Verified disposable fixture or separately approved staging target required'; END IF;
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
COMMIT;
