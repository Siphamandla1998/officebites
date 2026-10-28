-- Defense-in-depth RLS for private administrative tables.
-- No API-role grants are intended; backend-owned SECURITY DEFINER routines
-- continue to access these tables under the function owner's privileges.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'business_audit',
    'finance_settings',
    'account_removal_jobs',
    'retention_settings'
  ] LOOP
    IF to_regclass(format('private.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'Expected private table % is missing; aborting', t;
    END IF;
  END LOOP;
END $$;

ALTER TABLE private.business_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.finance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.account_removal_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.retention_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  private.business_audit,
  private.finance_settings,
  private.account_removal_jobs,
  private.retention_settings
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
