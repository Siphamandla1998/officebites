# OB-UAT-20261020 recovery validation

Scope: local recovery work only. Hosted inspection was read-only and restricted to verified staging project `eyhmarmekioovcjibcbr`. No hosted configuration, schema, accounts, orders, roles, messages, payments, Vercel settings or deployments were modified.

Latest prerequisite follow-up: [21 October operator evidence and installation decision](vendor-direct-uat-prerequisites-20261021.md). Existing local recovery results were not rerun. Any service-level prior REST hook discovered through the authoritative operator/support check must be reconciled with the recovery baseline before installation; empty database catalogs alone do not establish the effective value that would return on RESET.

## Observation overlay — 21 October 2026 (updated confirmation)

Operator directly confirms staging `eyhmarmekioovcjibcbr`: Email enabled, Phone disabled, public signup enabled, **custom SMTP disabled**, no configured Auth/Send Email hooks, all four methods disabled. No settings saved. Exact operator observation time was not supplied. These are operator Dashboard observations, not an agent screenshot or complete configuration export.

Tracked overlay: `checks/uat/fixtures/auth-baseline-20261021.json`. Preserve the original 20 October JSON/hash and 59 executed recovery assertions unchanged. No tests were repeated. Known absent/disabled-hook recovery was already tested and retains suppression.

Current read-only inspection found no applicable authenticator/database/global-role `pgrst.*` settings or candidate pre-config functions; UAT absent and all methods disabled. Earlier exact helper/owner/ACL comparison matched the tested baseline; migration remains `20261020100740`. Pre-install settings RPC succeeds without capability, as expected. Service-level environment settings remain unavailable through these reads. Health reports GoTrue v2.197.0.

Matching official release source routes standard Auth emails and all seven documented security notification categories through Send Email; its enabled branch returns hook success/error before SMTP. The SQL sink suppresses unrecognised categories as `other`. Source-level coverage/no-fallback review is complete; hosted attachment and non-delivery acceptance are pending. Sources, outside-hook channels and exact checks are in the operator checklist.

**Restoring no hook is unsafe notification recovery.** Email enabled permits built-in SMTP even with custom SMTP disabled. Keep a verified active sink, capture and private grants during database restoration. The tested generator does not mutate Auth settings. If attachment or non-delivery verification fails, stop provisioning/mail-producing operations, retain closed test access and flags off, and do not detach a working sink. If no sink attached, report suppression unestablished.

**NO-GO to begin conditional installation until effective PostgREST service/pre-config evidence and independent hosted notification inventory are complete.** The Auth/SMTP baseline and local recovery gaps are resolved. Runtime attachment, denial/reload and capture checks are subsequent installation acceptance criteria. No hosted changes performed.

## Captured baseline

`checks/uat/fixtures/recovery-baseline.json` captures staging at `2026-10-20T12:07:46.018459Z`, before security installation:

- Project identity: officebites-staging, ACTIVE_HEALTHY, independently read before the SQL capture.
- Latest migration: `20261020100740`; UAT security not installed; all four payment methods disabled.
- Exact `pg_get_functiondef(private.active_account())`, owner `postgres`, raw ACL and expanded grantor/grantee/grant-option entries. EXECUTE grants: postgres, anon, authenticated; no PUBLIC or service_role grant.
- Authenticator role `pgrst.*` settings: none. Database/global-role catalog `pgrst.*` overrides for the current database: none.
- Hosted Auth email-hook configuration in the original 20 October capture: **unknown**, not accessible through the connected read tools. Null in that historical snapshot is explicitly marked `previous_hook_known:false`; see the dated operator observation overlay above for the newly established no-hook baseline.

REST catalog absence does not prove the absence of an environment-level PostgREST override or confirm live reload behavior. Reconfirm the effective configuration before hosted installation. No SMTP credentials, email addresses, Auth tokens or hook secrets were captured.

## Recovery implementation

`checks/uat/recovery.mjs` generates the exact SQL restoration steps from that verified baseline. It has no network connection or Auth configuration API. It restores the original function body, owner and complete EXECUTE ACL, revoking unexpected grants and grant options; restores only the authenticator pre-request setting that installation changes; and emits the PostgREST reload notification. Database-level settings are compared and remain untouched.

Run all steps inside **one transaction**, not one commit per statement. Preconditions require the verified staging target, all payment methods disabled, retained suppression configuration/function and no active allowlisted test profiles. The original private copy, UAT tables, captures and immutable financial history are retained. No DROP, data deletion or gateway reactivation is generated. The existing SQL installer is unchanged.

The recovery authorization guard for external Auth state refuses an unverified current suppression hook. Unknown/disabled/externally delivering previous configuration produces `retain-suppression`, not an automatic Auth reset. Even a known previous hook is eligible for exact restoration only with explicit operator verification of an enabled, matching, no-delivery replacement. This guard is tested as a pure configuration model; it does not verify the actual hosted Auth service.

## Executed tests

Focused command, from repository root with the existing local Node runtime/dependencies:

```text
node checks/uat/verify-recovery.mjs
```

**59 assertions passed** in isolated PGlite. The test reconstructs the captured body, owner and grants; applies the existing `checks/uat/staging-security.sql`; installs a real PostgreSQL role configuration for the REST gate; executes the recovery SQL; and compares before/after catalogs. It never connects to Supabase, provisions users or sends messages.

| Case | Actual result |
| --- | --- |
| Captured function definition, owner and grants reproduced | PASS |
| Captured empty REST role/database configuration reproduced | PASS |
| Security installation changes the helper and attaches the REST role setting locally | PASS |
| Restoration from changed body, wrong owner, extra PUBLIC/service_role grants and grant option | PASS; original definition, owner, expanded grants and raw ACL match exactly |
| Restore empty previous REST setting | PASS; no hook setting remains |
| Restore nonempty previous REST hook | PASS against a separate explicit local scenario baseline |
| Database-level REST configuration | PASS; unchanged |
| Interrupt after body, ownership, ACL or REST-setting step | PASS; transaction rollback restores installed state and suppression remains callable |
| Actual SQL error (division by zero) during restoration | PASS; rollback restores installed helper and REST gate |
| Resume partially completed manual restoration | PASS; replay restores exact baseline |
| Repeat completed database restoration | PASS; idempotent |
| Capture history | PASS; existing capture rows preserved exactly, new suppressed capture remains redacted |
| Payment settings and order/suborder/receivable/adjustment fingerprints | PASS; unchanged by recovery |
| Unknown, disabled or potentially delivering Auth baseline | PASS; suppression retained, exact Auth restoration explicitly not claimed |
| Unverified current hook or disabled replacement | PASS; authorization refused |
| Interruption before DB recovery, after body/REST change or after commit | PASS in configuration model; no Auth settings mutation generated |

Local Auth-hook calls use synthetic payloads, execute the actual installed SQL capture function, return `{}` and retain no raw recipient/token. There is no SMTP client in the runner. This establishes that the recovery code itself neither removes the sink nor sends email. It does **not** establish GoTrue's runtime behavior after a failed hook or coverage of hosted security-email categories.

The same assertions are integrated into `checks/checkout-database.mjs` immediately after the existing manual-payment suite, before existing UAT-security checks. That run validates recovery against populated synthetic order/ledger fixtures; the fast runner uses minimal empty history tables for iteration. Initial test development hit an invalid fixture grant (PUBLIC cannot receive WITH GRANT OPTION) and a cleanup diagnostic issue; both were corrected before the passing runs. These were local test-harness errors, not hosted failures.

Machine-readable evidence and generated operator SQL are local and Git-ignored:

- `.officebites-local/OB-UAT-20261020/recovery-evidence.json`: assertion results, baseline hash, exact before/after definition/owner/ACL and REST values; explicit Auth-model limitation.
- `.officebites-local/OB-UAT-20261020/recovery-reviewed.sql`: generated transaction using the same steps exercised by the tests. It is **not** authorization to execute hosted recovery.

Focused lint passed for all three new recovery modules. No frontend/runtime code changed; build repetition is unnecessary for this recovery-only work.

## Operator verification still required

Before claiming the hosted installation prerequisites satisfied:

1. In the **staging** dashboard, Auth > Hooks > Send Email: capture enabled/disabled status and configured function/endpoint. Capture other Auth hooks, email/password provider and signup state, security-notification categories, SMS/phone-provider state, and SMTP configured/capture-only status. Redact credentials, tokens, addresses and endpoint secret query parameters. Timestamp and bind the record to the exact staging ref.
2. If any external delivery is configured, record it as unsafe to restore during UAT recovery. Recovery must retain the approved suppression hook or switch only to an independently verified capture-only replacement. Never restore a disabled Send Email hook merely to match the baseline: that may re-enable SMTP delivery.
3. During the separately approved installation/verification phase, verify the installed hook URI is `pg-functions://postgres/private/uat_send_email`, enabled, with the expected grants. Confirm signup/confirmation, invitation, recovery and uncovered security-email paths are suppressed or explicitly disabled through supported configuration. Do not send probes to real recipients. Configuration evidence or non-delivering controlled probes must establish error/fallback behavior; local PGlite cannot run hosted GoTrue.
4. Check effective PostgREST pre-request configuration, including database and role overrides and any service/environment configuration. Confirm catalog restore/reload through non-mutating REST checks after any approved recovery. Local SQL NOTIFY succeeds but no PostgREST listener runs in these tests.
5. Before any hosted recovery, close test access and revoke test sessions, disable all payment methods, refresh function/ACL/settings snapshots and compare hashes/definitions with the approved baseline. Use one transaction. A failed statement or uncertain connection outcome requires read-only state reconciliation before retry; do not continue statement-by-statement or detach the Auth sink.

If interrupted before commit, PostgreSQL rollback keeps installed database restrictions. If the client loses the response around commit, compare actual helper/ACL/REST catalogs to both installed and restored states before deciding whether to retry. The tests exercise transaction rollback and idempotent replay, not network loss or process crash against a native hosted server. If an earlier operator committed only part of restoration, stop browser/UAT activity and replay the complete approved transaction after confirming suppression remains active; do not assume the partially restored state preserves UAT isolation.

## Prerequisite decision

**Local database recovery is verified for the captured function/ownership/grants and catalog REST baseline.** The recovery SQL preserves the email sink rather than returning unknown Auth delivery settings to an assumed baseline.

**The full hosted installation prerequisites are not yet satisfied.** Auth/SMTP baseline and version-matched source coverage/no-fallback review are complete. Effective PostgREST service/pre-config review and independent hosted notification inventory remain operator actions. After they pass, use the existing install-and-verify sequence and stop on any failed runtime acceptance check. No tests repeated or hosted changes performed.
