# OfficeBites integration readiness audit

Audit date: 16 October 2026. Corporate charging and delivery enforcement remain disabled. No release authorized by this audit.

Branch: `feat/legal-vendor-corporate-acquisition`. HEAD: `abebf8a7de14984e61a183b1fc257eba31a53811`. Remote: `https://github.com/Siphamandla1998/officebites.git`. Origin fetch completed successfully.

## Executive assessment

**Not a release candidate for corporate activation or real-money sign-off.** This audit changes only this report and ignored audit helpers/evidence under `.officebites-local`. It does not reconcile application files or install anything. Earlier modifications remain intact.

Status meanings: **Passed** is direct observed evidence for the stated method; **failed** is an observed check failure; **blocked** lacks required access/configuration; **untested** has no execution evidence. A mocked session or service-only SQL payment confirmation is not a genuine browser checkout/payment.

## Semantic reconciliation decisions

| Area / file(s) | Evidence and classification | Safest reconciliation |
| --- | --- | --- |
| AuthContext, authService, Login, ProtectedRoute | Recovery commit is an ancestor; local authService adds active/deleted profile checks and sanitized errors. ProtectedRoute has account-key remounting beyond cleanup. User subsequently reports successful browser login; original Auth 400 is not currently reproducing for the user. | Preserve guards. Login is manually passed; refresh/session persistence and history still need separate verification. |
| Checkout.jsx, guest.js, useRequestGuard.js | Recovery includes guest recovery under storage errors, request/account/navigation guards, and the displayed-date check. Feature adds action locks, mobile validation and optional server quote. | Preserve all these layers; do not copy cleanup's older checkout over them. |
| paymentService.js / PayFast initiation | Feature retains recovery PayFast initiation and adds guarded cancellation/Ozow groundwork. Local initiation matches staging v19, including active-account/expired-token checks and staging CORS. | No source overwrite; actual merchant sandbox/ITN still required. |
| orderService.js, OrderTracking, OrderCard, TicketCard, StatusBadge | Local repair distinguishes paid from fulfilled, unknown/mixed states from retry-safe unpaid orders. Member and guest create RPC signatures remain compatible in native rollback checks. | Preserve state guards; verify the actual deployed frontend with disposable sessions. |
| financialService.js / AdminReports | Recovery financial revision invalidation, account-scoped pending reports and CSV error gating preserved. Void historical-commission RPC is allowed beyond cleanup. | Preserve newer behaviour; do not revert to cleanup's older null-result handling. |
| adminService.js / AdminCustomers.jsx | **Confirmed missing cleanup fix:** service supplies neither favouriteMealIds nor favouriteCount, while UI renders favouriteMealIds?.length || 0. Staging has admin_customer_favourite_counts(), unused locally. Existing staging customers currently have no favourites, so a visible nonzero mismatch was not reproduced on existing records. | Review integrating the scoped count RPC and count field together, with regression and permissions checks. Do not fabricate zero when count is unavailable. |
| AccountRemoval.jsx | **Confirmed missing cleanup UX:** ignores preview.blockers and allows confirmation even when backend preview reports blockers. Staging removal_blockers/prepare guard exist. This is misleading UI; source evidence does not prove the guarded backend permits removal. | Review showing blockers/disabling action. Do not invoke removal during this audit. |
| orderService.getRecentPayments / AdminOverview | **Deferred cleanup capability:** cleanup uses admin_recent_payments receipt IDs, processed timestamps and requires_review. Local code instead derives reconciled business-payment summaries from financial reports, correctly labels Paid and includes delivery, but omits receipt identity and inactive-account review indicator. | Decide summary vs receipt audit deliberately; retain Paid/fulfilment distinction and reconciliation checks while adding a separate receipt/review view if approved. |
| 20261008185732_production_audit_cleanup.sql | **Source-history gap:** absent locally, present on cleanup branch and exactly matches staging version 20261010094332 after normalization. Later local migrations/tests depend on installed cleanup prerequisites. | Restore the reviewed historical source in a separate authorized change; record installed mapping. Do not replay it or blanket db push. |
| production-database/runtime/browser checks and cleanup report | Cleanup-only filenames absent; recovery renames/adapts browser/runtime coverage and later feature tests extend it. Isolated repair fixture reconstructs missing baseline guards; this is not equivalent to having cleanup source tracked. | Reconcile missing backend-specific regression coverage separately; do not blindly replace expanded recovery suites. |
| CENTRAL/VENDOR origins, Ozow, subscriptions, legal/corporate | Newer feature/working-tree capabilities intentionally differ from cleanup and main. All relevant gates stay disabled. | Keep additive history and hard gates. |

No frontend recovery commit is missing from ancestry. Conversely, ancestry does not prove every cleanup capability is integrated. The file matrix below distinguishes exact on-disk equivalence from semantic decisions. No merge, rebase, reset or cherry-pick was performed.

## Staging migration comparison

Project inspected: **eyhmarmekioovcjibcbr**. Live gfzhdkitdyqftealgqfi was not mutated. Compared installed history statement bodies with all 36 local SQL files using normalized MD5 (CRLF converted to LF, outer whitespace trimmed). These hashes establish body equality, not a guarantee that every current database object still equals its historical definition.

| Local source | Installed staging version | Comparison |
| --- | --- | --- |
| `20261007141325_harden_live_order_and_chat_permissions.sql` | No direct match | Consolidated staging prerequisites; not an exact source-history match |
| `20261007152430_scoped_order_customer_names.sql` | 20261010094146 | Normalized body matches |
| `20261007153218_support_atomic_create_and_feedback.sql` | 20261010094157 | Normalized body matches |
| `20261008114505_launch_financial_ledger.sql` | 20261010094228 | Normalized body matches |
| `20261008114550_launch_account_security_retention.sql` | 20261010094255 | Normalized body matches |
| `20261016074256_checkout_recovery_mobile_delivery_gateways.sql` | 20261016080056 | Normalized body matches |
| `20261016081336_booking_mobile_validation.sql` | 20261016081551 | Normalized body matches |
| `20261016083644_ozow_attempts_subscription_approval.sql` | 20261016084712 | Normalized body matches |
| `20261016090258_central_hub_vendor_origin_approval.sql` | 20261016091616 | Body differs; see encoding note |
| `20261016091839_central_hub_display_name_encoding.sql` | 20261016092052 | Normalized body matches |
| `20261016092359_delivery_unenforced_order_snapshots.sql` | 20261016092635 | Normalized body matches |
| `20261016094201_legal_corporate_framework.sql` | 20261016095620 | Normalized body matches |
| `20261016100142_commercial_reporting_contract_locks.sql` | 20261016100710 | Normalized body matches |
| `20261016101707_repair_order_policy_helper_access.sql` | 20261016103515 | Normalized body matches |

Twelve of the fourteen timestamped local source bodies match recorded staging bodies. Two exceptions:

- `20261016090258`: one hub-name literal was transported as mojibake. Diff reviewed: no policy/fee/logic difference. Installed `20261016092052` is the exact local forward encoding repair; current hub_name and column default both read OfficeBites — Eduvos Umhlanga.
- `20261007141325`: no exact history-body/name match. Staging used separately named prerequisite/alignment migrations (including `20261010094130`), rather than replaying live history. Current checkout/guest/order-state and RLS contracts are tested separately; do not certify this historical source as installed verbatim.

The 22 older numbered migrations are historical source, not one-to-one matches with staging's consolidated/renamed baseline. They include two distinct 0018 filenames. Staging has additional access-lockdown/repair migrations and the cleanup migration absent locally. **Local and staging migration history are not interchangeable or ready for unrestricted db push.** Exact SQL-body comparison of the remote cleanup source confirms it matches the recorded staging cleanup body; historical source restoration remains outstanding.

Current metadata verifies the order SELECT ownership/admin/vendor policy, authenticated helper EXECUTE and anonymous denial, receipt/favourite/removal-blocker contracts, disabled commercial CHECK interlocks and the actual private.create_order_core cutoff. This is targeted contract verification, not a full database drift proof.

## Edge Function and frontend/backend versions

**Passed:** staging payfast-initiate **v19 ACTIVE**, verify_jwt=false as previously deployed, has all three source files equal to current local files after line-ending normalization: payfast-initiate/index.ts, _shared/payfast.ts and _shared/payment-origins.ts. Own getUser/profile/guest-proof and service-only preparation checks remain required; gateway JWT setting alone is not authentication proof.

**Confirmed frontend mismatch:** Vercel reports deployment `dpl_B6QSsSwAng3GvEC1Uk4rnyXUU5He`, URL [existing preview](https://officebites-n7cs82zjg-sp24tg-6983s-projects.vercel.app/), READY, preview target, commit **8d4daed77583975aa834d2627dd38118465d0650**, checkout feature branch. Local HEAD is two commits newer, plus the uncommitted legal/checkout repair. Therefore local UI fixes cannot be claimed present in this preview. No preview was deployed or changed.

Staging PayFast controls say enabled/ready, but that flag does **not** prove sandbox merchant mode. Ozow remains disabled/not ready. Delivery enforcement, activation-ready/pin/fee confirmations, commercial flags and retention remain false.

## Authentication and genuine customer journeys

| Check | Result | Actual method / limit |
| --- | --- | --- |
| Browser login / original account-specific login 400 | **Passed, user-reported manual login** | User replied “I can login pass that” after the staging login request. Treat login as passed and the earlier error as not currently reproducing for the user. Assistant did not observe the login; account, role and exact deployment were not restated. This does not establish the historical error's cause or verify session refresh, order history or checkout. No credentials or account changes were required. |
| Order-history 403 repair | **Passed, native role test** | Original missing vendor_can_see_order EXECUTE corrected by installed repair; current authenticated grant/anonymous denial verified. Synthetic ownership/isolation assertions rerun in rollback. Genuine user JWT/browser history still untested. |
| Authenticated and guest order creation | **Passed, native RPC; genuine browser blocked** | Native repair suite creates both using role claims/anon and validates pending/unpaid. No real browser order submitted; disposable sessions and verified non-real-money gateway mode are not available. |
| Payment confirmation | **Passed, synthetic service-only RPC/replay** | Staging rollback confirmation moves to paid/confirmed without completing fulfilment; immutable snapshots survive replay. Not an actual gateway callback or completed hosted ITN. |
| Vendor acceptance/completion | **Passed, sequential native RPC** | Unpaid progression and skipped transitions rejected; each vendor advances accepted/preparing/ready/collected/completed. One vendor cannot prematurely complete the aggregate. Actual vendor/customer/admin hosted dashboards not exercised under signed-in accounts. |
| Payment/status rendering | **Passed, mocked services/browser evidence from prior follow-up** | Previous 30-test Edge browser run passed on these unchanged sources. Current audit reran 66 service/state/image/auth checks. This does not establish the older preview's signed-in rendering. |
| Genuine non-real-money browser payment/checkout | **Blocked** | Need disposable accounts and explicit proof of sandbox gateway configuration. Enabled/ready controls are insufficient; no real-money payment or initiation was attempted. |
| Installed-PWA update, physical mobile, two-account hosted chat/notifications | **Untested** | Compilation, fixture browser rendering and signed-out hosted reads cannot certify these. |

Native staging state remains 6 unpaid/pending, 3 paid/confirmed and 1 paid/completed suborders. No historical order was changed. Ownerless approved vendors remain excluded by orderability controls, rather than inventing legitimate ownership.

## Independent sessions and financial reconciliation

**Failed test setup, not a demonstrated lock bug:** concurrently dispatched the existing two-session delivery policy lock holder and quote receiver through management SQL, with a two-second stagger and rollback-only locks. The holder completed; receiver returned `Lock-holder session is not ready; test not performed`. The connector did not establish overlapping observable sessions. No policy/origin was changed. This does not test revocation races.

Simultaneous checkout/payment confirmations, acquisition 49/50 and 99/100 boundaries, concurrent refunds, expiry during lock wait and delivery-origin revocation remain **blocked/untested as independent authenticated sessions**. PGlite, synthetic role claims and sequential replay checks are not substitutes. Required access: staging-only or isolated-clone database connections via secure local configuration, disposable Auth/browser sessions, and explicit sandbox gateway setup. Do not put credentials in chat/Git. Enabled commercial race tests need an isolated clone; do not remove hard interlocks on shared staging.

**Passed, synthetic financial evidence:** reran native legal suite, 22 assertions. It produces 120 R70 orders: R8,400 meals, R1,260 platform (15%), R168 internal charge (2%), R581 progressive acquisition and illustrative R6,391 before provider expenses/tax. The standard deduction is **17% total, not 19%**. Existing negotiated commission snapshots are preserved. Acquisition is per agreement/vendor/SAST Monday week: positions 1–49 at 5%, 50–99 at 7.5%, 100+ at 10%. Cumulative R20+R50 refunds at the original 10% credit R2+R5, with event deduplication and capped credits; consumed positions remain auditable.

**Confirmed incomplete provider integration:** only private.record_acquisition_refund exists; service_role cannot execute it, and Edge sources expose no provider refund adapter. Provider-confirmed standard-fee compensation, discounts, negative balances and already-paid payout recovery remain incomplete. Existing allocator has a corporate payout hold, not integrated net settlement. No external refund/payout transaction was used to manufacture verification. Corporate and standard-component ledgers/refund adjustments remain empty after rollback.

## Legal and cutoff approval gates

Reviewed LEGAL-APPROVAL-CHECKLIST.md. Owner-supplied entity is Officebites PTY LTD / K2026677349; this is not independent registry verification. Business/legal-notice addresses, VAT treatment, Information Officer identity/contact and approved legal wording remain missing. Staging has **zero legal document versions**. No professional approval or mandatory disclosure completeness is claimed. Retired refund text has unsupported processing promises and must not be republished.

### Cutoff inventory

- Executable frontend: src/utils/constants.js:13 (19), orderRules.js isOrderingOpen (previous-day UTC calculation), nextOrderableDate (tomorrow/day-after), isPastTodaysCutoff.
- Reactive consumers: hooks/useDeliveryDate.js, customer Home.jsx, FoodSearch.jsx, CategoryDetail.jsx, VendorProfile.jsx and Checkout.jsx. Checkout validates the displayed calendar date; no silent shift is allowed.
- Executable staging server: **private.create_order_core** is the only public/private function currently containing the 19-hour rule. create_order_from_cart and create_order_with_delivery delegate into the core. Local source definitions occur in 20261007141325 and 20261016074256; historical sources must remain immutable.
- UI text: shared/Landing.jsx, help/BusinessHours.jsx and retired help/Terms.jsx. These are text, not enforcement.
- Regression assumptions: checks/order-rules.mjs, launch-frontend.mjs, browser-harness.jsx and recovery-browser.spec.mjs; fixtures/live-contract-baseline.json records historical SQL and must not be mistaken for runtime configuration.

### Prepared 09:00 same-day proposal — approval required, not implemented

For an approved same-day delivery date D: cutoff = D at 09:00 SAST (07:00 UTC), strictly reject at/after cutoff; before 09:00 the earliest candidate is today, at/after 09:00 tomorrow. Then apply the vendor-selected available_days and all item availability rules server-side. Update server core and frontend/calendar consumers together with one additive reviewed staging migration; preserve displayed-date confirmation and revalidate before create/payment. Update active marketing/help text and tests; do not rewrite historical orders/migration source.

There is a scope conflict to resolve before implementation: earlier owner direction permits meal-specific advance ordering until **13:00 the previous day** as well as same-day meals. This request identifies **09:00 same-day** as the proposed approval target, but does not establish whether it replaces all meal modes or supplies only the same-day mode. Recommended approval: vendor-preselected advance/same-day mode, advance cutoff D-1 13:00, same-day cutoff D 09:00, weekdays separate, and every meal in a mixed cart must be eligible for its displayed date. Do not simply change ORDER_CUTOFF_HOUR to 9: that would still calculate the previous day and exclude same-day orders.

Approval tests: 08:59:59.999/09:00 SAST, 12:59:59.999/13:00 previous-day advance mode, four browser timezones, midnight/year rollover, invalid/past dates, unavailable weekdays, mixed carts, stale open checkout and direct RPC bypass attempts. No cutoff change was made.

## Checks performed in this audit

- **Passed:** origin fetch; ancestry/reference review; 146-row on-disk file matrix; local/staging normalized migration-history comparisons; exact three-file PayFast staging comparison; preview metadata; scoped RLS/grant/feature-flag reads.
- **Passed:** 66 focused checkout repair SDK/state assertions and 25 mocked payment CORS assertions.
- **Passed:** 18 native repair and 22 native legal/financial assertions rerun; all synthetic writes and temporary test-only constraint bypasses rolled back.
- **Failed setup:** concurrent delivery lock receiver found no active holder; not counted as pass.
- **Prior evidence, not rerun here:** unchanged-source full local regression run; final isolated legal 103 assertions; 30 Edge browser tests; staging-mode production/PWA build (122 entries); 36-source targeted lint; six Deno Edge checks. See LEGAL-CORPORATE-IMPLEMENTATION-REPORT.md for limits and initial tooling failures.
- **Passed:** git diff --check. SHA-256 preservation check on all 282 pre-existing tracked/nonignored files returned zero changed or missing files; staged diff remains empty. Ignored environment/runtime/build files were not edited. No application source changed in this audit, so builds were not repeated solely for report edits.
- **Passed, user-reported:** browser login, confirmed after this audit. The historical account-specific Auth error's root cause remains unclassified; it is not currently reproducing for the user and is no longer listed as a current login blocker.
- **Blocked/untested:** refresh/session persistence, genuine authenticated browser history, real authenticated/guest browser checkout and non-real-money gateway/ITN, independent financial/revocation races, provider refunds/net settlements, installed PWA and final legal/tax approval.

## Recommended safest release sequence

1. Preserve this baseline. Review missing cleanup history source and specific favourites/removal-blocker/receipt-review UX changes as individual diffs; do not merge the cleanup branch wholesale.
2. Preserve the user's manual login pass. Supply designated disposable staging sessions and secure local isolated-clone connection access; verify refresh/session persistence and browser history separately. Investigate the historical Auth failure only if it recurs. Confirm a sandbox merchant setup before any initiation.
3. Approve cutoff scope; stage the additive server/frontend change together and execute calendar/availability/direct-RPC checks.
4. Finish provider-confirmed refund and net payout/negative-balance adapters and approve VAT/settlement policy. Keep commercial hard gates false; prove duplicate-event/conflict/expiry/revocation races in independent sessions on an isolated clone.
5. Finish legal disclosures/documents and professional/owner approvals; validate immutable consent evidence using genuine disposable Auth flows.
6. Only after separate authorization create a reviewed integration commit/preview from the reconciled tree. Compare that exact frontend commit and backend contracts; test all customer/vendor/admin/PWA stories against it.
7. Seek explicit release approval with remaining failures disclosed. No push, merge, deployment, live mutation, real payment, charge activation or deletion is authorized by this audit.

### Numbered historical source comparison

This completes the body-hash inventory for the older local migration files. No exact match is a history difference, not permission to install the file; current staging contracts and replacement prerequisites take precedence.

| Historical source | Exact normalized staging history body |
| --- | --- |
| `0001_core_schema.sql` | No exact body match; consolidated/changed baseline |
| `0002_auth_trigger_and_storage.sql` | No exact body match; consolidated/changed baseline |
| `0003_chat_and_notifications.sql` | No exact body match; consolidated/changed baseline |
| `0004_support.sql` | No exact body match; consolidated/changed baseline |
| `0005_guest_order_security.sql` | No exact body match; consolidated/changed baseline |
| `0006_payfast.sql` | No exact body match; consolidated/changed baseline |
| `0007_vendor_dashboard_stats.sql` | No exact body match; consolidated/changed baseline |
| `0008_fix_payment_status_transition.sql` | No exact body match; consolidated/changed baseline |
| `0009_fix_payment_submitted_transition.sql` | No exact body match; consolidated/changed baseline |
| `0010_vendor_order_visibility.sql` | No exact body match; consolidated/changed baseline |
| `0011_vendor_customer_visibility.sql` | No exact body match; consolidated/changed baseline |
| `0012_guest_email_field.sql` | No exact body match; consolidated/changed baseline |
| `0013_meal_scheduling.sql` | No exact body match; consolidated/changed baseline |
| `0014_admin_chat_moderation.sql` | No exact body match; consolidated/changed baseline |
| `0015_suborder_status_notify.sql` | No exact body match; consolidated/changed baseline |
| `0016_vendor_initiated_chat.sql` | No exact body match; consolidated/changed baseline |
| `0017_notification_system.sql` | No exact body match; consolidated/changed baseline |
| `0018_fix_admin_category_demand.sql` | No exact body match; consolidated/changed baseline |
| `0018_vendor_location.sql` | No exact body match; consolidated/changed baseline |
| `0019_location_discovery_safety.sql` | No exact body match; consolidated/changed baseline |
| `0022_vendor_signup_provisioning.sql` | No exact body match; consolidated/changed baseline |
| `0023_release_candidate_reconciliation.sql` | No exact body match; consolidated/changed baseline |

## Git ancestry

| Reference | SHA | HEAD-only / reference-only commits | Merge base |
| --- | --- | --- | --- |
| origin/main | 4c4835db62b7db4c7a725c92d7a6294ca523fa57 | 5 / 0 | 4c4835db62b7db4c7a725c92d7a6294ca523fa57 |
| origin/fix/production-recovery | 4c4835db62b7db4c7a725c92d7a6294ca523fa57 | 5 / 0 | 4c4835db62b7db4c7a725c92d7a6294ca523fa57 |
| origin/fix/production-audit-cleanup | efd87b86722d23531d65505e13ed6cc1004b8d62 | 6 / 1 | f5db4af98ec502bb98e6eb39fbae237befb7b8c9 |
| feat/checkout-ozow-distance-admin-controls | abebf8a7de14984e61a183b1fc257eba31a53811 | 0 / 0 | abebf8a7de14984e61a183b1fc257eba31a53811 |
| origin/feat/checkout-ozow-distance-admin-controls | 8d4daed77583975aa834d2627dd38118465d0650 | 2 / 0 | 8d4daed77583975aa834d2627dd38118465d0650 |
| origin/development | 28560f3c47dc3a9bb8dcaa20050abe20aa697fa7 | 74 / 1 | No common ancestor |
| origin/candidate-fixes | 28560f3c47dc3a9bb8dcaa20050abe20aa697fa7 | 74 / 1 | No common ancestor |

The two local development branches point to the same HEAD; there is no newer local development commit. Remote development/candidate-fixes are older unrelated histories with no common ancestor. Five feature commits are ahead of main; the cleanup tip is a divergent commit, not an automatically missing patch set.

## Starting uncommitted inventory

No staged files were reported. This inventory includes tracked modifications and nonignored untracked files; ignored environment/runtime/build files were preserved and not copied into the report. `deno.lock` is already untracked at audit start.

```text
M checks/browser-harness.jsx
 M checks/checkout-browser.spec.mjs
 M checks/checkout-database.mjs
 M checks/recovery-browser.spec.mjs
 M checks/recovery-scope.mjs
 M checks/verify-local.mjs
 M src/components/features/MealFormModal.jsx
 M src/components/features/OrderCard.jsx
 M src/components/features/TicketCard.jsx
 M src/components/forms/FileUpload.jsx
 M src/components/ui/Avatar.jsx
 M src/components/ui/StatusBadge.jsx
 M src/layouts/AdminLayout.jsx
 M src/layouts/AuthLayout.jsx
 M src/layouts/CustomerLayout.jsx
 M src/layouts/PublicLayout.jsx
 M src/layouts/VendorLayout.jsx
 M src/pages/admin/AdminOverview.jsx
 M src/pages/admin/AdminPayments.jsx
 M src/pages/auth/Login.jsx
 M src/pages/auth/Register.jsx
 M src/pages/customer/BecomeVendor.jsx
 M src/pages/customer/OrderTracking.jsx
 M src/pages/customer/PaymentUpload.jsx
 M src/pages/customer/TicketConfirmation.jsx
 M src/routes/AppRoutes.jsx
 M src/routes/routeComponents.js
 M src/services/api/mappers.js
 M src/services/authService.js
 M src/services/orderService.js
 M src/services/vendorService.js
 M src/utils/constants.js
 M supabase/functions/payfast-initiate/index.ts
?? CHECKOUT-AUTH-PAYMENT-REPAIR-REPORT.md
?? LEGAL-APPROVAL-CHECKLIST.md
?? LEGAL-CORPORATE-IMPLEMENTATION-REPORT.md
?? checks/checkout-repair-database.mjs
?? checks/checkout-repair-staging.sql
?? checks/checkout-repair.mjs
?? checks/fixtures/checkout-repair-prerequisites.sql
?? checks/legal-corporate-database.mjs
?? checks/legal-corporate-disable.sql
?? checks/legal-corporate-staging.sql
?? checks/payment-cors.mjs
?? deno.lock
?? src/components/features/CommercialStatement.jsx
?? src/components/features/VendorConsent.jsx
?? src/components/layout/LegalLinks.jsx
?? src/pages/help/LegalDocument.jsx
?? src/pages/shared/CommercialWorkspace.jsx
?? src/services/commercialService.js
?? src/utils/authError.js
?? src/utils/checkoutError.js
?? src/utils/orderState.js
?? src/utils/persistentImage.js
?? supabase/functions/_shared/payment-origins.ts
?? supabase/migrations/20261016094201_legal_corporate_framework.sql
?? supabase/migrations/20261016100142_commercial_reporting_contract_locks.sql
?? supabase/migrations/20261016101707_repair_order_policy_helper_access.sql
```

## File-level reconciliation matrix

Comparison is the actual on-disk working tree, including uncommitted files. Same means identical after line-ending normalization and outer whitespace trimming; different is not automatically a missing fix. The union includes both recovery commits, current feature changes and every uncommitted file. Historical SQL is not replayed.

| File | origin/main | production-recovery | production-audit-cleanup |
| --- | --- | --- | --- |
| `.gitignore` | Same | Same | Different; review notes |
| `CENTRAL-DELIVERY-REPORT.md` | Current-only | Current-only | Current-only |
| `CHECKOUT-AUTH-PAYMENT-REPAIR-REPORT.md` | Current-only | Current-only | Current-only |
| `IMPLEMENTATION-PLAN.md` | Current-only | Current-only | Current-only |
| `IMPLEMENTATION-REPORT.md` | Current-only | Current-only | Current-only |
| `LEGAL-APPROVAL-CHECKLIST.md` | Current-only | Current-only | Current-only |
| `LEGAL-CORPORATE-IMPLEMENTATION-REPORT.md` | Current-only | Current-only | Current-only |
| `OFFICEBITES-PRODUCTION-CLEANUP-REPORT.md` | Absent both | Absent both | Missing locally |
| `OFFICEBITES-RECOVERY-RELEASE-REPORT.md` | Same | Same | Current-only |
| `OZOW-SETUP-REQUIREMENTS.md` | Current-only | Current-only | Current-only |
| `STAGING-READINESS-REPORT.md` | Current-only | Current-only | Current-only |
| `TEST-RESULTS.md` | Current-only | Current-only | Current-only |
| `checks/browser-harness.html` | Same | Same | Same |
| `checks/browser-harness.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `checks/checkout-browser.spec.mjs` | Current-only | Current-only | Current-only |
| `checks/checkout-database.mjs` | Current-only | Current-only | Current-only |
| `checks/checkout-repair-database.mjs` | Current-only | Current-only | Current-only |
| `checks/checkout-repair-staging.sql` | Current-only | Current-only | Current-only |
| `checks/checkout-repair.mjs` | Current-only | Current-only | Current-only |
| `checks/checkout-rules.mjs` | Current-only | Current-only | Current-only |
| `checks/checkout-staging.sql` | Current-only | Current-only | Current-only |
| `checks/delivery-origins-staging.sql` | Current-only | Current-only | Current-only |
| `checks/delivery-origins.mjs` | Current-only | Current-only | Current-only |
| `checks/delivery-policy-lock-holder.sql` | Current-only | Current-only | Current-only |
| `checks/delivery-policy-lock-staging.sql` | Current-only | Current-only | Current-only |
| `checks/fixtures/checkout-prerequisites.json` | Current-only | Current-only | Current-only |
| `checks/fixtures/checkout-repair-prerequisites.sql` | Current-only | Current-only | Current-only |
| `checks/launch-database.mjs` | Same | Same | Different; review notes |
| `checks/launch-frontend.mjs` | Same | Same | Different; review notes |
| `checks/legal-corporate-database.mjs` | Current-only | Current-only | Current-only |
| `checks/legal-corporate-disable.sql` | Current-only | Current-only | Current-only |
| `checks/legal-corporate-staging.sql` | Current-only | Current-only | Current-only |
| `checks/ozow-integration.mjs` | Current-only | Current-only | Current-only |
| `checks/ozow-staging.sql` | Current-only | Current-only | Current-only |
| `checks/ozow-subscription-database.mjs` | Current-only | Current-only | Current-only |
| `checks/payment-cors.mjs` | Current-only | Current-only | Current-only |
| `checks/production-browser.spec.mjs` | Absent both | Absent both | Missing locally |
| `checks/production-database.mjs` | Absent both | Absent both | Missing locally |
| `checks/production-runtime.mjs` | Absent both | Absent both | Missing locally |
| `checks/recovery-browser.spec.mjs` | Different; review notes | Different; review notes | Current-only |
| `checks/recovery-runtime.mjs` | Same | Same | Current-only |
| `checks/recovery-scope.mjs` | Different; review notes | Different; review notes | Current-only |
| `checks/verify-browser.mjs` | Different; review notes | Different; review notes | Different; review notes |
| `checks/verify-local.mjs` | Different; review notes | Different; review notes | Different; review notes |
| `checks/vite.browser.config.mjs` | Same | Same | Same |
| `deno.lock` | Current-only | Current-only | Current-only |
| `package-lock.json` | Same | Same | Same |
| `package.json` | Same | Same | Same |
| `playwright.config.mjs` | Different; review notes | Different; review notes | Different; review notes |
| `src/components/features/AccountRemoval.jsx` | Same | Same | Different; review notes |
| `src/components/features/CheckoutControls.jsx` | Current-only | Current-only | Current-only |
| `src/components/features/CommercialStatement.jsx` | Current-only | Current-only | Current-only |
| `src/components/features/MealFormModal.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/components/features/OrderCard.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/components/features/PayoutLedger.jsx` | Same | Same | Same |
| `src/components/features/TicketCard.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/components/features/VendorConsent.jsx` | Current-only | Current-only | Current-only |
| `src/components/features/VendorDeliveryOrigin.jsx` | Current-only | Current-only | Current-only |
| `src/components/forms/FileUpload.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/components/forms/TextField.jsx` | Same | Same | Same |
| `src/components/layout/LegalLinks.jsx` | Current-only | Current-only | Current-only |
| `src/components/ui/Avatar.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/components/ui/StatusBadge.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/context/LocationContext.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/context/NotificationContext.jsx` | Same | Same | Same |
| `src/hooks/useAsync.js` | Same | Same | Same |
| `src/hooks/useFinancialRevision.js` | Same | Same | Same |
| `src/hooks/useOperationalRefresh.js` | Same | Same | Same |
| `src/hooks/useRequestGuard.js` | Same | Same | Different; review notes |
| `src/layouts/AdminLayout.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/layouts/AuthLayout.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/layouts/CustomerLayout.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/layouts/PublicLayout.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/layouts/VendorLayout.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/admin/AdminChats.jsx` | Same | Same | Same |
| `src/pages/admin/AdminCustomers.jsx` | Same | Same | Different; review notes |
| `src/pages/admin/AdminOverview.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/admin/AdminPayments.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/admin/AdminReports.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/admin/AdminSupport.jsx` | Same | Same | Same |
| `src/pages/admin/AdminVendors.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/auth/Login.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/auth/Register.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/customer/BecomeVendor.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/customer/CategoryDetail.jsx` | Same | Same | Same |
| `src/pages/customer/Checkout.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/customer/FoodSearch.jsx` | Same | Same | Same |
| `src/pages/customer/OrderHistory.jsx` | Same | Same | Same |
| `src/pages/customer/OrderTracking.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/customer/PaymentUpload.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/customer/TicketConfirmation.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/customer/TrackOrder.jsx` | Same | Same | Same |
| `src/pages/customer/VendorProfile.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/pages/help/FAQPage.jsx` | Same | Same | Same |
| `src/pages/help/Guides.jsx` | Same | Same | Same |
| `src/pages/help/LegalDocument.jsx` | Current-only | Current-only | Current-only |
| `src/pages/help/SupportTickets.jsx` | Same | Same | Same |
| `src/pages/shared/CommercialWorkspace.jsx` | Current-only | Current-only | Current-only |
| `src/pages/vendor/VendorOrders.jsx` | Same | Same | Same |
| `src/pages/vendor/VendorOverview.jsx` | Same | Same | Same |
| `src/pages/vendor/VendorSettings.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/routes/AppRoutes.jsx` | Different; review notes | Different; review notes | Different; review notes |
| `src/routes/ProtectedRoute.jsx` | Same | Same | Different; review notes |
| `src/routes/routeComponents.js` | Different; review notes | Different; review notes | Different; review notes |
| `src/services/adminService.js` | Same | Same | Different; review notes |
| `src/services/api/mappers.js` | Different; review notes | Different; review notes | Different; review notes |
| `src/services/authService.js` | Different; review notes | Different; review notes | Different; review notes |
| `src/services/chatService.js` | Same | Same | Same |
| `src/services/checkoutService.js` | Current-only | Current-only | Current-only |
| `src/services/commercialService.js` | Current-only | Current-only | Current-only |
| `src/services/financialService.js` | Same | Same | Different; review notes |
| `src/services/foodService.js` | Same | Same | Same |
| `src/services/orderService.js` | Different; review notes | Different; review notes | Different; review notes |
| `src/services/paymentService.js` | Different; review notes | Different; review notes | Different; review notes |
| `src/services/supportService.js` | Same | Same | Same |
| `src/services/vendorService.js` | Different; review notes | Different; review notes | Different; review notes |
| `src/utils/authError.js` | Current-only | Current-only | Current-only |
| `src/utils/checkoutError.js` | Current-only | Current-only | Current-only |
| `src/utils/constants.js` | Different; review notes | Different; review notes | Different; review notes |
| `src/utils/coordinates.js` | Same | Same | Same |
| `src/utils/delivery.js` | Current-only | Current-only | Current-only |
| `src/utils/financialInvalidation.js` | Same | Same | Same |
| `src/utils/formatters.js` | Same | Same | Same |
| `src/utils/guest.js` | Same | Same | Same |
| `src/utils/mobile.js` | Current-only | Current-only | Current-only |
| `src/utils/orderState.js` | Current-only | Current-only | Current-only |
| `src/utils/persistentImage.js` | Current-only | Current-only | Current-only |
| `src/utils/subscriptionRules.js` | Current-only | Current-only | Current-only |
| `supabase/functions/_shared/ozow-handlers.ts` | Current-only | Current-only | Current-only |
| `supabase/functions/_shared/ozow-runtime.ts` | Current-only | Current-only | Current-only |
| `supabase/functions/_shared/ozow.ts` | Current-only | Current-only | Current-only |
| `supabase/functions/_shared/payment-origins.ts` | Current-only | Current-only | Current-only |
| `supabase/functions/ozow-initiate/index.ts` | Current-only | Current-only | Current-only |
| `supabase/functions/ozow-reconcile/index.ts` | Current-only | Current-only | Current-only |
| `supabase/functions/ozow-webhook/index.ts` | Current-only | Current-only | Current-only |
| `supabase/functions/payfast-initiate/index.ts` | Different; review notes | Different; review notes | Different; review notes |
| `supabase/migrations/20261008185732_production_audit_cleanup.sql` | Absent both | Absent both | Missing locally |
| `supabase/migrations/20261016074256_checkout_recovery_mobile_delivery_gateways.sql` | Current-only | Current-only | Current-only |
| `supabase/migrations/20261016081336_booking_mobile_validation.sql` | Current-only | Current-only | Current-only |
| `supabase/migrations/20261016083644_ozow_attempts_subscription_approval.sql` | Current-only | Current-only | Current-only |
| `supabase/migrations/20261016090258_central_hub_vendor_origin_approval.sql` | Current-only | Current-only | Current-only |
| `supabase/migrations/20261016091839_central_hub_display_name_encoding.sql` | Current-only | Current-only | Current-only |
| `supabase/migrations/20261016092359_delivery_unenforced_order_snapshots.sql` | Current-only | Current-only | Current-only |
| `supabase/migrations/20261016094201_legal_corporate_framework.sql` | Current-only | Current-only | Current-only |
| `supabase/migrations/20261016100142_commercial_reporting_contract_locks.sql` | Current-only | Current-only | Current-only |
| `supabase/migrations/20261016101707_repair_order_policy_helper_access.sql` | Current-only | Current-only | Current-only |
