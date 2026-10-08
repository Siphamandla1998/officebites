# OfficeBites launch implementation — 8 October 2026

Implemented locally on `fix/qa-pass-payments-chat-pwa` in `Siphamandla1998/officebites`, starting from HEAD `485ea3db0d1846aa8a178077e8401369fcbf7d59` with the earlier prepared fixes already present. Earlier work, checkout's displayed-calendar-date/cutoff guard, deferred auth callbacks, and PayFast special-character signature encoding were preserved. The app package/lockfile and `.env.local` were not changed in this pass.

**Status: ready for review and staging validation, not approved for production launch.** No new migration was applied to live, function deployed, production setting changed, payment initiated, customer messaged, existing account removed, order classified, commit created, push made, or site deployed. Live operations were read-only SELECT queries. All fixture mutations below ran in an ephemeral isolated database or stubs.

## Implementation

### Financial ledger and reports

- The vendor default is 17%; current overrides are preserved, including 0%. Commission rate, rounded commission amount, vendor display name and paid timestamp are captured when verified confirmation transitions a suborder to paid. Changing a vendor's current rate does not recalculate paid earnings. Paid financial fields and item name/category/quantity/price snapshots are immutable; deleting a catalogue meal can still set its historical item `meal_id` to NULL.
- Future items capture categories at creation. Historical items retain their recorded names, quantities and prices; missing categories appear as `Unknown (historical)`, rather than guessing a deleted meal's category. Deleted-meal sales remain included.
- The canonical ledger includes paid suborders with eligible fulfilment states and eligible parent orders, excludes `is_test`, and allocates recorded COMPLETE processor fees across eligible suborders. A deterministic residual adjustment reconciles cent rounding. Cancelled/refunded revenue requires a separately reviewed refund accounting policy; this is a paid-sales ledger, not a refund or tax ledger.
- Decimal positive/negative PayFast fees are parsed with an explicit decimal-point pattern and stored as absolute costs. Fresh inspection showed the current live function already has valid single-escaped decimal parsing; the local replacement preserves that behavior and adds the snapshot event. Existing fee logs are not bulk rewritten, and duplicate COMPLETE ITNs do not overwrite a recorded fee.
- Existing paid suborders receive **no invented historical commission backfill**. Their commission remains NULL. Totals that depend on it display `Unresolved`; payable balances reject those records. `admin_record_historical_commission` requires an active administrator, a rate between 0 and 1, and a reason/evidence description, and records an audit entry. Before using it, review invoices/contracts/rate-change records per suborder, record the evidence reference, and approve an exact-ID list. Do not apply today's 17% retrospectively. Legacy dates are explicitly labelled `legacy_order_creation_date`, since an actual payment timestamp cannot be invented.
- Admin/vendor screens and legacy analytics RPCs delegate to the same ledger. Daily, Monday-start weekly, monthly and inclusive date filters use Africa/Johannesburg calendar dates. All time removes the lower lookback limit. Weekly charts show the selected month's weeks; vendor chart dates no longer depend on the browser's timezone.
- Sales, commissions, processor fees, vendor earnings and payout batches are distinct. Admin Reports downloads actual CSV sales/commission rows with totals, order/payment reconciliation, and payout reservations/reconciliation. Values are quoted/escaped, and spreadsheet formula prefixes are neutralised. Empty sales exports still contain headers/totals; failed requests expose retry controls.
- Reconciliation shows recorded order totals, all-suborder gross, eligible business gross, COMPLETE receipt amounts/counts and order/suborder differences. Multiple or absent receipts require review, rather than implying a real payment/ITN has been observed.

### Payout tracking and test classification

`private.finance_settings.fee_policy` starts unset. An administrator must explicitly record either platform-absorbed fees or proportional vendor fees, with a decision reason, before payable balances can be calculated. Marketplace net revenue follows that policy; unresolved policy/rates stay unresolved. Settlement eligibility is completed paid business suborders only.

Payout allocation reserves records; it does not send money. Unique active allocations prevent allocating one suborder twice. Request IDs support retries and reject a reused ID with a different selection. Allocation/classification lock the parent order; allocation, policy changes and reconciliation serialize through the same advisory lock. Allocated batches require reconciliation before fee policy changes. Admin reconciliation records a completed external transfer reference or void reason; paid allocations remain reserved, and void reservations release their records. Bank evidence is manual and unverified by this code. Vendor access is restricted to its own ledger; allocation/reconciliation is admin-only.

Classification is exact-ID, version-checked, reason-required and audited. It cannot proceed while an order has active payout allocations. No classification is executed in this implementation. The report UI exposes a preview only, with before/after sales, commission, fees, paid-order and suborder totals.

`checks/fixtures/audit-order-review.json` records the read-only live review of **OB-57C1D4**, order `ce050a2e-a430-4019-9a02-ce4c7664f485`: two paid preparing suborders totalling R30, two items, one COMPLETE fee log of R1.25, one conversation with one message, and seven exact-link/metadata/ticket-text notification candidates. Review the notification associations explicitly; none is deleted. Under the inspected eligible-sales rule the current gross is R30 and would become R0 after approving only this order's exclusion; fees would move from R1.25 to R0. Historical commission remains unresolved. Other orders are not automatically classified, and all historical records remain retained.

### Request state, loading and dates

Vendor chat open/send/poll responses carry account/thread guards, including delayed reads and account changes. Shared chat send completion is guarded too. `useAsync` invalidates old dependency scopes during render and rejects old callbacks, stale responses and unmounted results. Notifications are tagged by account, clear from the visible state immediately on account changes, and guard refresh/read/dismiss completion. A→B→A pending-request recovery is covered. Support selection is tagged by account and pending replies cannot populate another account's ticket.

Financial, catalogue, chat, notification, order/menu and support request failures have visible retry paths instead of masquerading as empty activity. Notification write failures show feedback. Existing subscription cleanup remains intact; chat does not immediately duplicate its initial fetch on subscription establishment, and matching financial reports share in-flight requests only within the same authenticated account (no persistent financial cache).

Home's delivery-date hook refreshes at the SAST cutoff, focus and visibility changes. Date-only formatting preserves the calendar day across tested timezones. Admin “All vendors” explicitly omits the status filter; ordinary customer requests retain approved-only filtering and backend RLS.

### Suspension and account removal

Local migration 2 intersects existing public-table/Storage ownership policies with active-account policies. Helpers require a remaining Auth identity, an unsuspended/undeleted profile and, for vendors, an owned non-suspended/non-archived vendor. Write triggers and current public SECURITY DEFINER PL/pgSQL RPCs reject inactive callers. Browser access to financial deletion, classification columns and payout mutations is not granted. Existing role/ownership policies are preserved.

The admin UI requests an Edge Function dependency preview and typed `kind:UUID` confirmation. The server validates the caller with Auth `getUser(token)` and an active admin profile; administrative credentials stay server-side. The database rechecks the actor, confirmation and dependency fingerprint and rejects self-removal/administrator removal, including the last active administrator.

Removal first blocks access and anonymises profile/contact/support fields, archives owned vendors, disables their meals, clears their image references, and closes linked conversations. It retains profile/vendor tombstones, order/suborder/item/payment history and payout/audit records. The profile→Auth cascading FK is deliberately replaced with insertion validation plus active-access checks: deleting Auth must not cascade through retained financial identities. Archived vendors cannot be restored to approved status through the ordinary restore action.

The server then bans Auth, removes the exact Storage manifest in batches, deletes Auth, and verifies completion. Failure leaves the account blocked and an auditable resumable job. Retry merges any new Storage dependencies and still requires typed confirmation. Storage writes hold the profile row while checking active access; completion checks remaining ownership/path dependencies as well as the manifest. No existing account or file was removed in testing. These changes require a real disposable staging Auth/Storage test before release; fixture schemas/stubs do not certify the hosted services.

Financial counterparty names/history remain retained where necessary. Free-text chat, feedback, support and raw payment payloads can contain personal information; their retention/anonymisation requires a documented business/privacy decision. This implementation does not claim blanket erasure of free text or external backups. Operators must use the reviewed removal workflow rather than directly deleting Auth/profile/vendor rows.

### PWA and retention

The service worker caches the public app shell and explicit same-origin public assets only. Actual Supabase REST/Auth/Storage and signed/private URLs do not match runtime caching. Startup removes the two legacy OfficeBites caches without touching unrelated caches. Development PWA interception is disabled. Offline support means the shell/assets, not offline authenticated data, ordering, chat, uploads or payment.

Conversation retention has configurable days and UTC cron text, an admin dry-run preview, and an inert public legacy purge routine. If pg_cron already exists, migration 2 registers an **inactive** job; it does not install/enable the extension. Configuration keeps purging disabled and updates the inactive schedule. The private runner returns a dry-run count while disabled. No conversations were purged, and no enable-purge UI/RPC is provided. Actual pg_cron execution and service-worker update/activation were not browser-tested.

## Files changed for this implementation

Earlier prepared-package files remain in the working tree. This pass adds or extends:

```text
src/components/features/AccountRemoval.jsx (new)
src/components/features/PayoutLedger.jsx (new)
src/components/ui/RequestError.jsx (new)
src/context/NotificationContext.jsx
src/hooks/useAsync.js
src/hooks/useDeliveryDate.js (new)
src/hooks/useLiveRefresh.js
src/main.jsx
src/pages/admin/AdminAnalytics.jsx
src/pages/admin/AdminCustomers.jsx
src/pages/admin/AdminOverview.jsx
src/pages/admin/AdminPayments.jsx
src/pages/admin/AdminReports.jsx
src/pages/admin/AdminVendors.jsx
src/pages/customer/ChatList.jsx
src/pages/customer/Favourites.jsx
src/pages/customer/Home.jsx
src/pages/customer/OrderTracking.jsx
src/pages/customer/VendorListing.jsx
src/pages/help/SupportTickets.jsx
src/pages/shared/ChatConversation.jsx
src/pages/shared/Notifications.jsx
src/pages/vendor/VendorChat.jsx
src/pages/vendor/VendorInsights.jsx
src/pages/vendor/VendorMenu.jsx
src/pages/vendor/VendorNotifications.jsx
src/pages/vendor/VendorOrders.jsx
src/pages/vendor/VendorOverview.jsx
src/pages/vendor/VendorRevenue.jsx
src/services/adminService.js
src/services/api/mappers.js
src/services/financialService.js (new)
src/services/orderService.js
src/services/vendorService.js
src/utils/csv.js (new)
src/utils/formatters.js
src/utils/privateCache.js (new)
src/utils/reportingDates.js (new)
src/utils/requestScope.js (new)
vite.config.js
supabase/functions/admin-account-removal/index.ts (new)
supabase/functions/_shared/account-removal.ts (new)
supabase/migrations/20261008114505_launch_financial_ledger.sql (new, not applied live)
supabase/migrations/20261008114550_launch_account_security_retention.sql (new, not applied live)
checks/launch-database.mjs (new)
checks/launch-frontend.mjs (new)
checks/fixtures/live-contract-baseline.json (new, schema metadata only)
checks/fixtures/audit-order-review.json (local-only read-only review; excluded from the review commit because it contains production record data)
OFFICEBITES-LAUNCH-IMPLEMENTATION.md (new)
OFFICEBITES-FIXES-REPORT.md (historical report linked to this follow-up)
```

## Validation and reproducibility

- Isolated PostgreSQL: **73 checks passed** using PGlite 0.5.8. The fixture restores inspected live tables/constraints, enums, functions, triggers, policies and column grants, with synthetic Auth/Storage schemas and synthetic order-flow/account data. Both new migrations compile and execute there. Checks cover 17%/0% snapshots, rate changes, signed decimal fees, deleted meals, immutability, historical evidence, SAST dates, test exclusion, fee cent reconciliation, payout eligibility/retries/duplicate prevention/manual reconciliation, independent vendor progression, account removal/history retention, inactive retention and customer/vendor/admin/anon/suspended permissions. Fresh live metadata confirmed both legacy UUID `storage.objects.owner` and text `owner_id`; the removal manifest/retry checks cover both ownership forms and late dependencies.
- Frontend/service/Edge handler stubs: **52 assertions per timezone** in UTC, Africa/Johannesburg, America/Los_Angeles and Asia/Tokyo. Actual hook/handler source is exercised for stale requests, A→B→A notifications, chat response races, cutoff refresh/cleanup, all-vendor/default filters, CSV download/escaping/formula protection, legacy cache cleanup and actual Workbox URL matching. Removal failure ordering and actual HTTP handler role/token checks use fake Auth/Storage/DB clients. These are not browser or hosted Edge tests.
- Existing auth: both race scenarios passed. Existing order/date/commission: 9 assertions per timezone, 36 total. Existing catalogue/date: 6 per timezone, 24 total. Existing support: 7 mocked service checks passed.
- `npm run build`: production compilation/PWA generation passed, 110 precache entries. Vite compiler spawning required the authorised run outside the sandbox after `spawn EPERM`; no deployment took place.
- Targeted lint on all 63 changed/new source files, Vite config and the two new Edge TypeScript files: zero errors, the same six earlier warnings (four Fast Refresh exports, AuthContext cleanup ref, useAsync variable dependency array).
- `git diff --check`: passed. Existing locked dependencies were reused. Node 22.23.3/npm 10.9.9, Supabase CLI 2.120.0 and PGlite live in the temporary validation directory; no global runtime or persistent PATH change was made. CLI-generated workspace scratch metadata was removed.

Runnable commands (Node on PATH):

```powershell
node checks/auth-race.cjs
node checks/support-service.mjs
foreach ($zone in @('UTC','Africa/Johannesburg','America/Los_Angeles','Asia/Tokyo')) {
  $env:TZ = $zone
  node checks/order-rules.mjs
  node checks/catalogue-filters.mjs
  node --experimental-strip-types checks/launch-frontend.mjs
}
Remove-Item Env:TZ
# Install PGlite only in an isolated temporary validation directory if needed:
npm install --prefix "$env:TEMP\officebites-launch-validation" --no-audit --no-fund @electric-sql/pglite@0.5.8
$env:PGLITE_MODULE = "$env:TEMP\officebites-launch-validation\node_modules\@electric-sql\pglite\dist\index.js"
node checks/launch-database.mjs
npm run build
$files = @(git diff --name-only -- src; git ls-files --others --exclude-standard -- src) |
  Where-Object { $_ -match '\.(jsx|js)$' } | Sort-Object -Unique
npm run lint -- $files vite.config.js supabase/functions/admin-account-removal/index.ts supabase/functions/_shared/account-removal.ts
git diff --check
```

PGlite does not exercise the hosted PostgREST schema cache, GoTrue, Storage HTTP lifecycle, pg_cron extension, Deno module resolution or a browser renderer. Node strips/checks the Edge TypeScript handler syntax and tests it with stubs; `deno check supabase/functions/admin-account-removal/index.ts` and real disposable staging deployment remain pending. Compilation/mock checks do not establish payment success, two-account Realtime delivery, reset email delivery, uploads, installed-PWA recovery, or browser downloads.

## Deployment order — proposed, not performed

1. Review this diff and business decisions; export/verify recoverable DB/Auth/Storage backups and capture the current function/policy/ACL definitions. Recheck live drift against the metadata fixture. Use a separate disposable staging project first. Reconcile existing local/live migration-history divergence before any blanket `db push`; do not replay already-applied historical migrations.
2. Apply **only `20261008114505_launch_financial_ledger.sql`**, in a reviewed migration transaction, and record that exact version. Check snapshot fields/triggers, canonical and compatibility RPC ACLs, zero overrides, unresolved history, fee-policy-null payout gating and RLS. No bulk historical backfill/classification is part of installation.
3. Apply **only `20261008114550_launch_account_security_retention.sql`** next and record that exact version. Validate registration/vendor upgrade, role/suspension policy behavior, the retained-profile/Auth lifecycle and Storage write guard. Verify any registered cron job and settings are disabled. No account removal or purge is an installation step.
4. Type-check and deploy **`admin-account-removal`** with its `_shared/account-removal.ts` dependency. Keep platform JWT verification enabled; the handler additionally validates `getUser(token)` and admin state. Confirm existing server-only Supabase URL/anon/service-role credentials and permitted production/preview origins; never put a service key in Vite env variables. Test preview and failure recovery using designated disposable staging accounts/files only. Existing PayFast functions/signature helper are not replaced by this pass. Supabase's current [Edge authorization guidance](https://supabase.com/docs/guides/functions/auth-headers) supports leaving JWT verification enabled for authenticated client invocations.
5. Refresh/verify the Data API's RPC contracts/schema cache and deploy the reviewed frontend. It deliberately reports a missing-backend error until the new ledger RPC exists; do not deploy it before the backend steps.
6. Repeat designated-account browser checks and compare downloaded reports to SQL totals. Only after explicit approval record the fee policy, evidence-backed historical commissions, and exact OB-57C1D4 classification. Keep retention destructive execution disabled until a separate approved retention review.

## Rollback and decisions

Before new snapshots/ledger/job data are used, a reviewed backup-based rollback may restore prior function/policy/trigger definitions and remove unused additions. After financial entries exist, prefer forward corrective migrations; do not drop snapshots, audit history, payout reservations, or tombstones. Disable UI mutations/withdraw the removal function during incidents. An old frontend may show incorrect historical totals; a blind frontend rollback is not a financial rollback.

Reinstating the profile→Auth FK is unsafe while removed-user tombstones exist. Hard Auth and Storage deletion is irreversible without separately proven backups/recovery and cannot be rolled back by SQL. Removal failure can leave a prepared blocked account; inspect its job and retry with reviewed dependencies, rather than unsuspending it. Paid external bank transfers are not reversed by voiding a record. Retention should remain disabled throughout rollback.

Required decisions: fee payer; settlement cadence/completed-order eligibility, refunds/chargebacks and fee changes after allocation; historical commission/category evidence and acceptable legacy date basis; exact OB-57C1D4 classification; retention/legal/privacy periods and treatment of free text/payment payloads; who validates external bank-transfer references. No code infers these approvals.

## Release checklist

- [x] Local migrations compile and isolated accounting/role regressions pass.
- [x] Existing prepared checks, build, targeted lint and whitespace validation pass.
- [x] Earlier checkout/auth/signature fixes preserved; new live mutations/deployment excluded.
- [ ] Reviewer approves migrations, tombstone design, financial definitions and business policies.
- [ ] Disposable staging Supabase Auth/Storage/Deno/PostgREST/cron tests, including removal failure/retry, complete.
- [ ] Designated accounts verify logout/refresh, search/favourites/cart/date, unpaid recovery visibility, menu editing, independent fulfilment, chat/notifications and support/feedback in a browser.
- [ ] Installed-PWA upgrade/shared-device cache/offline and mobile checks complete.
- [ ] CSV downloads reconcile against SQL for selected SAST ranges and unknown historical data.
- [ ] Backend/function/frontend production rollout approved and verified in the stated order.
- [ ] Fee policy and any historical backfill/test classification separately reviewed and approved.
- [ ] PayFast merchant approval and a completed payment/ITN verified externally. Passing compilation or mocked checks does not clear these gates.

Customer/admin/vendor login remain user-reported passes from the earlier session; they do not verify the new backend/financial/account lifecycle changes.

## Review branch preparation — 8 October 2026

Prepared on `fix/launch-readiness-2026-10-08` for review against the existing baseline. The required source, five migration/history files, account-removal Edge Function and helper, regression checks, schema-only fixture and reports are included. `.env.local`, dependencies, build output, temporary runtimes and `checks/fixtures/audit-order-review.json` are excluded; the production-data review fixture remains intact locally and is ignored. The credential scan's sole match was the explicit synthetic `public-fixture` test key.

Validation was rerun before the review commit: both auth scenarios, seven support checks, 36 order checks, 24 catalogue checks, 208 frontend/service/handler assertions and 73 isolated PostgreSQL checks passed. Production build passed with 110 PWA precache entries. Targeted lint covered 63 source files, Vite config and two Edge TypeScript files: zero errors and six previously documented warnings. Staged whitespace validation is required before committing.

The user authorized committing and pushing this review branch only. The two new backend migrations and account-removal Edge Function remain uninstalled on live; automatic Vercel previews do not install these contracts. No merge, promotion, live migration, Edge deployment, order classification or account deletion is authorized by this review preparation.
