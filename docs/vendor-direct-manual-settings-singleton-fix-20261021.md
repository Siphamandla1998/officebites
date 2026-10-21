# Manual settings singleton UPDATE fix - local validation

Status: local fix validated; **not applied to staging**. No hosted configuration or payment method changed, no orders/accounts, no deployment/push/commit. Branch `feat/vendor-direct-launch-payments`; existing unrelated work preserved.

## Exact migration

`supabase/migrations/20261021094956_fix_admin_manual_settings_singleton.sql`, created with Supabase CLI 2.121.0 `migration new` after inspecting command help. Forward-only `CREATE OR REPLACE FUNCTION public.admin_manual_settings(boolean,boolean,integer,numeric,text)` inside a transaction with a ten-second lock timeout. No RPC invocation, data update, gateway activation, grant/owner change or new privilege is executed by the migration itself.

The function retains the exact active-account/admin checks, reason validation, existing gateway helper calls and manual audit event. The sole behavior change is:

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

The existing boolean primary key and CHECK(singleton) enforce at most one valid target. A missing row, trigger-suppressed update or unexpected duplicate target fails before gateway/audit operations. An exception later in the function rolls back the earlier settings/gateway/audit writes as part of the same statement transaction. [PostgreSQL ROW_COUNT documentation](https://www.postgresql.org/docs/17/plpgsql-statements.html#PLPGSQL-STATEMENTS-DIAGNOSTICS).

The previously applied source migration was not edited. Its SHA-256 remains `b5e3ebbea124fa394c2fd71dba82c24963cb7a02bfeaa0f09b856f833f6e1af3`. Existing local filename `20261020090841` corresponds to hosted version `20261020100740`; do not use a broad migration push that could replay it.

## Read-only staging evidence

Verified project: `eyhmarmekioovcjibcbr`, officebites-staging, ACTIVE_HEALTHY. Initial capture `2026-10-21T09:47:32.411379Z` confirmed the unqualified deployed UPDATE, owner postgres, ACL `{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}`, fixed empty search path and SECURITY DEFINER. Latest migration `20261020100740`.

One settings row: singleton true, deadline 15 minutes, review threshold 500. PayFast, Ozow, manual EFT and manual PayShap all false. Final read after local testing confirmed all remain false, the same numerical settings and the old hosted function still installed. No hosted save RPC was called, including no enabled=true request.

Sanitised tracked baseline: `checks/fixtures/manual-settings-baseline-20261021.json`. Contains function/helper definitions, function owner/ACL, nonsecret settings and method flags, no customer/banking data, Auth credentials, real actor IDs or provider secrets.

## Executed local validation

Command: `node checks/manual-settings-singleton.mjs` using existing local Node/PGlite dependencies.

**70 assertions passed**; focused lint passed. Evidence: `.officebites-local/manual-settings-singleton/test-evidence.json`, including the migration hash and individual results.

- Active admin saves unchanged settings, with expected gateway audits and one manual settings event. Only explicit numerical changes affect deadline/threshold; restored to baseline afterwards.
- Anonymous, customer, vendor, suspended/deleted admin and service-role caller without an admin identity rejected.
- Missing/invalid deadlines, thresholds, reasons and null flags rejected; settings/gateways/audit rows unchanged on each failure.
- Missing singleton rejected. Deliberately removing the PK only in the isolated fixture and inserting duplicate true rows proves the >1 row-count guard and rollback. Real schema prevents such duplicates; fixture constraints restored afterwards.
- Failure in the second gateway update undoes the first gateway update and numerical change. Failure at final audit insertion undoes all preceding updates and audit rows. Failed transactions may consume sequence values; no unsuccessful audit rows persist.
- PayFast/Ozow reactivation attempts rejected through gateway RPC and provider trigger. Ozow's not-ready guard can reject before its trigger; tests cover both readiness rejection and direct trigger protection. No method was activated in local or hosted tests.
- Migration application/reapplication changes no settings or audit rows and preserves function OID, owner, ACL, definer status and search path.
- Captured prior definition restores exactly without touching settings/audits or ownership/grants; corrected definition reinstalls without configuration changes.

First test run stopped because the Ozow activation test expected only the trigger message; the existing not-ready guard rejected earlier. The expectation now accepts that legitimate rejection, and a separate direct-update attempt proves the provider trigger. This was a local test expectation issue, not an activation or hosted failure.

Limitations: PGlite executes actual migration SQL and captured Auth/admin/gateway helper definitions against synthetic role/profile schemas. It does not run native GoTrue, PostgREST, the safe-update extension or native concurrency. The explicit targeted WHERE is verified in source; end-to-end hosted 400 resolution is **not claimed** before installation/transport verification. No frontend regression rerun/build needed: no frontend code changed.

Existing reason limits are preserved: outer function accepts trimmed lengths 10-1000, but gateway notice helper rejects lengths >500. Such requests remain atomic failures; this migration deliberately does not change that existing contract.

## Surrounding-function review

Read-only inspection of current deployed bodies and source found:

| Function/path | Finding | Action |
| --- | --- | --- |
| admin_manual_settings | Unqualified singleton update causes the reported error | Fixed by this forward migration |
| admin_update_payment_gateway | Provider-key WHERE and NOT FOUND guard present | Preserved |
| service_confirm_delivery_checks | Revision/verification WHERE and NOT FOUND guard present | Preserved |
| admin_save_delivery_hub (also called by admin_update_delivery_settings) | Unqualified private.delivery_settings UPDATE | Separate follow-up required; not changed here |
| admin_set_fee_policy | Unqualified private.finance_settings UPDATE | Separate follow-up required; not changed here |
| admin_configure_retention | Unqualified private.retention_settings UPDATE | Separate follow-up required; not changed here |
| Historical retention job registration/manual gateway-disable migration statements | Additional unqualified one-time migration UPDATEs | Historical files retained; do not replay as an operational remedy |

These findings mean the broader admin settings surface is not certified fixed. Do not disable safe-update protections or add WHERE true as a workaround.

## Recovery / rollback procedure

1. Before any future authorised staging installation, verify exact project/migration state, all four flags false, current function definition/owner/ACL and singleton count/value against this checkpoint. Capture a fresh private checkpoint and the new migration hash. Stop on drift. Apply only this reviewed migration, not all local pending migrations.
2. Failure before transaction commit leaves the previous function and settings intact. Do not continue statement-by-statement or run destructive rollback. For uncertain commit outcome, inspect the actual function definition/owner/grants and migration ledger read-only.
3. After a successful commit, prefer keeping the targeted fix and stopping settings saves while investigating any issue. The migration itself changes no configuration values, so no payment flags/data/history restoration is necessary. Keep all four methods disabled.
4. If a definition rollback is explicitly required/approved, create a **new forward recovery migration** using the captured `function.definition` in the baseline (or the fresh pre-install checkpoint). Restore only that function body in one transaction; do not drop the function, change its signature/owner/grants, modify tables or restore old enabled gateway flags. Re-read owner/ACL/security properties and payment flags afterwards. Local tests exercised this definition-only restoration and reinstall.
5. Restoring the original body also restores the known safe-update 400 failure. It is a recoverability fallback, not the preferred working state. Do not disable safe-update protections to make the old body execute. No hosted recovery authorised or performed here.

## Required approval and subsequent acceptance

Separate approval is required to apply **only** this migration to staging project `eyhmarmekioovcjibcbr`. No deployment or payment activation is required. After approved application: verify definition, grants/owner and one singleton row; confirm all flags still false and historical records unchanged; then obtain/confirm permission for an authorised admin unchanged-settings save with both manual flags false and reason supplied. That write will create expected audit entries/update gateway metadata. No enabled=true hosted call is needed to verify the fix. Keep native PostgREST transport validation explicitly pending until that controlled check succeeds.
