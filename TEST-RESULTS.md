# Checkout test results — 16 October 2026

## Continuation results

- Full local regression runner passed, including preservation checks, recovery/service/auth tests, 73 ledger checks, 38 checkout checks, timezone suites and initial new integration tests. Expanded new suites then passed 43 isolated Ozow/subscription/database-role assertions and 33 mocked handler/HTTP assertions. No provider credentials or hosted payments are used.
- New tests cover persistence-before-POST, repeat initiation refusal, ambiguous timeout/bind failure, admin reconciliation, wrong amount/site/currency/reference/transaction identity, raw-body tampering, missing signature, durable duplicate credit/notification guards, Pending before Successful, cross-provider retry refusal, unknown-fee reporting, forged subscription receipt refusal, admin-before-payment refusal, paid_pending_approval and suspension blocking eligibility. Deno checks pass for all three new endpoints and existing removal/PayFast endpoints.
- Native staging: existing 12 checks plus 16 new checks passed under explicit ROLLBACK using synthetic records. No external provider call. Postchecks found zero remaining QA Auth rows, zero enabled/saleable plans, all new tables protected by RLS and restricted grants, Ozow/delivery/retention disabled. Applied only the new reviewed staging migration; source 20261016083644 maps to history 20261016084712.
- Browser suite: all 22 passed in disposable Edge profiles (21 synthetic-service tests and one unmocked signed-out staging read check; hosted writes blocked). This verifies the existing fixture stories and compilation of conditional Ozow UI, not a real provider redirect or signed-in staging payment.
- Focused browser rerun: three passed, covering disabled gateway, Ozow duplicate-action/ambiguous-initiation handling, and a real CSV download showing unknown fees as Unresolved in both the row and total. Two are new tests, giving 24 distinct browser stories verified across the two runs. The first focused run was interrupted to correct its missing synthetic customer identity; no product regression or provider call was involved.
- Full lint: zero errors, nine existing warnings. Production/PWA build in staging mode passed, 116 precache entries. No default live-mode build/deployment. Whitespace checks and final targeted lint recorded after report edits.
- Staging Edge endpoints v1 deployed disabled: empty initiate and webhook probes return 503 staging configuration required; reconcile without JWT returns 401. These probes cannot initiate payments. No merchant secrets configured or provider webhook registered.
- Feature push at 742ba109d433ab0c0035e4ce92805ad8c35698f2 produced READY Vercel preview https://officebites-73898hklk-sp24tg-6983s-projects.vercel.app, target null. Owner confirmed production branch main. No production deployment was triggered by that feature push.

New failure found and corrected before staging application: the isolated older schema's orders_payment_method_check allowed only manual_eft/PayFast. New migration preserves those methods and adds Ozow. First expanded database tests then passed; no failed migration was rerun against staging. A source-file collection command yielded before completion; it was polled/re-collected before any Edge deployment.

Still untested: actual Ozow merchant onboarding/token/hosted flow, provider-delivered signatures/replays, native concurrent sessions, settlement fees/refunds, end-to-end subscription collection/renewal/refund and benefits, hosted test-account authentication/chat, real device GPS/PWA upgrade. Official Eduvos campus address is verified; exact coordinates remain owner-supplied rather than independently surveyed. Administrator policy configuration and operational boundary tests remain pending; synthetic 1/2 km/R15 fixtures are not commercial settings. No production changes, real payments, customer messages, account deletions or order classification were performed.

## Earlier baseline results

## Passed

- Lockfile install: npm ci, 442 packages. Application package.json/package-lock.json unchanged.
- Untouched archived origin/main lint/build: passed, nine existing lint warnings, PWA 113 entries. Dependencies reused from the identical locked root installation; no local-main reset or checkout overwrite.
- Baseline/recovery suite: preservation boundary; 33 SDK/storage/coordinate assertions; 73 PGlite accounting/role checks; seven support mocks; both auth races; 36 order/date assertions, 24 catalogue/date assertions and 212 frontend/service/handler assertions across Africa/Johannesburg, UTC, America/Los_Angeles and Asia/Tokyo. The scope assertion now permits this feature's explicitly authorized backend/initiation/UI changes while still comparing preserved notify/signature/commission/account-removal/PWA/style invariants against 4c4835d.
- New checkout-rules: 44 mobile, distance/accuracy, subscription eligibility, Ozow mocked HTTP/signature assertions. These do not certify an actual subscription lifecycle or payment provider.
- New PGlite checkout database: 38 assertions, including both migration dry-runs, ownership/proof/cancel idempotence, issued/paid/legacy refusal, gateway maintenance/role guards, confirmation after disablement, commission/decimal fee preservation, quote replay, radius boundaries, missing/inaccurate GPS, invalid vendor coordinates, server totals and delivery reconciliation. Includes unchanged legacy booking contact and foreign/+27 modes. PGlite is not native parallel-session testing.
- Native staging: 12 assertions, explicit rollback, synthetic Auth/database fixtures only. See checks/checkout-staging.sql; no real provider API/payment was called. Registration coverage is the actual Auth DB trigger, not GoTrue/email.
- Staging Data API: gateway/settings RPCs 200; unproved cancellation and anonymous admin configuration 401. New private-table RLS/ACLs and disabled Ozow/delivery/retention verified.
- Browser: 22 Playwright tests passed in isolated headless Microsoft Edge. Twenty-one use synthetic services with hosted requests blocked; one renders public signed-out staging pages with hosted writes blocked. Includes navigation versus cancellation, double-click guard, processing errors, mobile formatting, disabled gateway, browser-simulated GPS/quote invalidation, account/route races, guest storage failures, CSV downloads and browser clocks. No personal browser profile or real account login was used.
- Feature lint: zero errors, nine existing warnings. Staging-mode production/PWA build passed (116 entries). Built JavaScript contains the staging project reference and no live project reference. Deno checks pass for removal, PayFast initiate/notify and Ozow helper using --node-modules-dir=none --no-lock.

## Failures encountered and corrected

- Initial lint/build overlapped dependency installation and could not find binaries. Retried after npm ci; passed. Untouched-main archive also passes.
- Deno local node_modules resolution could not resolve newer JSR transitive dependencies. Isolated global npm resolution passes without changing app dependencies or committing generated deno.lock.
- Playwright Chromium was not installed. Used existing Edge in a disposable profile. Orphaned test preview port was stopped before retry.
- Existing checkout fixtures used “fixture-contact”; new validation correctly rejected them. Updated only new-checkout fixtures to synthetic valid numbers, preserving legacy tracking proof tests.
- Native staging fixture had a JSON/text concatenation precedence typo. Corrected the fixture; 12 native checks pass and roll back.
- SQL international-mode regex escaping failed a newly added foreign-contact test. Fixed with a separate booking validation migration; local/+27/foreign checks now pass in staging.

## Not verified

Native concurrent sessions/cancellation-versus-ITN; hosted SDK login/registration/email; provider checkout, signed webhook delivery, replay/amount/site reconciliation and real payment; actual iOS/Android keyboards/GPS; installed-PWA upgrade/offline; complete paid subscription billing/approval/activation/refunds. No test results above should be read as production or merchant approval.

Final whitespace/staged-content checks and final reruns are recorded in the completion chat. Local artifacts/logs, temporary baseline archive, public-only staging environment and any private pre-existing fixture remain ignored/uncommitted.
