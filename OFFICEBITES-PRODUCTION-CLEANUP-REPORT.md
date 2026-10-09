# OfficeBites production cleanup — verified 9 October 2026

Local implementation and verification report. The user authorized a local commit after verification and removal of identified misplaced session artifacts. No deployment, hosted record/settings mutation, classification, fee-policy selection, payout reservation, purge, push or merge was performed. The 9 October verification used hosted metadata reads only, with no live SQL. Earlier 8 October evidence included read-only database inspection.

## Baseline

- Workspace: `C:\Users\ADMIN\Documents\officebites-cleanup`.
- Branch: `fix/production-audit-cleanup`; initially clean.
- HEAD: `f5db4af98ec502bb98e6eb39fbae237befb7b8c9`.
- Origin: `https://github.com/Siphamandla1998/officebites.git`; fetched before edits. No newer application changes found. Against launch `5c44f0868cc5f33b358d10cb3185831118b274bd`, only the release report and two portable checks differ.
- Vercel read-only inspection: production alias `officebites.co.za` points to READY deployment `dpl_DB32keBz63MmD3ynemYp36i56jqX`, launch SHA `5c44f0868cc5f33b358d10cb3185831118b274bd`, source `redeploy`.
- Supabase target confirmed as `gfzhdkitdyqftealgqfi`. Live proof/removal definitions and indexes inspected read-only. Existing launch migration source files were not modified.
- No applicable AGENTS.md was found in the repository or inspected parent paths.
- Local `.env.local` uses the connected project's actual public URL/publishable key and is ignored by Git. It contains no service-role secret. Browser fixtures use synthetic services; hosted sessions were not invented.

## Audit dispositions

| Finding | Local implementation |
| --- | --- |
| OB-A01 | Explicit non-null guard for account-scoped notification failure. Provider effect cleanup invalidates pending loads. Full-tree browser coverage is separate from old hook stubs. |
| OB-A02 | Both selected ticket and functional setter explicitly guard nullable state before dereferencing. Signed-out tickets render SignInRequired. |
| OB-A03 | Only the SDK's normal `AuthSessionMissingError` permits guest feedback. Expired-token and transport failures propagate; support tickets remain authenticated. Feedback still uses INSERT without SELECT. Tested with installed SDK behavior. |
| OB-A04 | Optional guest persistence cannot throw into checkout/tracking success. Verified access remains in module memory for this tab. Failed persistence shows the newly created code and recovery instructions before payment. Synchronous create lock plus recorded created order prevent a second create call from recovery. |
| OB-A05 | Shared finite coordinate-pair/range parser rejects null, blank, undefined, booleans and invalid values, accepts intentional numeric zero. Settings and vendor/catalogue services use it; no vendor coordinates were changed. |
| OB-A06 | Payment/tracking reads include account dependencies. Manual continuations are invalidated by route/account changes and unmounts; old payment responses cannot redirect. Browser pageshow rechecks the existing order. Raw useAsync setter is scope-guarded. |
| OB-A07 | Payment handler checks authenticated profile state before preparation. New service-only preparation RPC repeats authority and customer/vendor availability checks transactionally. Guest authority remains the verified contact flow. |
| OB-A08 | Unsupported legacy manual proof RPC is replaced with rejection and execution revoked. No frontend/Edge dependency on it was found. Isolated reproduction found that the existing transition trigger also rejects pending_payment → payment_submitted, despite the RPC's deficient ownership predicate. No successful live exploit was attempted or claimed. |
| OB-A09 | Preview lists conservative fulfilment/settlement blockers. Preparation locks dependency tables and checks again before tombstoning. Inserts queued after removal recheck active owners/vendors. Verified late ITNs are retained and an audit entry flags unavailable accounts/vendors; recent receipt UI surfaces review-needed status. |
| OB-A10 | A shared financial revision invalidates report and payout datasets after successful policy/reservation/reconciliation/classification/snapshot mutations. In-flight report deduplication includes that revision. CSV handlers reject loading/error/obsolete datasets. |
| OB-A11 | Requested catalogue/history/help/admin-chat views show real failure/retry states. Vendor menu/reviews/eligibility failures remain distinct from missing data. Guest history exposes failed individual lookups together with successful partial results. |
| OB-A12 | Catalogue screens and Checkout use the shared delivery-date hook; request dependencies include the date. Checkout submits the displayed date and rechecks its cutoff. Existing SAST backend cutoff contract is preserved. |
| OB-A13 | Vendor Orders and Overview poll with focus/pageshow/visibility refresh, cleanup and deduplication. Reads are account/vendor-scoped. Selected order detail derives from refreshed rows; unpaid progression remains disabled. No Realtime publication change is required. |
| OB-A14 | Admin recent payments now uses an admin-authorized aggregate of actual COMPLETE ITN receipts: receipt ID, PayFast payment ID, recorded timestamp, order and amount. Test orders excluded; legacy sales without receipts stay in financial reports. No customer name or noon timestamp is invented. |
| OB-A15 | Admin-only favourites aggregate returns profile ID and count, including zero; no meal IDs are exposed. AdminCustomers uses the count. |
| OB-A16 | Ticket messaging distinguishes unpaid, verifying, confirmed/in-progress, completed and cancelled. Vendor payment badge distinguishes unpaid/verifying/paid. |
| OB-A17 | Business clock and timestamp formatting explicitly uses Africa/Johannesburg. Date-only strings retain calendar semantics. Admin support timestamps follow SAST. |
| OB-A18 | Admin conversation selection includes order/source/closure/retention metadata. Viewer includes an authorized order link and lifecycle/source details; participant access and deletion authorization are retained. |

## Additional findings and safeguards

- Browser interaction uncovered labels without input associations in the shared TextField component. Generated stable IDs now connect each label to its input while preserving caller-provided IDs. Guest tracking and checkout browser tests exercise the real association.

- A refresh failure after changing account could expose previously retained data if its scope were relabelled. `useAsync` now tracks the generation of retained data separately.
- The legacy proof entry point's ownership problem is real in its body, but the current status guard blocks the attempted transition in isolated fixtures. Restricting the obsolete entry point avoids depending on that incidental guard.
- Existing failed requests now remain visible instead of being described as empty data. Missing guest records and failed lookups are distinguished; no stored credential is included in a URL.
- `COMMISSION_RATE=0.17`, explicit vendor overrides including zero, unresolved historical snapshots, unset fee policy and disabled retention remain unchanged.
- PayFast signing, encoding, IP/source checks, validation and authoritative ITN confirmation are retained. No merchant-approval diagnosis or attribution of PayFast's Font Awesome 403 was made.

## Dependency review

Initial `npm audit`: 17 findings (4 moderate, 13 high). Final `npm audit --json`: 7 findings (2 moderate, 5 high; exit 1). `npm audit --omit=dev --json`: zero vulnerabilities (exit 0). No force fix, override or disabled check was used.

Compatible lockfile updates include Axios 1.20.0, React Router/DOM 7.18.4, PostCSS 8.5.29, brace-expansion 5.0.12/2.1.7, fast-uri 3.1.8 and nanoid 3.3.20, plus browser-target metadata and source-map-js updates. The new dev dependencies are pinned to @playwright/test 1.64.0 and @electric-sql/pglite 0.5.8.

Remaining findings are dev-only Tailwind 3.4.13 paths, verified using `npm explain braces postcss-selector-parser`:

- GHSA-vfj7-8cjw-p6xm: braces 3.0.3 nested-pattern stack exhaustion; high findings cascade through chokidar 3.6.0, micromatch 4.0.8, fast-glob 3.3.3 and Tailwind.
- GHSA-rj75-hqrm-r3gf: postcss-selector-parser 6.1.4 quadratic CPU behavior; moderate findings include postcss-nested 6.2.0.

npm proposes Tailwind 4.3.3 as a major-version remediation. This remains an explicit build-tool security/release decision; zero production dependency findings does not clear the development-tool findings.

Remaining paths and final versions/results are recorded in the final verification appendix. Tailwind v4 is a major migration, not a drop-in patch: its official guide changes PostCSS integration, utilities/preflight and browser requirements (Safari 16.4+, Chrome 111+, Firefox 128+). A major styling migration without a supported-device decision risks the required PWA compatibility; remaining build-tool exposure must be explicitly reviewed rather than hidden.

New dev-only regression dependencies: Playwright and PGlite. They allow real browser rendering/download tests and isolated PostgreSQL fixtures; no production records are used for writes.

## Reviewed data-correction checklist

1. Read current vendor coordinate counts again immediately before correction; audit counts are historical, not assumed current.
2. Contact each affected vendor through the established business process to confirm its actual fulfilment location. No messages were sent by this task.
3. Vendor captures location while physically at the business, verifies address and delivery radius, then saves. Settings require a complete finite pair.
4. Review 0,0 separately: it is numerically valid but requires business confirmation. Never replace it with guessed South African coordinates or silently reject all numeric zero.
5. Obtain a reviewed, explicit vendor-to-coordinate correction list before any hosted update. Check nearby discovery at representative distances afterwards.

## Remaining business decisions and limits

- Fee policy, evidence-supported historical commission rates, exact test-order classification and retention activation remain undecided.
- Decide how to resolve abandoned unpaid orders, cancelled paid orders/refunds, unresolved receipts and vendor settlements before removal. Cleanup never automatically cancels, refunds or settles them.
- Late verified receipts are auditable review exceptions. An administrator must reconcile fulfilment/refund handling using external evidence; this task adds no automatic refund action.
- Guest memory fallback survives client-side navigation only. Refresh, tab close, another tab or another device requires order code plus original contact. No credentials are put in query strings.
- There is no server idempotency key for checkout creation. The synchronous lock prevents overlapping creation in one mounted checkout and known-success recovery never creates again. Cross-tab submissions and an ambiguous network failure after a server commit can still duplicate orders. Do not automatically retry creation after an ambiguous failure; verify existing orders/contact support.
- Table locks make removal conservative and can contend with payment/fulfilment writes. Validate lock contention and deadlock/retry behavior on a real isolated PostgreSQL/Supabase stack before enabling removal in a release; PGlite is not multi-session production concurrency evidence.
- Leaked-password protection remains disabled according to the live security advisor. The supported action is to enable compromised-password checks in Supabase Auth password settings on a plan that supports the feature; plan eligibility must be confirmed. No hosted setting changed.

## Currently deployed backend compatibility

On 9 October, read-only Supabase metadata showed `payfast-initiate` ACTIVE version 10, still using its older order update and lacking `prepare_payfast_order`/the new activity guard. Installed migration history ends with `20261008134310 launch_financial_ledger` and `20261008134402 launch_account_security_retention`; the corrective migration is absent. Local source must not be described as deployed.

| Feature | Existing backend compatibility / prerequisite |
| --- | --- |
| Notification/ticket null guards, storage recovery, coordinates, request scope, retry states, delivery dates, polling, SAST display, chat metadata | Existing service contracts; no new backend deployment required for these frontend fixes. |
| Actual recent receipts (AdminPayments/Overview), admin favourite counts | New migration RPCs required before frontend release; existing backend cannot serve them. |
| Payment activity/authority guard and authoritative preparation snapshot | New migration, then updated payfast-initiate Edge Function. |
| Removal blockers/recheck, active fulfilment inserts, late verified ITN audit, legacy proof revocation, indexes/RLS tuning | New corrective migration; removal also needs isolated multi-session contention verification. |

## Deployment order (not performed)

1. Review the new corrective migration and exercise it on an isolated Supabase/Postgres environment, including concurrent payment/removal, privileges and installed migration history. Take the release team's required backup/recovery precautions.
2. Apply only `20261008185732_production_audit_cleanup.sql` via the project's reviewed migration workflow. Installed launch files have different live history versions and must not be replayed.
3. Deploy the updated `payfast-initiate` Edge Function after `prepare_payfast_order` exists. Existing initiate calls still function between migration and function deployment, but the new activity guard requires the function update.
4. Deploy frontend. New receipt/favourite screens require the new RPCs; missing backend contracts intentionally show errors. Removal blocker display requires the new preview contract. Other frontend fixes are compatible with the existing backend.
5. Verify authorized customer/vendor/admin sessions, two-account chat/notifications, PayFast sandbox return/cancel/verified ITN, receipt review, CSV downloads and installed-PWA upgrade behavior before release sign-off.

The local source is not the deployed backend. Passing build/lint or isolated tests does not establish production readiness.

## Sources

- [Supabase RLS performance](https://supabase.com/docs/guides/database/postgres/row-level-security): scalar subselects for stable Auth/account predicates, preserving restrictive ownership policies.
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security): compromised-password protection and availability.
- [Tailwind upgrade guide](https://tailwindcss.com/docs/upgrade-guide): v4 migration and supported browser changes.

## Final verification appendix

### Local results

- `node checks/verify-local.mjs`: passed sequentially. Runtime 41 assertions; isolated PGlite database 73 baseline plus 38 corrective checks; support-service 7 checks; Auth sign-out/account-switch races passed. In each of Africa/Johannesburg, UTC, America/Los_Angeles and Asia/Tokyo: order-rules 9, catalogue filters 6 and launch frontend 52 checks passed. The VM frontend checks are not browser evidence.
- `npx.cmd --yes deno check --node-modules-dir=none --no-lock supabase/functions/payfast-initiate/index.ts supabase/functions/admin-account-removal/index.ts`: passed.
- `node node_modules/oxlint/bin/oxlint`: passed with zero errors and 9 warnings (7 Fast Refresh exports, dynamic hook dependencies and existing Auth cleanup-ref warning).
- `npm.cmd run build -- --configLoader native`: passed; 206 modules, PWA generateSW 113 precache entries / 818.58 KiB; generated service worker and Workbox bundle. Build output remains ignored. This does not verify an installed PWA upgrade.
- Browser: all 11 scenarios passed across the full fixture run and targeted public rerun. Ten fixture tests passed in the final full-suite attempt; its public smoke case initially failed because the selector required a main landmark that the public tickets layout does not have. After correcting only that locator, the unmocked public test passed (39.2 seconds; runner exit 0). Assertions require visible headings, finished loading, no request alerts and no uncaught page errors. Routes checked: /, /help/tickets, /track, /help/faq, /help/guides and /food/search. Hosted requests were restricted to GET/HEAD/OPTIONS. Fixture tests passed signed-out/reload/auth switching/logout/notification retry, stale order/payment continuations, tracking and checkout under SecurityError/QuotaExceededError (exactly one creation), real downloaded CSV invalidation, FAQ retry and four browser timezones.
- `git diff --check`: passed. The staged diff was reviewed, and `git diff --cached --check` passed after removing a trailing space and extra final blank line in this report. The staged allowlist contains exactly the 57 reviewed files; generated outputs, private fixtures and credentials are excluded.
- AdminChats arrow/middle-dot encoding restored. Other changed source/checks/functions/report scanned for common mojibake and replacement characters. Removed an interior BOM exposed by a new import in the frontend check.
- Repository source, configuration, checks and documentation scanned for unrelated workspace paths/dependencies; none found.
- Reviewed all tracked/untracked changes, corrective migration privileges/lifecycle checks and dependency changes. Existing launch migrations, 17% commission and legitimate overrides, PayFast shared encoding/signing and server-verified notification confirmation are preserved.

Browser reproduction from this repository (PowerShell):

```powershell
$env:PLAYWRIGHT_CHANNEL = "msedge"
$env:PLAYWRIGHT_DISABLE_GPU = "1"
node checks/verify-browser.mjs
```

The runner builds a dedicated browser bundle and uses one worker. Default browser selection is Playwright Chromium; the environment variables above select the configuration verified on this Windows host. PLAYWRIGHT_TRACE=1 enables optional diagnostic traces. These test controls do not alter production configuration.

### Failed attempts and diagnosis

An overlapping build/browser/database attempt exhausted available native V8 memory; the full regression run passed when repeated sequentially. Development-server verification encountered an EPERM collision in a shared Vite optimization cache and slow cold transforms. Browser verification therefore uses its own generated output/cache under ignored node_modules, a built test-only HTML entry, and Vite preview. The normal production/PWA build was checked separately; the fixture bundle excludes the PWA plugin.

Earlier browser timeouts are failures, not passes. An initial synthetic notification was missing the real service's required createdAt timestamp; correcting the fixture removed that formatter error. Background order polling can create more than one deferred request, so the stale-response test now waits for at least one and resolves all old requests before asserting route isolation. Memory pressure worsened to 77 MB free during a Chromium attempt, which was interrupted rather than counted as a pass. Optional trace recording is now opt-in; browser timing remains bounded. A diagnostic then timed out in browserContext.newPage before application navigation. With PLAYWRIGHT_CHANNEL=msedge and PLAYWRIGHT_DISABLE_GPU=1, the full signed-out/account-switch/logout/notification-retry test passed. This establishes a working software-rendering configuration on this host; it does not prove that GPU rendering alone caused every earlier timeout.

### Local hygiene and scope

All application edits are in the repository identified above. Twenty-four confidently identified misplaced OfficeBites helper/staging artifacts were removed from an unrelated workspace using an exact-file allowlist; none was executed or copied over the application. Unrelated directories and the existing portfolio screenshot were preserved. No ambiguous OfficeBites artifacts remained. The final reviewed change set contains 57 source, test, configuration and documentation files.

`supabase/.temp/` is ignored, including cli-latest. Credentials, .env.local, private fixture material, node_modules, dist, test-results and Playwright output are excluded. New committed checks contain synthetic identities and fixture data only.

### Remaining release gates / skipped checks

- No authenticated hosted customer/vendor/admin workflow or hosted two-account chat/notification check was performed.
- No real PayFast sandbox payment, verified hosted ITN, return/cancel round trip or live record mutation was performed.
- No installed-PWA update, physical mobile device matrix or Firefox/WebKit run was performed.
- PGlite checks compile and exercise the migration in isolation but do not establish multi-session PostgreSQL lock contention/deadlock/retry behavior. That check remains required before release of removal changes.
- The new migration and payfast-initiate source are not deployed; receipt/favourite UI and new lifecycle guarantees must follow the release order above.
- Seven development dependency audit findings remain, requiring a reviewed Tailwind migration or explicit release risk decision. Leaked-password protection/plan eligibility and the business decisions listed above remain unresolved.
- These limits block production release sign-off, and must not be represented as failures fixed by a local commit.
