-- OPERATOR REVIEW ARTIFACT: staging only; NOT part of production migration chain.
-- Execute only via a verified eyhmarmekioovcjibcbr connection, after approval.
-- Caller must BEGIN and SET LOCAL officebites.verified_project_ref to that ref.
DO $$ BEGIN
 IF current_setting('officebites.verified_project_ref',true) IS DISTINCT FROM 'eyhmarmekioovcjibcbr' THEN
  RAISE EXCEPTION 'Verified staging connection required'; END IF;
 IF to_regclass('private.manual_order_payments') IS NULL THEN RAISE EXCEPTION 'Manual payments prerequisite missing'; END IF;
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled) THEN RAISE EXCEPTION 'Disable all payment methods before installation'; END IF;
END $$;

CREATE TABLE private.uat_security (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 project_ref text NOT NULL CHECK(project_ref='eyhmarmekioovcjibcbr'),
 run text NOT NULL CHECK(run='OB-UAT-20261020'),
 capability_hash text CHECK(capability_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz,
 capture_salt uuid NOT NULL DEFAULT gen_random_uuid()
);
INSERT INTO private.uat_security(project_ref,run) VALUES('eyhmarmekioovcjibcbr','OB-UAT-20261020');
CREATE TABLE private.uat_actors (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 fixture text NOT NULL UNIQUE CHECK(fixture IN('vendorA','vendorB','customer','admin'))
);
CREATE TABLE private.uat_message_capture (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),
 run text NOT NULL CHECK(run='OB-UAT-20261020'),channel text NOT NULL CHECK(channel='email'),
 action text NOT NULL,recipient_hash text NOT NULL,suppressed boolean NOT NULL CHECK(suppressed)
);
ALTER TABLE private.uat_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.uat_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.uat_message_capture ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.uat_security,private.uat_actors,private.uat_message_capture FROM PUBLIC,anon,authenticated,service_role;

-- Intersect the existing account helper and restrictive public/Storage policies.
-- Retain its OID/grants for callers; preserve the exact prior definition for rollback.
CREATE FUNCTION private.uat_actor_allowed() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.uat_security s JOIN private.uat_actors a ON a.user_id=auth.uid()
 WHERE s.project_ref='eyhmarmekioovcjibcbr' AND s.expires_at>now())
$$;
DO $$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('private.active_account()'::regprocedure);
 EXECUTE replace(d,'FUNCTION private.active_account()','FUNCTION private.uat_original_active_account()');
END $$;
CREATE OR REPLACE FUNCTION private.active_account() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.uat_actor_allowed() AND private.uat_original_active_account()
$$;
REVOKE ALL ON FUNCTION private.uat_actor_allowed(),private.uat_original_active_account() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION private.uat_pre_request() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.uat_security%rowtype;h text;
BEGIN
 -- JWT role is validated by PostgREST, never supplied by an arbitrary HTTP header.
 IF auth.role()='service_role' THEN RETURN; END IF;
 SELECT * INTO STRICT s FROM private.uat_security;
 h:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-officebites-uat','');
 IF s.expires_at IS NULL OR s.expires_at<=now() OR s.capability_hash IS NULL
 OR length(h)<>64 OR encode(sha256(convert_to(h,'UTF8')),'hex')<>s.capability_hash
 OR (auth.uid() IS NOT NULL AND NOT private.active_account()) THEN
  RAISE EXCEPTION 'Staging UAT access required' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.uat_pre_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.uat_pre_request() TO anon,authenticated,service_role;

-- Private Postgres Auth hook: deliberately no HTTP/SMTP sender or raw payload capture.
CREATE FUNCTION private.uat_send_email(event jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s private.uat_security%rowtype;a text;
BEGIN
 SELECT * INTO STRICT s FROM private.uat_security;
 a:=event->'email_data'->>'email_action_type';
 -- Fixed enum prevents a malicious action/body from smuggling secrets into capture.
 IF a IS NULL OR a NOT IN('signup','recovery','invite','magiclink','email_change','email_change_new','reauthentication') THEN a:='other';END IF;
 INSERT INTO private.uat_message_capture(run,channel,action,recipient_hash,suppressed)
 VALUES(s.run,'email',a,encode(sha256(convert_to(s.capture_salt::text||coalesce(event->'user'->>'email',''),'UTF8')),'hex'),true);
 RETURN '{}'::jsonb;
END $$;
REVOKE ALL ON FUNCTION private.uat_send_email(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA private TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION private.uat_send_email(jsonb) TO supabase_auth_admin;
CREATE TRIGGER uat_capture_immutable BEFORE UPDATE OR DELETE ON private.uat_message_capture FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();

-- Deliberately does not enable a hook, select actors, set a secret or activate payments.
-- Separate reviewed configuration step must attach private.uat_pre_request to
-- authenticator's pgrst.db_pre_request, and attach uat_send_email in Auth dashboard.
