-- HOSTED WRITE: approval required. Explicit project_id must be
-- eyhmarmekioovcjibcbr, verified independently before executing.
-- Forward stop only: retains profiles, orders, receipts, callbacks and history.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $$ BEGIN
 IF to_regclass('private.manual_order_payments') IS NULL THEN
  RAISE EXCEPTION 'Manual migration not installed; inspect staging state';
 END IF;
END $$;
UPDATE private.gateway_settings
SET enabled=false,maintenance=true,updated_at=clock_timestamp(),updated_by=auth.uid()
WHERE provider IN('manual_eft','manual_payshap','payfast','ozow');
INSERT INTO private.manual_payment_events(actor_id,action,note)
VALUES(auth.uid(),'staging_release_stop','Approved staging stop: all new checkout methods blocked; historical reconciliation and original instructions retained');
COMMIT;
