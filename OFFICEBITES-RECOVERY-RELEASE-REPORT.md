# OfficeBites recovery release

## Baseline and scope

This is a frontend recovery release from current origin/main, not the full cleanup release. No database migration or Edge Function deployment is required for the selected changes.

- Repository: https://github.com/Siphamandla1998/officebites.git
- Recovery branch: fix/production-recovery
- Worktree: C:\Users\ADMIN\Documents\officebites-recovery
- Baseline after git fetch origin: f5db4af98ec502bb98e6eb39fbae237befb7b8c9. Fetch found no change to origin/main.
- Reviewed source of selected fixes: efd87b86722d23531d65505e13ed6cc1004b8d62.
- Original cleanup worktree/branch remains intact at that cleanup commit. Its uncommitted OFFICEBITES-PRODUCTION-CLEANUP-REPORT.md and OFFICEBITES-RELEASE-RUNBOOK.md are preserved.
- Only individually reviewed frontend, shared-service, dependency and test changes were selected. The entire cleanup commit was not cherry-picked.
- All task artifacts, dependency cache, browser temporary profiles and outputs are inside the OfficeBites repositories. Generated material, environment files and private fixtures are excluded from the commit.

## Selected fixes

- NotificationContext and SupportTickets handle null account state without dereferencing null. Notification requests are invalidated on cleanup.
- Shared useAsync keeps results scoped to the dependency generation, ignores stale completion/unmount callbacks, preserves same-scope data on refresh failure, supports partial guest-history results and propagates action errors when requested.
- Order tracking/payment/ticket pages isolate account and route changes. Late order/payment responses cannot replace another order or initiate a stale redirect. Tracking and vendor chat/navigation actions guard unmount/scope changes.
- Guest tracking and checkout retain verified recovery details in tab memory when storage throws SecurityError or QuotaExceededError. A successfully created order stays on a recovery screen with its code; continuing uses the existing order rather than creating a second one.
- Recovery review additionally guards checkout completion after navigation/account changes, retains returned guest recovery details even after leaving checkout, and keys protected page state by account identity. Request guards also check the browser URL/navigation identity because a route transition can precede React unmount. These are frontend isolation changes, not backend idempotency.
- Guest feedback permits only the SDK's normal missing-session condition; expired-token/network/server errors still propagate. Current feedback insert columns and policies are retained.
- Coordinate validation rejects missing, blank, nonnumeric and out-of-range values while accepting valid zero coordinates. No hosted coordinates were changed.
- Catalogue, help, order, admin chat and vendor pages show truthful request errors/retry states. SAST cutoff/date refresh and status wording follow existing order contracts.
- Vendor dashboards/orders refresh on focus/visibility/interval using existing services; selected order details follow refreshed rows.
- Financial invalidation refreshes report/payout datasets after existing financial mutations; CSV handlers reject stale/loading/error data. Existing historical-commission RPC is void-returning, so its successful null response is accepted and invalidates financial data.
- Admin chat reads existing order/source/closure/retention metadata and links its existing order. UTF-8 punctuation is retained; TextField labels are explicitly associated with inputs.

## Backend compatibility evidence

Read-only live schema/ACL introspection on gfzhdkitdyqftealgqfi confirmed the existing signatures and authenticated execute grants for get_financial_report, get_payout_ledger, admin_set_fee_policy, admin_allocate_payout, admin_reconcile_payout, admin_classify_test_order, admin_record_historical_commission, admin_preview_test_order, admin_configure_retention, admin_preview_retention and get_vendor_dashboard_stats. Financial/reporting calls retain the existing argument and result shapes.

Existing create_order_from_cart and get_guest_order_by_ticket_json permit anon/authenticated execution; update_suborder_status_and_notify retains authenticated execution. get_nearby_vendors retains its existing coordinate arguments and table result. These metadata checks did not invoke any mutating routine.

Existing conversations columns order_id, source, closed_at and retain_until were verified. Feedback has column-level INSERT grants for id/user_id/rating/comment/recommend, including anon; absence of a table-wide INSERT grant does not mean insertion is forbidden. Existing feedback_submit checks user_id against auth.uid(), permitting null guest ownership, with active-account restrictions retained. No feedback was submitted to live.

admin_recent_payments, admin_customer_favourite_counts and prepare_payfast_order remain absent. This branch has no callers for them and no corrective migration. The release-boundary check compares preserved backend/payment/PWA files with the exact baseline.

Preserved unchanged: all supabase files, existing PayFast signature encoding and server-only confirmation, guest verification contracts, 17% commission and legitimate overrides including zero, PWA private-data cache exclusions and safe-area styles. No fee policy was selected and retention remains unchanged/disabled; local fixture mutations are not hosted settings changes.

## Deferred issues and risks

- Receipt accuracy/timestamps, recent verified-receipt reporting and account/fulfilment receipt review remain deferred. Existing admin recent-payments behavior still derives sales from financial reports; it is not the new receipt ledger.
- Admin favourite counts remain the baseline behavior and may be misleading. No new favourite-count RPC or caller is included.
- Account-removal lifecycle blockers, race serialization, late-payment audit safeguards and new payment preparation are excluded. Existing removal functionality remains as deployed; no claim is made that its concurrency risks are fixed. Native PostgreSQL concurrency is untested and is not a gate for this frontend-only patch, but remains necessary before releasing the deferred backend changes.
- Staging's is_admin permission error is untouched. Preview remains staging-configured; a successful Preview build is not proof of production backend compatibility.
- Storage-disabled recovery survives within a tab. After reload/closing it, the user must retain the order code and phone number and verify through Track Order. Network ambiguity during order creation is not solved with server idempotency by this patch.
- Seven development dependency findings remain (five high, two moderate); no forced audit fix or Tailwind major upgrade. Dependency risk needs an explicit release decision.
- Authenticated hosted customer/vendor/admin workflows, actual payment initiation/ITN confirmation, messages, account removal, installed-PWA upgrades, physical devices and Firefox/WebKit were not exercised. No hosted mutation was performed.

## Dependency review

The cleanup lockfile updates were reviewed individually and retained within existing compatible dependency ranges:

| Dependency | Baseline → recovery | Reason |
| --- | --- | --- |
| axios | 1.18.1 → 1.20.0 | Compatible maintenance update; API usage unchanged |
| react-router / react-router-dom | 7.18.1 → 7.18.4 | Paired patch update; route/account navigation checked |
| postcss | 8.5.19 → 8.5.29 | Compatible CSS processing update; production/PWA output checked |
| nanoid | 3.3.16 → 3.3.20 | Compatible PostCSS dependency update |
| source-map-js | 1.2.1 → 1.2.2 | PostCSS-compatible patch update |
| brace-expansion | 5.0.8 → 5.0.12 | Compatible maintenance update |
| filelist/brace-expansion | 2.1.2 → 2.1.7 | Compatible maintenance update on the separate dependency path |
| fast-uri | 3.1.4 → 3.1.8 | Compatible validation dependency update |
| browserslist | 4.28.6 → 4.29.3 | Compatible browser-target tooling update |
| baseline-browser-mapping | 2.10.43 → 2.11.27 | Browser-target data dependency |
| caniuse-lite | 1.0.30001806 → 1.0.30001815 | Browser compatibility data |
| electron-to-chromium | 1.5.393 → 1.5.451 | Browser compatibility data |
| node-releases | 2.0.51 → 2.0.58 | Browser/tool target data |
| update-browserslist-db | 1.2.3 → 1.3.4 | Compatible Browserslist dependency |
| @electric-sql/pglite | added 0.5.8 (dev) | Reproducible existing baseline fixture checks; not native concurrency |
| @playwright/test, playwright, playwright-core | added 1.64.0 (dev) | Reproducible browser regression tooling |

npm ci installed the exact lockfile successfully (442 packages). npm audit reported braces, chokidar, fast-glob, micromatch, tailwindcss, postcss-nested and postcss-selector-parser. Every reported vulnerable node is marked dev-only in the lockfile. Audit exits nonzero because these findings remain; it is not a clean audit.

## Actual verification

- npm ci: passed, exact reviewed lockfile installed.
- node checks/verify-local.mjs: passed: 29 recovery runtime assertions; 73 existing baseline PGlite checks; 7 support-service checks; auth sign-out/switch races; four time zones each with 9 order/date/commission, 6 catalogue and 53 frontend/service/handler assertions.
- node checks/recovery-runtime.mjs after the navigation-identity fix: 33 assertions passed, including URL change, navigation identity and unmount.
- node checks/recovery-scope.mjs: passed separately after adding the release boundary check to the runner.
- npm run lint: passed with zero errors and nine existing warnings (hook dependency/cleanup and Fast Refresh export warnings).
- Final npm run build -- --configLoader native: passed after the last checkout refinement; 206 modules, PWA generateSW, 113 precache entries (818.35 KiB), dist/sw.js and manifest generated. The earlier standard npm run build also passed.
- Built bundle inspection: live gfzhdkitdyqftealgqfi.supabase.co present, staging project reference and all three deferred RPC names absent.
- Changed-source encoding scan: passed for 31 tracked source changes; no detected replacement characters/common mojibake.
- Browser verification: full suite passed (17 tests, 3.4 minutes), then all four affected checkout tests passed after the final guest-recovery refinement (6.6 minutes). Coverage includes signed-out startup/reload, fixture sign-in/account switching/logout, notification failure/retry, stale order/payment responses, guest tracking/checkout under SecurityError and QuotaExceededError, financial invalidation/CSV error guards, admin state reset, vendor focus refresh, four browser time zones, and six unmocked public routes (/, /help/tickets, /track, /help/faq, /help/guides, /food/search) plus home reload.
- Dependency audit: seven remaining dev-only findings; not a clean audit.
- Staged diff reviewed; git diff --cached --check passed. All 51 staged files match the reviewed allowlist. Environment files, generated output, private fixtures, backend changes and credential-like values are excluded. Staged source encoding checks passed. The two original uncommitted cleanup reports were verified byte-for-byte unchanged.

Failed attempts and fixes: an initial slow startup timed out; a focused 50.9-second startup diagnostic rendered correctly without page errors or failed requests. Assertions remain bounded at 60 seconds. A real reload then exposed a fixture routing mistake: it loaded the normal app entry instead of the fixture entry. Fixture document reloads now stay isolated. The added tests subsequently reproduced a stale payment redirect during a React route transition and dropped guest recovery details after leaving checkout. Navigation-identity guards and saving returned guest details before suppressing stale UI effects fixed these failures, with successful retests as listed above. No timeout was counted as a pass.

Browser fixture tests use the real application/provider tree with synthetic services, block hosted requests, and assert no unexpected RPCs. Signed-out hosted reads use the unmocked public frontend with non-GET/HEAD/OPTIONS Supabase requests blocked. Fixture authentication events are not hosted login credentials; no real payment, message, feedback submission or account removal is performed.

## Proposed candidate and promotion — not executed

No backend release steps accompany this recovery release. Do not apply migrations, deploy functions or replay launch migrations.

After separate authorisation, use the recovery commit and production Vercel configuration to create an unaliased candidate. Keep Preview entries unchanged:

```powershell
Set-Location 'C:\Users\ADMIN\Documents\officebites-recovery'
$env:npm_config_cache = Join-Path (Get-Location) '.officebites-local/npm-cache'
$env:TEMP = Join-Path (Get-Location) '.officebites-local/release-temp'
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
$env:TMP = $env:TEMP
git status --short
git rev-parse HEAD
$env:VERCEL_PROJECT_ID = 'prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71'
$env:VERCEL_ORG_ID = 'team_kKRzCLk1pNHoIA4sV1M0ciSg'
npx --yes vercel@63.1.0 pull --yes --environment=production
if ($LASTEXITCODE) { throw 'Production configuration pull failed' }
npx --yes vercel@63.1.0 build --prod
if ($LASTEXITCODE) { throw 'Production candidate build failed' }
# Verify generated endpoint/key, PWA output and release commit before upload.
npx --yes vercel@63.1.0 deploy --prebuilt --prod --skip-domain
if ($LASTEXITCODE) { throw 'Candidate upload failed' }
```

Use authenticated CLI sessions and repository-local npm/TEMP caches; do not print pulled environment values. Confirm CLI help supports the stated flags. Verify generated JS targets gfzhdkitdyqftealgqfi.supabase.co, contains no staging eyhmarmekioovcjibcbr reference, and contains only public frontend credentials. Production values are separately scoped; the local build does not replace Vercel Production configuration verification.

Record candidate URL/ID and compare live aliases before/after; the older production deployment must continue serving. Verify candidate signed-out startup/reload, affected routes, network/console errors and production backend endpoint without hosted writes. Authenticated/live business actions need their own authorised test plan.

Only after candidate sign-off and separate promotion authorisation, propose:
```powershell
# Set $CandidateUrl to the exact URL returned above, after candidate sign-off.
npx --yes vercel@63.1.0 promote $CandidateUrl
```
Do not promote the staging-configured cleanup Preview. Capture the current live deployment ID before promotion for a separately authorised rollback to the prior deployment. Since this recovery release has no backend change, frontend rollback does not require database rollback; it does not erase payments or change records. Installed service-worker update behavior still needs release verification.

Publishing a candidate is blocked only by any failed local checks noted above, the remaining dependency risk decision and separate deployment authorisation/configuration checks. Deferred backend concurrency work is explicitly outside this smaller release.
