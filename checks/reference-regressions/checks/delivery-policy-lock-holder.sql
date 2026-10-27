-- Run only against staging, concurrently with delivery-policy-lock-staging.sql.
-- Locks existing configuration without changing it; rollback releases the lock.
BEGIN;
SET LOCAL application_name='officebites-central-origin-lock-check';
SELECT singleton FROM private.delivery_settings FOR UPDATE;
SELECT pg_sleep(12);
ROLLBACK;
