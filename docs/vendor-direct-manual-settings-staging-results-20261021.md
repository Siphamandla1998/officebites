# Staging manual settings fix - installation results

The approved singleton fix was applied only to Supabase staging `eyhmarmekioovcjibcbr`. **15 staging read-only verification checks and five production comparisons passed.** No Save Settings RPC, payment activation, accounts, orders, Vercel deployment, provider-secret change, access-link operation or rollback was performed.

## Migration identity and preflight

- Reviewed file: `supabase/migrations/20261021094956_fix_admin_manual_settings_singleton.sql`.
- Tested SHA-256, reverified before application: `2530d923433e0643f1fa138b21dfcd357bfa5952136d71ebefb8e2d92d67958f`.
- Supabase assigned hosted identifier **`20261021100655_fix_admin_manual_settings_singleton`**. The tool assigns the timestamp; this is the exact reviewed SQL, not an additional migration. Exactly one history entry was added (53 entries before, 54 after); all previous entries preserved.
- Target independently verified officebites-staging, ACTIVE_HEALTHY, PostgreSQL 17.6. Required prior manual-payments migration `20261020100740` present. No unrelated pending local migration applied.
- Live original function definition, owner, ACL and four dependency helper definitions matched the captured/tested baseline. Singleton constraints and row verified; all four methods off. No drift in the reviewed function/dependency/settings baseline.
- Pre-application schema/security metadata fingerprint, other-function definition/permission fingerprint and 57 public/private table row counts/SHA-256 fingerprints captured. Total historical/configuration rows: 133, including 15 orders. No raw customer/bank records exported.

Pre-checkpoint captured `2026-10-21T10:04:54.615648Z`; record fingerprints captured immediately before application. Full before/after function definitions and raw ACLs are in the local evidence files below.

## Function before and after

Before:

```sql
UPDATE private.manual_payment_settings
SET deadline_minutes=p_minutes,review_threshold=p_threshold;
```

After:

```sql
UPDATE private.manual_payment_settings
SET deadline_minutes = p_minutes,
    review_threshold = p_threshold
WHERE singleton = true;

GET DIAGNOSTICS updated_rows = ROW_COUNT;
IF updated_rows <> 1 THEN
  RAISE EXCEPTION 'Expected exactly one manual payment settings singleton row';
END IF;
```

The deployed function body equals the reviewed SQL body exactly. Active-account/admin checks, reason validation, the two manual-gateway helper calls and the settings audit event remain present. No gateway helper/provider-blocking function was changed. This was function-definition DDL only; the UPDATE inside the function was not executed during installation.

## Verification results

| Check | Result |
| --- | --- |
| Targeted WHERE and exactly-one-row guard | PASS |
| Function body equals reviewed migration | PASS |
| Existing function OID | Unchanged: 27063 |
| Function owner | Unchanged: postgres |
| Raw ACL | Unchanged: `{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}`; no PUBLIC/anon EXECUTE introduced |
| SECURITY DEFINER and fixed empty search path | Unchanged |
| Settings row | Exactly one, singleton true, **15 minutes / R500** |
| Manual EFT / manual PayShap | Both disabled; ready true, maintenance false unchanged |
| PayFast / Ozow | Both disabled; existing readiness/maintenance preserved |
| Other function definitions/ownership/grants/configuration | Aggregate fingerprint unchanged |
| Relations/column definitions/constraints/RLS/policies/triggers/views/table-column grants | Aggregate fingerprint unchanged |
| Historical/configuration records | All 57 table counts and ordered SHA-256 fingerprints unchanged, including gateway metadata and audit/event history |
| Migration history | Exactly the approved single migration appended |

All four gateway states remained disabled before and after. Settings save was not called with either true or false; therefore no gateway notice/timestamp or configuration/audit row was changed by a functional RPC probe.

## Production checks and findings

Production Supabase project metadata and migration history are identical before/after this operation. No production DDL/DML/settings call was made. All three Vercel aliases retain production deployment `dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt`, with identical routing, timestamps and protection-bypass metadata across this operation:

- officebites.co.za: updatedAt `1792575393032`.
- www.officebites.co.za: updatedAt `1792575393029`.
- officebites-pi.vercel.app: updatedAt `1792575393024`.

These timestamps were already different from the earlier Preview release report when first inspected in this task. Routing was unchanged. This is a **pre-existing metadata discrepancy**, not a change detected during this migration; its external cause was not investigated or assumed harmless here. No authenticated fetch/share-link helper, alias mutation or Vercel deployment was used. No new unexpected schema/data/permission effect was detected from the migration.

## Evidence and recovery

Git-ignored evidence under `.officebites-local/manual-settings-singleton/`:

- `staging-preapply.json`: original function definition/permissions, schema/other-function fingerprints, all table counts/fingerprints and prior migration history.
- `staging-installation-evidence.json`: migration result/hosted identifier, 15 staging checks, five production checks, full before/after function definitions/permissions and historical record fingerprints.
- `test-evidence.json`: prior 70 executed local assertions. They were not rerun unnecessarily; no local implementation changed in this installation.

No rollback executed. If a later issue arises, keep payment methods disabled and stop settings saves. Reconcile actual function/state read-only before any action. Do not automatically restore the defective function. Definition-only recovery, if separately approved, follows `docs/vendor-direct-manual-settings-singleton-fix-20261021.md`; no data/flag/history rollback is needed for this DDL-only change.

The local filename and hosted migration timestamp differ. Preserve the mapping above and do not blindly run `supabase db push`: local historical migration versions already differ from hosted versions. Any later migration-history reconciliation needs explicit review; no ledger repair or file renaming was done here.

## Readiness for controlled functional retest

**Ready for a separately approved, existing-admin Save Settings retest**, with both manual flags false, deadline 15 and threshold 500, and a reason between 10 and 500 characters (the existing downstream gateway-notice cap). No enabled payment method or new account/order is needed. That RPC write would intentionally update manual-gateway metadata and add two business audit records plus one manual settings event, so it is outside this read-only verification approval and was not executed.

The native HTTP 400 resolution is not yet functionally verified through PostgREST. Local 70-assertion SQL evidence plus the exact installed WHERE/row-count guard support proceeding to that controlled retest; do not claim a hosted Save Settings success before it runs.

Remaining separate findings: unqualified updates in finance-policy, retention and delivery-hub settings functions, the preserved 1000-character outer reason limit versus 500-character gateway-notice cap, and previously documented broader UAT/security prerequisites. None was changed under this single-migration approval. No payment activation, hosted payment UAT or launch readiness is authorised or claimed. Stop here.
