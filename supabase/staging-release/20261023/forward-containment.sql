-- Forward containment only, separate approval required; never restores no-hook Auth delivery.
DO $$ BEGIN IF current_setting('officebites.verified_project_ref',true) IS DISTINCT FROM 'eyhmarmekioovcjibcbr' THEN RAISE EXCEPTION 'Verified staging target required';END IF;END $$;
DO $$ BEGIN IF to_regclass('private.officebites_release_installations') IS NULL THEN RAISE EXCEPTION 'Unrecognised installation';END IF;END $$;
UPDATE private.collection_activation SET eft_until=NULL WHERE singleton;
UPDATE private.assisted_controls SET assisted_until=NULL,cash_until=NULL,requests_until=NULL WHERE singleton;
UPDATE private.cash_custody_policy SET admin_cash_until=NULL,partial_handovers=false,bank_handovers=false WHERE singleton;
UPDATE private.uat_security SET expires_at=NULL,capability_hash=NULL WHERE singleton;
-- Do not mutate gateway/audit history through direct SQL. If a gateway is enabled,
-- the lock assertion stops; use a separately approved authenticated admin restoration.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled) THEN RAISE EXCEPTION 'Payment method enabled';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.manual_payment_settings WHERE singleton AND deadline_minutes=15 AND review_threshold=500) THEN RAISE EXCEPTION 'Settings baseline differs';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.delivery_settings WHERE NOT enabled AND paid_fee=15) THEN RAISE EXCEPTION 'Delivery baseline differs';END IF;
END $$;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.uat_security WHERE expires_at IS NOT NULL OR capability_hash IS NOT NULL) THEN RAISE EXCEPTION 'UAT access window not closed';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.pilot_policy WHERE singleton AND NOT enabled AND collection_fee=0) THEN RAISE EXCEPTION 'Collection unlocked or price differs';END IF;
 IF EXISTS(SELECT 1 FROM private.collection_activation WHERE eft_until IS NOT NULL) OR EXISTS(SELECT 1 FROM private.assisted_controls WHERE assisted_until IS NOT NULL OR cash_until IS NOT NULL OR requests_until IS NOT NULL) OR EXISTS(SELECT 1 FROM private.cash_custody_policy WHERE admin_cash_until IS NOT NULL OR partial_handovers OR bank_handovers) THEN RAISE EXCEPTION 'Entry lock not closed';END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN('private.cash_events'::regclass,'private.cash_handovers'::regclass,'private.manual_order_payments'::regclass,'private.uat_security'::regclass) AND (NOT relrowsecurity OR has_table_privilege('anon',oid,'SELECT') OR has_table_privilege('authenticated',oid,'UPDATE'))) THEN RAISE EXCEPTION 'Direct financial/security privilege violation';END IF;
 IF has_function_privilege('anon','public.create_assisted_order(uuid,jsonb,jsonb,uuid,uuid,bigint,bigint,text,uuid,numeric,text,text,text)','EXECUTE') OR has_function_privilege('authenticated','private.uat_send_email(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'RPC privilege violation';END IF;
END $$;
