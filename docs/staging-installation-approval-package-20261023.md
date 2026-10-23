# Staging installation approval package — 23 October 2026

Decision: **NO-GO to execute today.** The exact staging-only SQL/request package is prepared and locally rehearsed. Backup/restore evidence, effective REST/Auth configuration, Preview protection and automation acceptance remain unsatisfied. The next decision can be made against concrete files below; no general or implied approval is requested. No hosted scripts/migrations, configuration changes, provisioning, commits, pushes or deployments were executed.

## 1. Exact targets and package

- Supabase: **`eyhmarmekioovcjibcbr`**, officebites-staging, ACTIVE_HEALTHY, eu-west-1, PostgreSQL 17.6.1.166; verified by project metadata before read-only SQL.
- Production project `gfzhdkitdyqftealgqfi` is excluded. No production database inspection/mutation this phase.
- Vercel project **`prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71`**, team **`team_kKRzCLk1pNHoIA4sV1M0ciSg`**; existing Preview **`dpl_DGWZnPj1ubqxzCfzDcZVUJ3iEYTQ`**, https://officebites-70l6nc42z-sp24tg-6983s-projects.vercel.app . No new deployment is included in migration approval.
- Branch `feat/vendor-direct-launch-payments`; baseline HEAD `695e5e19cf581f6202dcc058afad1ee2fba23208`; feature changes remain uncommitted. No blanket staging of existing working-tree changes.
- Executable package: `supabase/staging-release/20261023/`. The exact tool arguments are in `apply-migration-request.json`; the builder is **offline only**: `checks/uat/prepare-installation-package.mjs`.
- Migration name: **`officebites_staging_locked_release_20261023`**. A successful migration service call assigns its actual history version; record the returned version. Do not invent it, copy staging's history to production or mark an error as applied.
- Logical package digest: `bfece8414f6578896aff42fc96ee01e3a3847e8a46bb3d284fc896dd89eb525d`. Full file hashes, not that digest alone, bind the approval.

### Executable files and SHA-256

| File under package directory | SHA-256 |
|---|---|
| `preflight.sql` | `d97568364149392aa02c7fa44cee5e4425011adf67929fde6b4ed6f61bf20103` |
| `install.sql` | `2ae2241eb39afed6d35e5b3a23275adacd7f215e7bce46242d29831791e0aec6` |
| `post-install.sql` | `24e53caae288ba5683202322580c505d55b5e52b4752479792a6e79a2216c1cf` |
| `forward-containment.sql` | `37f6ccc24ede11548b8d3c1c1f1209cd3dd4760044de32707fecc87c68dba805` |
| `repair-cash-index.sql` | `b547aef0566e63b255ba7784cba8fddd1df19aee2e6fb6762bf0eac86f347196` |
| `post-recovery.sql` | `24e53caae288ba5683202322580c505d55b5e52b4752479792a6e79a2216c1cf` |

`manifest.json` records these plus the source hashes. `apply-migration-request.json` contains the exact install SQL and fixed project_id. Offline verification checks source hashes, package hashes, project ID, migration name and request SQL equality. The generated files are outside the portable `supabase/migrations` chain: staging restrictions must never be shipped as production migrations.

## 2. Candidate chain review

All components are installed as **one migration transaction**, in the following internal dependency order. The package replaces only local fixture guards/outer transaction boundaries with staging guards and adds baseline/preservation/ledger checks; it does not remove business authorisation or enable methods.

| Source candidate | SHA-256 | Dependencies; changes; impact; recovery |
|---|---|---|
| `checks/uat/staging-security.sql` | `50dfb18c768421f3299722fa751a812ee8d278a9ee855b6d6562073c37a7a756` | Existing manual payments, active_account helper, immutable trigger helper, Supabase Auth role. Adds private security/actor/redacted email capture tables; wraps active_account while retaining original helper; adds REST gate/email sink and explicit grants. Does not attach either service configuration. Global account restriction can deny existing authenticated staging users. Forward containment/restoration only with accepted notification isolation. |
| `checks/pilot/booking-candidate.sql` | `6625ddacfe65a184cc8d356a284d58cd8559dc52dbf93f9af6fa0c7ba13e4a18` | Existing manual-order/payment/order states. Adds private policy/destinations/windows/bookings, locked defaults, capacity/payment/cancellation triggers and private helpers. No new active window or fee. Preserve old order/financial rows. Forward repair once bookings exist; no deletion of paid reservations. |
| `checks/pilot/atomic-collection-candidate.sql` | `c7f2f5db6e93c3c0d3a782d1deaa5e5b7c9989f57662b6f05029af8e72c03122` | Booking component and corrected manual-payment RPCs. Adds EFT expiry interlock, agreements/financial snapshots, requests/config/refund idempotency and captured outbox; replaces/patches checkout/verification/refund functions, adds approved collection APIs. R0 collection disabled by default, immutable agreement/recipient snapshots, no existing order creation. Forward repair after use. |
| `checks/pilot/assisted-cash-candidate.sql` | `29d37659983715cb9de704ed13a6a875e92c1b1d10f895e3da3ef8adab521db5` | Atomic component. Adds private assisted/service-date/receipt/profile-revision/request journals and helper contexts; alters orders payment/source checks, manual-payment method/profile/confirmation constraints and financial snapshot profile nullability. Patches existing order/eligibility/verification/refund functions. Existing orders gain default `order_source=customer_web`; old field values are compared unchanged. Seeds revision IDs for existing payment profiles (currently zero). Assisted/cash/request gates NULL. Forward repair; cannot remove cash constraints while cash history exists. |
| `checks/pilot/cash-custody-candidate.sql` | `d124d0f1324896d98d607116dfb4416d863ffb7f1b12dc6b3d5745831ffd14c8` | Assisted component. Adds private custody policy/immutable receipt snapshots/handovers/events; actual-custodian refund guard; restricted custody APIs/reporting and protected receipt DTO. Admin cash expiry NULL; partial/bank handovers false. No handover or custody collection is created. Forward repair and append-only financial correction. |

New private tables use RLS and explicit client/service-role revocations; APIs use explicit EXECUTE grants and SECURITY DEFINER authorisation/search paths. Guest collection/payment access remains explicit and requires direct transport testing. The new private release-installation ledger stores the logical digest, function/owner/ACL fingerprints and historical row digest; clients cannot update it.

### Locks and disruption

Installer uses 5-second lock_timeout and 60-second statement_timeout. It takes a transaction advisory lock, then SHARE ROW EXCLUSIVE locks on the historical order/vendor/profile/payment/commission/settings tables being compared. DDL may escalate to ACCESS EXCLUSIVE, notably orders and payment constraints. Writes can pause; callbacks may wait/fail and need normal idempotent reconciliation. This is a staging maintenance operation, not a zero-downtime change. The global account gate can deny existing staging users after commit until approved actors/window exist. Obtain explicit maintenance acceptance before approval. Timeouts are limits, not a measured hosted duration guarantee; the migration service may impose tighter limits.

## 3. Existing data and isolation

Fresh read-only counts: 15 orders, 15 suborders, 15 items, 8 vendors, 4 profiles, 18 manual-payment audit events, 3 financial-sales rows; zero manual payments, receivables, receivable entries and bank profiles. Phase 6 classification remains: 14 orders not flagged test, one flagged test; four Auth users, only one `.invalid` address. Treat unclassified records and all existing journals as non-synthetic/protected. No names, phones, account details, tokens or record bodies are included in this package.

Before/after fingerprints cover existing orders (excluding only the newly added source column), suborders/items, profiles/vendors, manual payments/profiles/events/receivables/entries, provider attempts and standard/acquisition commission ledgers. No original row is intentionally deleted or rewritten. Counts alone are not a backup. Fingerprints catch drift; they cannot restore lost rows.

**Existing staging is not demonstrated to be safe for destructive or concurrency financial UAT. Recommend a fresh disposable Supabase test project for those tests.** Its creation, cost, new target and adapted reviewed package require separate approval; the current package must not be relabelled or executed there casually. Alternatively, using existing staging requires accepted maintenance, verified backup/restore, effective API gate, restricted synthetic actors/recipient profiles/windows and evidence that every write path respects the boundary. A naming prefix or `is_test` flag alone is insufficient. This phase creates no actors or test window.

## 4. Authoritative evidence and gaps

Fresh staging SQL captured exact definitions' MD5, owner and ACL for ten modified prerequisite functions, including active_account, core/delivery/manual creation, DTO, eligibility, verification/refund/cancellation and settings. All captured owners are postgres; the package asserts the exact captured ACL text too. `preflight.sql` checks these fingerprints, the 15/15/15/18 row baseline, absent installation roots, required hosted singleton version `20261021100655` and four gateways/settings/delivery. Any mismatch stops for read-only reconciliation; never update the expected fingerprint merely to bypass failure.

Fresh RLS evidence: `active_account_access` is RESTRICTIVE on 22 public tables, including orders/items/suborders, profiles, vendors, notifications and financial-related tables; `active_account_storage` is RESTRICTIVE on storage.objects. Order SELECT permits related customer/admin/vendor; item/suborder SELECT checks parent relationships; vendor updates check owner/admin in USING and WITH CHECK; profile updates similarly check self/admin. Suborder vendor-note UPDATE checks assigned vendor/admin. These clauses require helper and column/trigger enforcement review, not just RLS enablement.

Storage buckets: payment-proofs and support-attachments private; meal-images, vendor-images and avatars public. Support upload/read/delete checks UID folder/admin; meal image upload/read checks owned vendor path; public vendor-image read remains intentional catalogue access. Public media URLs and Auth/Storage/Realtime transport behaviour are not proved private by database policies. Proof upload stays unavailable until quarantine/malware handling is accepted.

Prior fresh private-table checks deny anon SELECT and authenticated UPDATE on gateway/settings/manual payments/bank profiles. Guest SECURITY DEFINER APIs and authenticated financial RPCs are intentional grants requiring their internal auth/token checks; advisor warnings do not prove exploitability or safety. The pre/post scripts assert selected critical privileges and all new entry locks. They are not exhaustive transport acceptance.

Still inaccessible/unverified:

- Effective PostgREST exposed schemas, db-config, db-pre-request, db-pre-config, precedence/overrides/reload and deployed version. No pgrst catalog override was found in Phase 6, but this is not running service evidence. Operator must obtain supported service config readback or Supabase Support confirmation for the exact project, then prove direct denied/permitted requests after a separate configuration approval.
- Fresh Auth provider/signup/SMTP/hooks and operational channel inventory. Historical operator baseline is Email enabled, Phone disabled, signup enabled, custom SMTP disabled, no hook. A no-hook restore is unsafe suppression. Obtain current Dashboard evidence, install/read back private hook `pg-functions://postgres/private/uat_send_email` only after approval, verify source-matched failure behaviour and non-delivery. Independent cron/queues/webhooks/Edge/SMS/push/email/WhatsApp/operational senders need accepted disablement or local/controlled sink. No real recipient probes.
- Verified backup/restore point, entitlement, retention and recovery rehearsal for hosted staging. Do not interpret absence of evidence as absence of backups.

## 5. Automation and Preview security

Fresh Vercel project metadata still reports password, SSO and trusted-IP protection disabled. Phase 6 privately matched Preview URL/publishable key to staging; refresh scopes/branch overrides immediately before any release. No secret or service-role credential belongs in VITE variables or client assets. Keep operator credentials and the UAT request capability out of Git/builds/traces.

Local `.github/workflows` is absent; remote main `.github` GET returned 404 in Phase 6. Fresh branch-protection GET returned **403 Resource not accessible by integration**. Prior branch listing reports unprotected main. Workflow-list endpoint was rejected by the connector. Vercel's available project projection omits Git production-branch/deploy-hook settings. Therefore a release-branch push is **not cleared as safe**: Git integration or external automation could deploy/apply migrations. Repository/Vercel admin must inspect rulesets, workflows, production branch, Git app permissions, deploy hooks, custom environments and Supabase deployment integrations. Do not push until that evidence is accepted.

Recommend Vercel Authentication scoped **Only Preview Deployments**, if the account supports it, with authorised tester access and no production custom-domain change. Availability/scope must be confirmed in the Dashboard before settings approval. If unavailable, require a separately reviewed authenticated access restriction plus backend capability/actor gate; UI-only protection is insufficient. Do not generate/revoke share links or use the prohibited authenticated fetch helper.

## 6. Executable installation instructions — after approval only

1. Verify project metadata for `eyhmarmekioovcjibcbr`, confirm accepted maintenance and all external prerequisites below. Check a timestamped restore point ID, retention, encrypted restore access and evidence of a controlled restore rehearsal. Capture schema/ACL/function and data fingerprints independently; keep backup data outside Git. Existing history must remain available.
2. Run the **offline** verifier: `node checks/uat/prepare-installation-package.mjs --verify`. This contacts no service. Do not rerun the builder after approval without re-reviewing new hashes. Read `manifest.json` and compare the six file hashes above.
3. Read-only preflight through the already verified staging connection: execute all of `preflight.sql` as one operation. The file has assertions but no DDL/DML. Also verify roles (`supabase_auth_admin`, anon/authenticated/service_role), absent candidate roots and migration history. Any changed baseline stops the installation; do not mark a migration applied.
4. Use the exact arguments in `apply-migration-request.json` with the Supabase **apply_migration** tool, only for project_id `eyhmarmekioovcjibcbr`, name `officebites_staging_locked_release_20261023`. `query` is the exact `install.sql`. The adapter labels the tool `supabase.apply_migration`; resolve it to the connected Supabase tool, not a shell command. Execute as ONE migration transaction; do not split statements or paste parts into separate Dashboard runs. If the available service cannot guarantee that transaction boundary, stop. Do not use blanket db push.
5. Record returned migration history version and name, transaction result and the new private installation ledger. If the response is lost or uncertain, stop and read history/ledger/functions/locks. The package's same-digest retry path validates function/ACL state and closed locks before returning. It does not authorise automatic mutation retries or duplicate history entries; reconcile the migration service ledger first. A duplicate/missing/partial ledger or drift rejects execution. Never insert history rows manually to hide errors.
6. Execute `post-install.sql` through the verified target, then capture current RLS/grants/function fingerprints, preserved-row fingerprints and unchanged settings. All method flags false, 15/R500, R15 inactive, R0 collection disabled, all EFT/vendor/admin/request expiry controls NULL. New profiles, orders, receipts, actors, handovers and outbound messages must remain zero-delta. Stop on any discrepancy.
7. SQL installation does NOT configure PostgREST or Auth, open actors/window, activate methods or deploy Preview. Attaching the gate/email hook requires its own exact, separately approved service configuration operation and runtime verification. Provisioning/UAT cannot follow by implication.

The request fixes the control-plane project ID. The SQL project setting is a secondary guard, not independently authenticated server identity. Never execute the SQL against an arbitrary connection and treat its own set_config value as proof of target.

## 7. Recovery and repeatability

- Before commit: one migration transaction must roll back all DDL/DML on failure. Read-only reconciliation precedes any retry.
- After commit: preserve new schema and all journals. Same-package re-execution is guarded by digest/function/ACL fingerprints and closed locks; different or partial packages stop. Capture actual history version and do not apply the same semantic migration under a new name.
- `forward-containment.sql`: requires verified staging setting and known installation; clears feature entry expiry controls and the UAT capability/expiry while retaining actor journals, keeps admin custody/partial/bank controls closed and asserts existing four methods remain off. It does not silently overwrite gateway/audit history. If a gateway is enabled, stop and obtain a separate normal authenticated admin restoration approval.
- `repair-cash-index.sql`: narrow separately approved repair for a missing cash_order_events lookup index; verifies known package digest, creates the index idempotently and verifies its target/key/validity, then all locks/security assertions. A different existing index requires review. No automatic table/function restoration is claimed.
- Recovery SQL files must run inside one verified staging transaction with `officebites.verified_project_ref` set by the verified operator; then run `post-recovery.sql`. Exact target/operation requires separate incident approval. They are not approved by migration installation alone.
- Never delete orders/receipts/commission, remove cash values from constraints, detach a working mail sink, restore the defective singleton RPC or restore no-hook Auth delivery to make a rollback look complete. Never downgrade an order to unpaid because funds have not been handed over.
- Restoring from provider backup requires isolated access/notification quarantine and explicit destructive-restore approval. Restore to an approved disposable target first where feasible. No hosted backup was created or restore rehearsed this phase.

## 8. Local execution evidence

`checks/uat/installation-package.test.mjs` is opt-in via `OFFICEBITES_INSTALL_PACKAGE=1`. It first rejects the actual installer against a mismatched local baseline, then substitutes only the staging-baseline assertion for a synthetic fixture. All generated DDL, locks, historical fingerprints, grants, repeat guard, containment and repair statements execute. It installs/repeats, verifies one ledger row, contains, repairs a dropped index twice, rolls back and verifies the original active-account definition and absent installation ledger. It creates the missing local Auth role only inside the disposable test transaction. No hosted baseline was asserted by a local test.

Commands use the existing pinned Node runtime and guarded loopback PostgreSQL:

```
node checks/uat/prepare-installation-package.mjs
node checks/uat/prepare-installation-package.mjs --verify
# Native: OFFICEBITES_LOCAL_NATIVE=1; OFFICEBITES_INSTALL_PACKAGE=1
node checks/pilot/native-bootstrap.mjs --reset
node checks/checkout-database.mjs
# PGlite: unset OFFICEBITES_LOCAL_NATIVE; keep OFFICEBITES_INSTALL_PACKAGE=1
node checks/checkout-database.mjs
node node_modules/oxlint/bin/oxlint checks/uat/prepare-installation-package.mjs checks/uat/installation-package.test.mjs
```

Final results are recorded below after completion. Logs: `.officebites-local/phase7-native-approved-bytes.log` and `phase7-pglite-approved-bytes.log`. Earlier rehearsal exposed an absent local supabase_auth_admin role; the fixture was corrected, with no hosted or application permission change. No UI/build source changed; prior 74 browser and production build results remain historical, not new package runtime evidence.

Final hashed package results: **787 native PostgreSQL assertions passed; 738 PGlite assertions passed**, including 10 package-specific assertions in each run. Both returned exit 0. Focused lint returned exit 0; offline hash/source/target/request verification passed. The staging-baseline section is deliberately substituted in the positive local rehearsal; the actual unmodified installer was also tested to reject a mismatched baseline. These results do not establish effective hosted Auth/REST behaviour or a hosted backup restore.

Local file inventory for this phase: new offline builder/test modules; generated six SQL files, manifest and exact apply request under `supabase/staging-release/20261023`; opt-in package-test call in `checks/checkout-database.mjs`; this report. Existing feature candidates, UI and unrelated uncommitted work were preserved. No new portable production migration was added.

## 9. Synthetic UAT boundary and separate approvals

Future UAT uses the existing four-identity `.invalid` manifest, never existing real users/records. Synthetic admin is not provisioned with public-signup admin metadata. Dedicated vendor/menu/agreement/future R0 pickup window, independent synthetic EFT profile approval, stable request/receipt IDs and strict session/guest access must be captured. All gates remain disabled through installation. No bank transfer or physical cash is exchanged; verification events are explicitly synthetic. No new Edge Function is needed for SQL-based EFT/cash; preserve historical provider callbacks.

Security acceptance before UAT must prove direct REST/RPC denied without capability/allowlist, correct caller/customer/vendor boundaries, CORS for the exact Preview and required test header, safe Auth/Storage/Realtime/Edge paths and accepted notification capture. Keep capability outside browser builds and inject only in an authorised operator/test session to the exact API host. Test expiry/revocation and no token/PII leakage. Backend controls, not the Preview URL, establish isolation.

Separately approved synthetic enablement may open only the bounded vendor/window and methods needed for that test after isolation is demonstrated; never open admin custody or use a global gate without effective caller/recipient restrictions. Customer EFT stays pending until synthetic authorised verification; vendor cash must atomically persist full receipt/order/capacity; admin cash always denies. Test refs, snapshots, last-slot contention, receipts/cancellation/refund races, outbox rollback/replay, vendor/admin reporting and data privacy with independent persisted-state assertions. Stop for unexpected existing-record changes, delivery, funds or access. Close gates first at completion, confirm four methods off/15/R500/R15 unchanged, preserve synthetic financial/audit history and revoke only approved test access.

| Approval | Exact scope / current recommendation |
|---|---|
| Migration installation | One exact hash-bound package above, existing staging only, locked defaults, maintenance and backup required. **NO-GO until evidence accepted.** |
| Auth/REST configuration and Preview protection | Separate settings/URIs/scope/readback and non-delivery/deny tests; not included in SQL approval. **NO-GO pending authoritative values.** |
| Preview deployment | Exact reviewed commit/artifact to the verified Vercel project/team, Preview only, staging env; no domains/share links. **Not authorised; source/automation review needed.** |
| Provisioning / synthetic UAT | Named fixture IDs, disposable/partitioned target, TTL/capability, explicit mutations and closeout assertions. **Not authorised; prefer disposable project.** |
| EFT activation | Separate recipient/security/UAT/operational acceptance. **Disabled / NO-GO.** |
| Vendor cash activation | Separate recipient, atomic/race/refund/UAT sign-off. **Disabled / NO-GO.** |
| Admin custody | Additional gross/net settlement, custodian, security, deadlines, acknowledgement/refund/tax/finance/legal decisions. **Independently disabled.** |
| Production promotion | New production-specific migration baseline/artifact/env and release approval; no staging users/payments/security gates copied. **Excluded / NO-GO.** |

### Exact conditional approval wording for the operator

“Approve only `officebites_staging_locked_release_20261023` in `eyhmarmekioovcjibcbr`, using install.sql SHA-256 `2ae2241eb39afed6d35e5b3a23275adacd7f215e7bce46242d29831791e0aec6` and the verified request/manifest. First require a verified restore point, accepted maintenance impact, unchanged preflight, and authoritative security/notification acceptance. If any prerequisite is missing, STOP without installation. Install as one transaction, record actual history version and verify preserved records and closed locks. No settings, deployment, provisioning, payment enablement, UAT, provider-secret or production operations are included.”

**Recommendation: do not approve execution yet.** Remaining owners/actions are specific: operator supplies backup/restore and maintenance acceptance; Supabase/operator supplies effective service and notification evidence; GitHub/Vercel admin supplies automation/protection evidence; security reviewer accepts the global-gate impact or selects a disposable test project. This is an informed conditional approval/NO-GO decision against executable bytes, not approval of unspecified future migrations.
