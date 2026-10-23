# Phase 4 local validation

Follow-up: [Phase 5 runtime and validation](phase5-local-runtime-20261023.md).

Follow-up to `eft-cash-validation-20261023.md`. Local only. No hosted writes, commits, deployment or activation. R0 collection and inactive R15 delivery preserved.

## Runtime blocker

`Get-Command docker,supabase,postgrest -ErrorAction SilentlyContinue` found none on PATH. Native PostgreSQL is available. Full authenticated frontend-to-PostgREST testing remains BLOCKED on a local API/Auth runtime. The browser harness mocks service/RPC responses; no pass from it establishes persisted browser-to-database behaviour.

Required environment action: provide local Supabase/Docker or an isolated PostgREST/Auth stack bound to loopback, load reviewed fixtures, deny outbound notifications and use synthetic vendor/admin sessions. Query persisted state independently. No hosted endpoint or credentials may substitute for this runtime.

## Added coverage

`checks/pilot/phase4-security-recovery.mjs` exercises direct financial modification denial for admin and two vendor identities, forbidden handover initiation/fabricated acknowledgement, cross-vendor report denial, unchanged financial snapshots, custody RLS, anonymous RPC denial and fixed SECURITY DEFINER search paths.

Committed recovery revokes one reporting RPC privilege after financial history commits, interrupts a repair, confirms denial persists, then restores exact definition/owner/ACL and compares order/receipt/commission/handover snapshots. Entry gates stay closed. Timings are printed. This proves a specific forward permission repair, not full schema rollback. Financial history and cash constraints must not be dropped.

Native additions cover overlapping refunds, cancellation waiting behind a refund, and injected ledger failure aborting checkout. An initial cancellation fixture omitted guest proof; it was corrected. Existing capacity, replay, payload, expiry and payment race assertions remain.

Still unproven: suspension versus cash creation, every receipt/cancellation/commission ordering, stateful self-approval/replay/concurrent handover cases, committed schema repair, integrated assisted forms and full accessibility audit. Absent-ID denial is not evidence for valid pending handovers.

## Commands and logs

Use the pinned Node runtime. Native: `node checks/pilot/native-bootstrap.mjs --reset`, then with `OFFICEBITES_LOCAL_NATIVE=1`, `node checks/checkout-database.mjs`. The reset is restricted to the checked disposable loopback database. Unset that variable for `node checks/verify-local.mjs` (service and PGlite regression runner). Browser: `PLAYWRIGHT_CHANNEL=msedge`, `PLAYWRIGHT_DISABLE_GPU=1`, `node checks/verify-browser.mjs`. Lint: `node node_modules/oxlint/bin/oxlint`. Build: `node node_modules/vite/bin/vite.js build --configLoader native`.

Logs under `.officebites-local`: `phase4-native-final.log`, `phase4-services-pglite.log`, `phase4-browser.log`, `phase4-lint.log`, `phase4-build.log`. Only completed runs count as passed.

## Actual results

- Native: 762 assertions passed, including 86 assisted-payment and 48 Phase 4 security/recovery assertions. The committed permission repair took 59 ms. PostgreSQL was stopped after testing.
- Full local runner: passed, including 714 checkout PGlite assertions (64 assisted and 48 Phase 4), the separate 73 baseline migration/accounting checks, service/auth/recovery/provider/CORS checks, and date/frontend checks across four timezones. Its committed permission repair took 71 ms. See complete output rather than combining unrelated suite counts.
- Full browser run: 74 executed, 73 passed, one failed in harness `route.fetch` with local ECONNRESET. No test was skipped. This includes mobile/keyboard regressions and an existing read-only hosted-data smoke test, which does not prove hosted UAT readiness. A targeted rerun is recorded separately; it does not erase the initial failure.
- Lint completed with existing hook/Fast Refresh warnings. No application source changed in this follow-up.
- Production build and PWA files generated (129 precache entries); plugin-timing and terminal colour warnings occurred. Explicit final exit-code verification is recorded separately.

Changed files this phase: `checks/pilot/assisted-cash-database.mjs`, new `checks/pilot/phase4-security-recovery.mjs`, this report and the link in `docs/eft-cash-validation-20261023.md`. No SQL migration candidate or applied migration changed.

Final targeted browser rerun: contextual support test passed, `PLAYWRIGHT_EXIT=0` (`phase4-browser-retest.log`). Final explicit production/PWA rebuild: `VITE_EXIT=0`, 129 precache entries, plugin-timing warning only. The initial full-suite failure remains recorded as a non-reproduced local transport failure. No mutation retry was introduced.

## API and notification evidence

Existing SQL suites exercise private Auth capture permissions, hashed recipients, omitted token/raw email/redirect data, signup/invitation/magic-link/email-change/reauthentication capture, failure with missing security configuration, transactional outbox rollback and duplicate creation. They do not prove Auth transport retry/fallback or external non-delivery.

Hosted configuration remains BLOCKED. Operator must obtain effective PostgREST version, schema exposure, `db-config`, `db-pre-request`, `db-pre-config`, provenance/overrides and reload behaviour through read-only service configuration access. Ask Supabase Support for unavailable values for `eyhmarmekioovcjibcbr`; SQL catalogs and HTTP 200 cannot prove them. Obtain pre-config definitions/owner/ACL without executing unknown code. After separate installation approval, test direct denied and permitted REST/RPC requests.

Notification evidence must cover saved hook URI/enablement/failure handling plus cron/queues/pg_net/webhooks, deployed Edge Functions, MFA/SMS, email/WhatsApp/push and operational integrations. Record secret names only. Every independent channel needs disabled delivery or an isolated sink with restricted redacted capture. No-hook plus enabled Email Auth is not safe suppression recovery. Existing prerequisite checklist remains authoritative.

## Separate activation checklists

EFT: latest independently approved bank profile; immutable recipient/amount/reference/commission snapshots; independent bank verification; partial/overpaid/unmatched reconciliation; recipient refunds/cancellation; guest access; accepted API/notification evidence; reviewed migration and recovery; supervised synthetic UAT; explicit technical and operational approval.

Vendor cash: authorised actual recipient; full prepaid atomic receipt/order/capacity; all remaining race and integrated-form coverage; cash-return/exception procedure on failed creation; approved refunds; accepted security evidence; supervised UAT and explicit vendor-cash approval. Gate remains disabled.

Admin cash: separately locked pending named custodians, physical security, gross/net settlement, handover deadline, independent acknowledgement, discrepancies, refund responsibility, tax/invoice/commission treatment and finance/legal approval. No policy is inferred from fixtures.

Local completion: NO-GO until remaining execution gaps close. Supervised staging UAT: NO-GO pending authoritative security/notification evidence, reviewed recovery and separate approval. Production: NO-GO pending successful staging UAT and operational approval.
