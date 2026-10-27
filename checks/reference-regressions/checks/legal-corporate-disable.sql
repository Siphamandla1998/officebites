-- Manual staging containment, not an automatic rollback or a production release script.
-- Retains published documents, signed evidence, ledger entries, read access and payout holds.
-- Existing sales/refunds cannot be safely undone by dropping tables or replaying migrations.
BEGIN;
UPDATE private.commercial_settings
SET onboarding_enforced=false,acquisition_enabled=false,standard_breakdown_enabled=false;
REVOKE EXECUTE ON FUNCTION public.admin_commercial_action(text,jsonb),
 public.prepare_vendor_consent(jsonb,jsonb),public.accept_vendor_legal(uuid,jsonb,jsonb),
 public.respond_corporate_agreement(uuid,boolean)
FROM anon,authenticated;
-- Private helpers also need revocation because authenticated already has private-schema usage.
REVOKE EXECUTE ON FUNCTION private.commercial_admin_action(text,jsonb),
 private.prepare_vendor_consent(jsonb,jsonb),private.accept_vendor_legal(uuid,jsonb,jsonb),
 private.respond_corporate_agreement(uuid,boolean)
FROM anon,authenticated;
COMMIT;
