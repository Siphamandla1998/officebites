BEGIN;
SET LOCAL lock_timeout='10s';
-- Correct the original SQL backslash escaping; keep JS and database modes aligned.
CREATE OR REPLACE FUNCTION public.valid_sa_mobile(p_value text,p_mode text DEFAULT 'local') RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_value IS NULL OR p_value !~ '^[0-9+ ()-]+$' THEN false
 WHEN p_mode='international' AND btrim(p_value) ~ '^[+][1-9][0-9]{7,14}$' AND btrim(p_value) !~ '^[+]27' THEN true
 ELSE regexp_replace(CASE WHEN p_mode='international' AND btrim(p_value) LIKE '+27%' THEN '0'||substr(btrim(p_value),4) ELSE btrim(p_value) END,'[ ()-]','','g') ~ '^0(6[0-9]|7[1-9]|8[1-4])[0-9]{7}$' END;
$$;
CREATE FUNCTION private.validate_booking_mobile() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' AND NEW.contact_phone IS NOT DISTINCT FROM OLD.contact_phone THEN RETURN NEW; END IF;
 IF NOT public.valid_sa_mobile(NEW.contact_phone,'international') THEN RAISE EXCEPTION 'A valid local or explicit international mobile number is required'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.validate_booking_mobile() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_booking_mobile BEFORE INSERT OR UPDATE OF contact_phone ON public.event_booking_requests FOR EACH ROW EXECUTE FUNCTION private.validate_booking_mobile();
COMMIT;
