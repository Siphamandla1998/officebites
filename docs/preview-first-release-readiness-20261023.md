# OfficeBites preview-first release readiness — 23 October 2026

Decision: GO for preparation using GitHub, Vercel Preview and staging; NO-GO for installation, provisioning, synthetic payment enablement, hosted UAT or production promotion. Removing the local Docker dependency does not remove security prerequisites. This report is preparation only; no hosted state, Git commit, branch, deployment or payment flag was changed.

## 1. Current inventory and fresh evidence

Read-only inspection used Supabase project/migration/function/advisor metadata and SELECT queries; Vercel project/deployment/alias/environment GETs; GitHub branch/contents GETs; ordinary unauthenticated GETs of public HTML and referenced JavaScript. No authenticated URL-fetch helper, share-link tool, payment RPC, Auth mutation or notification probe was used. Key comparison was private; no plaintext keys are included here.

| Item | Evidence / conclusion |
|---|---|
| Repository | `Siphamandla1998/officebites`, local `feat/vendor-direct-launch-payments`, HEAD `695e5e19cf581f6202dcc058afad1ee2fba23208` |
| Working tree | Many modified/untracked files; latest collection/assisted/custody work is uncommitted. Preserve unrelated `OFFICEBITES-PREVIEW-RELEASE-20261016.md` and previously inventoried work. No upstream feature branch appears in the remote branch listing. |
| Remote main | `4c4835db62b7db4c7a725c92d7a6294ca523fa57`, `protected:false` in branch metadata; listed development branches also unprotected. |
| Staging | `eyhmarmekioovcjibcbr`, officebites-staging, ACTIVE_HEALTHY, eu-west-1, PostgreSQL 17.6.1.166 |
| Production database | Separate project `gfzhdkitdyqftealgqfi`, OfficeBites, ACTIVE_HEALTHY. No production SQL executed. |
| Vercel | `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71`, team `team_kKRzCLk1pNHoIA4sV1M0ciSg`, officebites, Vite, configured Node 24.x. Local tests used Node 22.23.3: release build must validate the actual configured runtime. |
| Existing Preview | READY `dpl_DGWZnPj1ubqxzCfzDcZVUJ3iEYTQ`, https://officebites-70l6nc42z-sp24tg-6983s-projects.vercel.app ; target null/non-production. Connector exposes no Git SHA for this deployment. Commit attribution comes from the earlier release manifest/report, not fresh Git metadata. |
| Served Preview backend | Ordinary HTML/JS GET: HTTP 200, staging project reference present; known production reference absent in fetched entry assets. This is an entry-asset check, not exhaustive dynamic-chunk/source equality proof. |
| Preview environment | Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` scoped Preview. URL exactly staging; key privately matched to that staging project's publishable keys. Listed records have no branch override. Production env values were not decrypted. |
| Client credentials | No actual `sb_secret_` key pattern in fetched Preview entry assets; the literal SDK prefix appears in validation code and is not evidence of a leaked secret. No service_role literal in those assets. Full release artifact secret scan remains required. |
| Preview protection | Vercel project metadata reports password, SSO and trusted-IP protection disabled. Public GET succeeds. Not suitable for synthetic financial UAT yet. |
| Production routing | `officebites.co.za` still routes to `dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt`, immutable `officebites-ms6sjgmw8-sp24tg-6983s-projects.vercel.app`; matches older routed ID. Public entry assets reference production, not staging. Alias updatedAt now `1792740956743`; its cause was not investigated here. |
| Latest production-target deployment | Separate READY `dpl_scmC1TZScp3TMFjd5QEotugBexxG`, `officebites-l0wrubwa8-sp24tg-6983s-projects.vercel.app`, created `1792740584681`. This differs from the older report. Latest deployment is not the domain's routed deployment; no claim that all production metadata remained unchanged. |
| Git automation | No local `.github/workflows`; remote main `.github` GET returned 404. Workflow-list API rejected by connector. Vercel GET projection does not expose production-branch/Git integration settings, deploy hooks or all automation. Absence of automatic production deployment is NOT established. |
| Existing policy | All four gateway `enabled` flags false; deadline 15, review threshold 500. Delivery disabled, existing paid fee R15. R0 collection remains the only approved collection policy; no R10 activation. |
| Existing staging data | 15 orders: 14 `is_test=false`, 1 true. Four Auth users: one `.invalid`, three other/missing domains. Zero manual payment rows; zero payment profiles/approved profiles. Staging is project-separated, not synthetic-only. Never delete/reclassify this history to make tests convenient. |

The prior Phase 5 results remain evidence: 777 native assertions, 728 PGlite assertions, full local service runner, 74 browser regressions, lint and PWA build passed. Browser RPC fixtures do not establish real hosted integration. No regression suite was repeated for this documentation-only task.

## 2. Exact staging blockers

| Blocker | Owner / evidence needed |
|---|---|
| Security/collection/assisted/custody absent | Fresh `to_regclass` checks return NULL for `private.uat_security`, `pilot_policy`, `collection_activation`, `assisted_controls`, `cash_custody_policy`; private email hook absent. Developer must prepare reviewed hosted installers, not run fixture candidates as-is. |
| Effective PostgREST configuration unknown | Operator/Supabase Support: running version, db-config, db-schemas, db-pre-request, db-pre-config, all override provenance and reload behaviour. No role/db pgrst overrides were found; authenticator lists safeupdate/preload/timeouts. These catalogs do not prove effective service settings. |
| Notification isolation unproven | Operator: fresh Auth provider/signup/SMTP/Send Email hook configuration; source-matched failure/fallback evidence; deployed Edge/provider integrations and operational channel inventory. Prior Dashboard baseline is historical. No-hook plus enabled Email Auth must not be called suppression. |
| Existing non-synthetic identities/history | Operator/security reviewer: scoped, expiring API capability and actor allowlist; effective direct API denial; preserve existing records. No broadly public synthetic checkout. |
| Preview publicly accessible | Operator: separately approved Preview-only protection; confirm actual scope and public production access. Never use share links or the prohibited helper. Frontend protection alone cannot secure direct Supabase access. |
| Migration version divergence | Developer: reconcile source-to-hosted provenance by content before any installer. Do not use blanket db push, replay old files or fabricate matching history entries. |
| Git/Vercel production automation unknown | Repository/Vercel administrator: actual production branch, connected repo, deploy hooks, custom environment branch mapping, integration permissions and rulesets; enforce reviewed-branch Preview target. Main is currently unprotected in branch metadata. |
| No approved bank profile / synthetic fixtures | Operator after separate approval: provision/reuse only verified synthetic identities, independently approve synthetic vendor destination, reviewed commission agreement/window. Zero profiles currently. |
| Source not yet release packaged | Developer/reviewer: exact source inventory, full diff, dependency/secret scan, immutable commit/artifact manifest. Current Preview does not contain uncommitted new backend/UI work. |
| Remaining race/transport evidence | Developer/security: suspension after validation, concurrent pending handover transitions, all opposite receipt/cancellation orderings, real Auth/PostgREST/guest/RLS/CORS paths. No claim these were satisfied by read-only preflight. |

Fresh advisor output: 31 private tables with RLS/no policies (consistent with denied direct access but requires RPC review), 10 anonymous and 53 authenticated SECURITY DEFINER API warnings, plus leaked-password protection disabled. Warnings are review inputs, not proof of exploitable escalation. Preserve intentional guest APIs and test their explicit token/ownership checks. [Advisor remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [password-protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Fresh selected private-table checks: gateway/settings/manual payments/vendor profiles have RLS enabled, anon SELECT false and authenticated UPDATE false. No pg_cron/pg_net/http extension was found. This does not rule out external schedulers, Edge Functions or third-party messaging.

## 3. Migration manifest and review plan

Hosted last migration: `20261021100655_fix_admin_manual_settings_singleton`. Previous manual-payment migration: `20261020100740_vendor_direct_manual_payments`. Local provenance files are respectively `20261021094956_fix_admin_manual_settings_singleton.sql` and `20261020090841_vendor_direct_manual_payments.sql`. Similar timestamp remapping exists in older migrations. Different IDs are known provenance divergence, not proof that duplicate installation is required or that all contents match. Capture hosted definitions/owners/grants and compare each prerequisite before approving a new migration.

SHA-256 of exact current candidate bytes:

| Source | SHA-256 |
|---|---|
| `checks/uat/staging-security.sql` | `50dfb18c768421f3299722fa751a812ee8d278a9ee855b6d6562073c37a7a756` |
| `checks/pilot/booking-candidate.sql` | `6625ddacfe65a184cc8d356a284d58cd8559dc52dbf93f9af6fa0c7ba13e4a18` |
| `checks/pilot/atomic-collection-candidate.sql` | `c7f2f5db6e93c3c0d3a782d1deaa5e5b7c9989f57662b6f05029af8e72c03122` |
| `checks/pilot/assisted-cash-candidate.sql` | `29d37659983715cb9de704ed13a6a875e92c1b1d10f895e3da3ef8adab521db5` |
| `checks/pilot/cash-custody-candidate.sql` | `d124d0f1324896d98d607116dfb4416d863ffb7f1b12dc6b3d5745831ffd14c8` |

All five are uninstalled. The four pilot files explicitly require the isolated fixture marker and are NOT hosted installers. Setting that marker on staging is prohibited as a shortcut. Convert them to reviewed forward installers with target/dependency/drift checks, locked defaults and explicit transactional boundaries. Do not import synthetic test data into schema installers. Retain original local candidates and regenerate checksums for the actual installers. Migration names/versions for those installers remain unassigned; this report does not invent execution-ready versions.

Proposed repository release structure:

```
src/                         reviewed UI/services only
supabase/migrations/         new portable feature installers, locked defaults
supabase/staging/            reviewed staging-only security installer/config runbook
supabase/functions/          only reviewed changed functions/shared dependencies
checks/pilot/                candidates, SQL/RLS/native tests; not runtime upload
checks/uat/                  operator provisioning/checkpoints; never build hooks
docs/                       manifests, provenance mapping, approval and recovery evidence
```

Proposed local commits, only after separate approval: (1) locked feature schema/installers and tests; (2) assisted/customer UI/service integrations and dependencies; (3) staging security/operator tooling plus readiness documentation. Review atomic collection/AdminPayments/orderService prerequisites so no dependent code is omitted. Stage explicit paths; never `git add .`. Exclude old unrelated release notes, `.env*`, `.temp`, `.officebites-local`, credentials, screenshots/generated build/runtime files and real-data seeds from the release artifact. Review whether safe documentation belongs in Git separately from runtime upload. Run secret scanning on staged diff and exported artifact. No commits/pushes made here.

## 4. Installation and environment sequence

Every hosted step below needs a new bounded approval after blockers close:

1. Capture fresh staging identity/history/schema/definitions/owners/ACLs/RLS/config, gateway/delivery values, row counts and immutable financial fingerprints. Confirm a provider backup/recovery point and its retention/restore procedure; this task did not create or verify a recoverable hosted backup. Obtain historical Auth and effective REST configuration readback. No data reset.
2. Accept PostgREST/notification/protection evidence. Install staging security SQL first, with all gateways disabled and no allowlist window open; attach the reviewed private Auth sink and REST pre-request via supported configuration, read back effective settings and perform non-delivering deny checks. If hook/fallback or REST gate verification fails, stop, retain safe sink/gates, do not provision and do not restore no-hook baseline as suppression.
3. Install reviewed feature migrations in dependency order: booking → atomic collection → assisted/EFT/cash → custody foundation. Verify history after each, exact grants/RLS/default locks and old financial fingerprints. Admin custody stays NULL; collection policy disabled; EFT/cash expiry gates NULL. Do not activate delivery or change R15. The portable implementation must coexist with the staging active-account wrapper rather than overwrite it.
4. Edge Functions: no new EFT/cash gateway is required; these paths are SQL RPCs. Default Edge deployment scope is **zero**. Existing deployed versions: payfast-initiate 22, payfast-notify 20, ozow-initiate/webhook/reconcile 4, admin-account-removal 3. Keep historical callbacks/reconciliation available and PayFast/Ozow initiation blocked. If a separately reviewed security/CORS change is necessary, deploy only that named function and pinned shared imports to staging, inspect verify_jwt/auth checks and OPTIONS/denied-origin behaviour, then reverify versions. Never redeploy all functions or modify provider secrets.
5. Export the approved commit into a clean allowlisted artifact. Verify `VITE_SUPABASE_URL=https://eyhmarmekioovcjibcbr.supabase.co` and that the public key belongs to that project. Inspect Preview environment plus branch/custom-env/build overrides and every payment/function URL. No production endpoint, provider credential, secret/service-role key or real banking data. Do not trust local `.env.local` or merely the Preview label.
6. Deploy exactly that commit to **Preview only** in the verified project/team after separate deployment approval. Retain old Preview, do not assign production domains or promote. Verify READY, source/artifact provenance, served backend references, routes, immutable assets and production alias/config baseline again.
7. Only after security transport acceptance, provision scoped fixtures and open a separately approved short synthetic UAT window; close all gates and verify audit/record deltas at its end.

Existing PayFast/Ozow Edge source has origin handling and staging references; there are no production project references in the fetched source. Source inspection does not prove deployed secret values, all shared imports or live CORS readiness. Validate actual allowed/denied origins later with harmless OPTIONS/read-only endpoints; never call payment initiation during preparation.

Secret checklist: `VITE_*` is browser-visible. Only staging URL/publishable key permitted there. Operator/admin/service-role credentials stay in an encrypted local operator store or server-side secret manager, never Git, Preview assets, test traces or chat. The `x-officebites-uat` capability must not become a VITE build variable or public source constant. Inject it only into authorised test-session requests to the exact staging API host; expire/revoke it and redact traces. Verify CORS permits that header without enabling arbitrary origins.

## 5. Synthetic hosted UAT proposal

Reuse the existing `OB-UAT-20261020` manifest: vendorA/vendorB/customer/admin at `@officebites-uat.invalid`; admin starts with customer role and receives admin privileges only by a separately authorised operator, never signup metadata. Match/reuse only verified staging synthetic identities; never use unrelated users merely because their role fits. Generate credentials locally, encrypt before provisioning and keep retries idempotent. Refresh release/checkpoint IDs after the new approved Preview exists; current provisioning manifest deliberately pins the older release.

Vendor A: independently approved synthetic EFT recipient, explicit test commission agreement, approved menu and future R0 Eduvos window. Vendor B: no approved destination/other-vendor access adversary. Use clearly synthetic account identifiers that cannot route a real payment, staff-only synthetic receipt labels and no external bank API. No actual funds or cash change hands. Existing vendors/orders/users remain untouched. No arbitrary real bank details may be copied into a fixture.

Test order (each with persisted database assertions and redacted network evidence):

1. Baseline all-gates-disabled: public/non-allowlisted direct API denied; approved operator session can load appropriate reads; customer/guest sees unavailable methods and retains cart; admin cash creation denied. Assert no new records.
2. Confirm Auth sink, signup/invitation/recovery/email coverage, external channel disablement and transactional capture. Validate direct REST/RPC, Storage/Realtime/Edge isolation; frontend protection is insufficient.
3. A separately approved synthetic fixture transaction may temporarily enable only manual EFT plus bounded EFT/collection/assisted expiry controls, scoped to approved synthetic actors/vendor/window by the verified API gate and profile eligibility. Keep PayShap/PayFast/Ozow false and admin custody NULL. Because some existing gates are global, do NOT open this window unless effective backend restriction and synthetic-only profile eligibility are demonstrated. Proposed TTL 30 minutes is a test default requiring approval, not a launch policy. Close on any unexpected access.
4. Actual customer and guest EFT checkout: prices/quantities/vendor/date validated on server; R0 pickup, cutoff/capacity; unique order number/reference, immutable recipient/amount/agreement; pending payment until vendor records synthetic verification evidence. Customer report must not settle. Verify guest token/order isolation and protected tracking.
5. Separately bounded vendor-cash fixture window: authorise only synthetic vendor recipient and open vendor-cash expiry; full prepaid receipt/order/reservation must commit once. Test wrong amount, repeated/network-retried request, changed payload, invalid vendor, unavailable window and rollback. Vendor queue/admin reporting must agree with commission snapshot. Admin cash remains denied even if the vendor gate is open.
6. Concurrent requests: last capacity slot, duplicate receipt, cancellation/refund/verification, suspension before/after validation, failed commission posting and invalid transitions. Use authorised normal sessions; privileged read-only queries verify persisted balances. Do not use database superuser writes to impersonate an application payment action.
7. For custody adversarial API tests, default scope is denial with admin custody closed. Valid historical pending-handover concurrency needs an explicitly approved synthetic historical fixture; it does not authorise admin cash collection or choose gross/net settlement. Do not bypass immutable journals in hosted staging.
8. Outbox: correct synthetic recipient, no raw secrets/other-vendor data, no committed event on failed checkout, replay yields one logical event, delivery only to accepted sink. Recovery compares financial/outbox fingerprints without sending notifications.
9. Close gates/window first; restore four gateways disabled, 15/R500 and unchanged disabled R15. Assert one logical order/receipt/commission per request, expected audit actor/reason/IDs, and no unrelated record changes. Archive/label synthetic history under approved procedures; never delete accounting history to clean up. Revoke fixture access through separately approved admin operations; retain audit evidence.

No current configuration alone can guarantee these tests cannot expose real collection: effective allowlisting, recipient approval, notification controls and separate approval are prerequisites. Preview-first is the execution location, not a waiver.

## 6. Backup, recovery and stop conditions

Stop before any mutation if project/ref, checksum, migration dependency, expected definition, configuration provenance, production routing or record baseline differs. Stop immediately for unexpected financial writes, notification delivery, cross-vendor access, admin cash availability, unknown commit outcome or production connection. Do not retry mutations automatically.

Capture backup/checkpoint before installation, then check baseline after every operation. Previous local tests prove interrupted transaction rollback and specific committed permission/index forward repairs with data/outbox preservation; they do not prove full hosted schema rollback. Keep tested function/ACL snapshots and new installer checksums. A transaction failure may roll back that migration; a committed migration with cash history requires forward repair. Never drop financial tables, remove cash from constraints, delete history, detach a functioning mail sink or restore defective settings functions automatically.

Emergency plan: close approved staging entry windows/disable new methods under a bounded admin approval; retain protected customer tracking, historical reconciliation and notifications capture. Reconcile uncertain request IDs before retry. Use the previous immutable Preview as a UI fallback only if schema compatible. An older UI does not undo committed orders/cash. Compare exact financial fingerprints, grants/RLS and outbox counts after repair. Hosted restore and destructive recovery require independent incident approval; restoring staging from backup must not contact real recipients on restart.

## 7. Production promotion plan — separate future release

1. Independent technical/security/finance/operations review accepts staging UAT, bank onboarding, vendor agreement/refund terms and emergency procedures. EFT is primary; vendor cash and admin custody have separate approval decisions.
2. Capture production's own migration/schema/config baseline and recoverable backup. Build a production-specific forward diff excluding staging gate/hook/allowlist/synthetic seeds. Never copy staging migration ledger, users, orders, receipts, bank profiles or test notifications.
3. Approve exact commit/PR, protected-main merge/tag and automation scope. Verify GitHub/Vercel production branch, environment permissions and deploy hooks before push/merge; current metadata is insufficient. No force push.
4. Apply approved production schema changes with payment entry disabled; verify historical records and security. Deploy only explicitly changed Edge Functions with production-specific secrets and exact origins. Preserve historical PayFast/Ozow reconciliation; new third-party initiation remains blocked.
5. Build a fresh production artifact from the approved commit using production-specific configuration. Never promote the staging-built Vite artifact: its browser URL/key are baked into assets. Deploy production only with separate explicit approval, then verify aliases/backend, protected access, errors and financial invariants.
6. Enable EFT only for approved vendors after separate technical and business activation approval. Monitor failed checkout, duplicate requests, pending/expired bookings, receipt verification, commission differences, refunds/disputes, notification failures and access denials. Named operator owns emergency disablement and incident escalation. No real smoke payment without explicit transaction approval. Delivery policy remains separately governed.

## 8. Decisions and approval boundary

| Decision | Status |
|---|---|
| Preview-first preparation without Docker/WSL | GO |
| Current Preview/staging safe for synthetic financial UAT | NO-GO: publicly accessible, gates/sink absent, non-synthetic data and effective API config unresolved |
| Commit/push/new Preview | NO-GO until exact source/installers reviewed, automation scoped and explicit approval |
| Staging installation/provisioning/test window | NO-GO until execution-ready installers, recovery checkpoint and security evidence accepted |
| EFT / vendor cash / admin custody activation | NO-GO independently; all remain disabled |
| Production promotion | NO-GO; staging UAT and production-specific approvals outstanding |

Proposed approval package, **not executable yet**: target only `eyhmarmekioovcjibcbr`; reviewed security installer/config and booking → atomic → assisted → custody forward installers; exact new SHA-256 values and assigned history IDs; backup/forward-repair evidence; named fixture IDs/TTL/audit reason; zero Edge deployments unless named change approved; one verified-commit Vercel Preview in the project/team above; gated synthetic-only UAT and all-locks-closed closeout. Production, real funds, share links and provider-secret changes excluded.

Do not request blanket installation approval against the fixture hashes in this report. First complete the local installer conversion/review and operator evidence. Then present those exact bytes, migration identifiers, deployment source and test scope for explicit approval before the first hosted write. This avoids approving an undefined migration or unsafe global payment window.
