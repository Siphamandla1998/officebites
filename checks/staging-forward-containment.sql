-- LOCAL PREPARED PROCEDURE ONLY. No current hosted execution is authorized.
-- DBA: independently verify STAGING project, incident approval and executor first.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $contain$
DECLARE reference text:='REPLACE_WITH_APPROVED_INCIDENT_REFERENCE';
BEGIN
 IF current_user<>'postgres' OR reference LIKE 'REPLACE_%' OR length(reference)<15
 THEN RAISE EXCEPTION 'Approved DBA and incident reference required'; END IF;
 -- Match checkout's legal -> settings -> gateway lock order. Retain existing
 -- customer legal enforcement and all historical evidence/receipt operations.
 PERFORM pg_advisory_xact_lock(hashtext('officebites-commercial-admin'));
 PERFORM 1 FROM private.manual_payment_settings WHERE singleton FOR UPDATE;
 PERFORM 1 FROM private.gateway_settings ORDER BY provider FOR UPDATE;
 UPDATE private.gateway_settings SET enabled=false,updated_at=clock_timestamp(),updated_by=auth.uid() WHERE enabled;
 UPDATE private.commercial_settings SET vendor_clickwrap_enabled=false,legal_publication_enabled=false;
 INSERT INTO private.manual_payment_events(actor_id,action,note) VALUES(auth.uid(),'release_forward_containment',reference);
 INSERT INTO private.business_audit(actor_id,action,reason,details)
 VALUES(auth.uid(),'release_forward_containment',reference,jsonb_build_object('executor',current_user,'customerLegalEnforcementPreserved',true,'paymentInitiation','closed','vendorAcceptance','closed','publication','closed'));
END $contain$;
COMMIT;
-- Afterward: no new instructions; preserve instructions and order receipts,
-- authorized receipt/refund reconciliation and legitimate historical callbacks.
-- Reopening is a separate approval; never replay an old enabled-state snapshot.
