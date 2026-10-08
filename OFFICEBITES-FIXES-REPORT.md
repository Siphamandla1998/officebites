# OfficeBites prepared fixes review

Follow-up launch implementation: see [OFFICEBITES-LAUNCH-IMPLEMENTATION.md](OFFICEBITES-LAUNCH-IMPLEMENTATION.md). It documents later local ledger, security, report, request-state and PWA changes. Earlier package/browser notes below remain historical; the new migrations and removal function are not deployed to live.

Reviewed and applied locally on 8 October 2026.

Current status: all eight prepared packages have now been reviewed and reconciled locally. The additional packages were initially missing but are now applied; see the completed additional reconciliation below. All changes remain uncommitted and undeployed.

Local browser preparation is now complete: `.env.local` contains the two expected frontend variables using the live project URL and a public publishable key, and the dev server is running at http://127.0.0.1:5173/. See the local browser verification section below for actual results and pending manual checks.

User-reported browser results: customer, admin, and vendor login passed. Logout, refresh/session persistence, and the remaining interactive flows are not covered by that confirmation. See the designated-test-account verification section below.

Remote: `https://github.com/Siphamandla1998/officebites.git`.
Branch: `fix/qa-pass-payments-chat-pwa`.
Starting HEAD: `485ea3db0d1846aa8a178077e8401369fcbf7d59`.
The starting working tree was clean. No commit, push, deployment, SQL migration execution, or backend setting change was performed.

## Packages and reconciliation

All five extracted packages were inspected and all four available READMEs were read. The live inspection's INSPECTION.md, manifest, supplied checks, replacement diffs, and database contract definitions were reviewed. Every manifest file passed its SHA-256 check before application.

| Package | Decision |
| --- | --- |
| OfficeBites_Live_Inspection_Fixes_2026-10-07 | Applied missing frontend fixes against the exact documented baseline. Added the recorded migration as a local history file only. Added the supplied order regression check. |
| OfficeBites_Auth_Session_Fix | Applied request-version/mount guards and added its auth regression check. Kept the newer deferred auth callback and suspended-profile check from the inspection package. |
| OfficeBites_AuthService_Fix | No README is present. Its service file already matches the starting repository; skipped the redundant replacement and preserved the inspection improvements. |
| OfficeBites_Payment_Recovery | OrderTracking and paymentService recovery behavior already match the starting repository. PaymentUpload differs only by the final newline; left it unchanged. Reconciled the inspection package's fulfilment polling and optional commission rate with existing recovery behavior. Did not apply the alternative patch twice. |
| officebites-payfast-initiate-v17 | Initiation code already matches. Skipped the shared helper replacement because it would remove the repository's newer encoding of special characters in PayFast signatures. No Edge Function or configuration files changed. |

Two small reconciliation corrections accompany the replacements: chat send handlers reject closed conversations even when triggered by Enter; checkout sends the displayed delivery calendar date and asks the customer to review it if its cutoff has passed, rather than silently submitting a different date. Existing PayFast-only checkout, verified guest access, signed form POST, and server-only payment confirmation remain intact.

## Changed files

37 application/check/history files changed or added, plus this report. Newly added files are marked `(new)`.

```text
src/App.jsx
src/components/features/FoodCard.jsx
src/components/features/VendorCard.jsx
src/context/AuthContext.jsx
src/context/CartContext.jsx
src/context/FavouriteContext.jsx (new)
src/context/NotificationContext.jsx
src/hooks/useAsync.js
src/hooks/useLiveRefresh.js (new)
src/layouts/CustomerLayout.jsx
src/pages/customer/ChatList.jsx
src/pages/customer/Checkout.jsx
src/pages/customer/Favourites.jsx
src/pages/customer/FoodDetails.jsx
src/pages/customer/OrderTracking.jsx
src/pages/customer/TicketConfirmation.jsx
src/pages/customer/VendorListing.jsx
src/pages/customer/VendorProfile.jsx
src/pages/help/GuideDetail.jsx
src/pages/shared/ChatConversation.jsx
src/pages/vendor/VendorChat.jsx
src/pages/vendor/VendorInsights.jsx
src/pages/vendor/VendorMenu.jsx
src/pages/vendor/VendorOrders.jsx
src/pages/vendor/VendorRevenue.jsx
src/pages/vendor/VendorSettings.jsx
src/services/api/mappers.js
src/services/authService.js
src/services/chatService.js
src/services/paymentService.js
src/services/vendorService.js
src/utils/constants.js
src/utils/orderRules.js
public/placeholder-food.svg (new)
checks/auth-race.cjs (new)
checks/order-rules.mjs (new)
supabase/migrations/20261007141325_harden_live_order_and_chat_permissions.sql (new, history only)
```

package.json, package-lock.json, environment configuration, Vite/PWA configuration, and all Edge Functions are unchanged.

## Validation

- `node checks/auth-race.cjs`: passed both sign-out and out-of-order account-switch scenarios. These use hook/service stubs, not a browser renderer.
- `node checks/order-rules.mjs`: passed nine assertions in each of UTC, Africa/Johannesburg, America/Los_Angeles, and Asia/Tokyo; 36 assertions total.
- `npm ci --no-audit --no-fund`: passed using the existing lockfile; 438 packages installed. Node was absent from PATH, so a checksum-verified portable Node 22.23.3 / npm 10.9.9 runtime was placed in the temporary directory. No global installation or persistent PATH edit was made.
- `npm run build`: passed; Vite 8.1.5 production bundle and PWA service worker generated, with 103 precache entries. The first sandbox build was blocked by `spawn EPERM`; the authorized run outside the sandbox passed.
- `npm run lint -- <all 33 changed/new source files>`: exit 0, zero errors, six warnings. Fast Refresh export warnings occur in AuthContext, CartContext, NotificationContext, and FavouriteContext. AuthContext also has a ref-cleanup warning; useAsync has the variable dependency-array warning. The cleanup ref is a request-version counter, not a DOM node.
- `git diff --check`: passed after removing redundant trailing blank lines from the supplied files.
- Read-only live Supabase SELECT checks on `gfzhdkitdyqftealgqfi`: confirmed favourites `(profile_id, meal_id)` primary key, vendor commission/corporate fields, profile suspended flag, message/notification columns, existing checkout/guest-tracking/vendor-progression/payment-confirmation RPC signatures, and messages/notifications Realtime publication. Confirmed authenticated UPDATE access is restricted to suborder notes, message read, and notification read/dismissed flags. Frontend writes and RPC arguments remain compatible with these contracts.
- Live migration history contains `20261007141325`; the copied file was not executed.

## Skipped checks and unresolved issues

- `verify_live.sql` was not executed: it creates database fixtures and simulates payment confirmations on live inside a rollback transaction. Backend verification here used read-only metadata queries. Installation and rollback SQL were not executed. The payment package mentions 12 mocked checks, but does not include their runnable scripts; those historical results were not claimed as rerun.
- Authenticated browser flows, installed-PWA refresh, two-account chat delivery, password-reset email delivery, uploads, and a real PayFast payment/ITN were not verified. This checkout has no local VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY configured; the build therefore verifies compilation, not live browser connectivity. Existing environment configuration was preserved.
- The packages' historical PayFast merchant enablement/external 500 issue remains unverified and cannot be resolved by these frontend replacements. Retry UI cannot guarantee protection against simultaneous payment attempts or delayed ITNs across tabs.
- The inspection package also records unfinished payouts, customer display-name visibility under profile RLS, disabled reviews, unverified conversation retention scheduling, older migration-history divergence, and disabled leaked-password protection. Their current operational status was not re-audited or changed in this frontend pass.
- Six lint warnings remain as detailed above. Dependency installation emitted existing transitive deprecation warnings for glob and source-map; dependency upgrades were outside this fix set.

Supabase auth callback behavior was checked against the [official onAuthStateChange documentation](https://supabase.com/docs/reference/javascript/auth-onauthstatechange); the service keeps profile requests outside the auth callback's lock.

## Additional package review — 8 October 2026 (initial attempt)

This historical attempt is superseded by the completed reconciliation below.

The remote and branch were reconfirmed. All earlier local changes were preserved; this follow-up changed only this report. The checkout displayed-calendar-date/cutoff correction and newer PayFast signature encoding remain intact.

### Missing packages

None of these packages exists in `C:\Users\Siphamandla.Khumalo\Documents\OfficeBites-Fixes`:

- `OfficeBites_Customer_Names_Fix`
- `OfficeBites_Support_Feedback_Fixes`
- `OfficeBites_Catalogue_Search_Date_Fixes`

A recursive search of Documents, Downloads, and Desktop found no matching folders or archives. Their READMEs, replacement files, migration history files, and supplied checks could therefore not be reviewed or applied. Their local location was requested. No replacement implementation was guessed in their absence.

### Live backend verification and frontend gaps

Read-only SELECT queries on live project `gfzhdkitdyqftealgqfi` confirm:

- Migration `20261007152430`, `scoped_order_customer_names`, is recorded.
- Migration `20261007153218`, `support_atomic_create_and_feedback`, is recorded.
- `get_order_customer_names(p_order_ids uuid[])` returns `TABLE(order_id uuid, customer_name text)` and is executable by authenticated users, not anon. Its public wrapper delegates to `private.order_customer_names`.
- `create_support_ticket(p_subject text, p_category text, p_body text, p_requester_name text, p_requester_email text, p_requester_contact text, p_order_id uuid DEFAULT NULL, p_meta jsonb DEFAULT '{}', p_attachment_path text DEFAULT NULL)` returns JSONB and is executable by authenticated users, not anon. Its definition creates the ticket and initial message atomically, validates subject/body lengths and requester attachment path, and returns the ticket with `support_ticket_messages`.
- Existing admin RPCs match the current frontend arguments: `admin_reply_support_ticket(p_ticket_id uuid, p_body text, p_internal boolean DEFAULT false)` returns UUID; `admin_update_support_ticket(p_ticket_id uuid, p_status support_status DEFAULT NULL, p_priority support_priority DEFAULT NULL, p_assigned_to uuid DEFAULT NULL)` returns JSONB.
- Feedback INSERT permits anon/authenticated callers with user_id matching auth.uid(); its SELECT policy permits only authenticated owners/admins.

No missing backend migration or RPC was detected. Exact agreement with the absent packages cannot be certified. Current frontend gaps remain: source code does not call either `get_order_customer_names` or `create_support_ticket`; support creation still performs separate ticket/message inserts; guest feedback uses `.insert(...).select().single()`, requesting a returned row without an applicable anonymous SELECT policy. The catalogue package's intended changes are unknown until its files are available.

### Validation rerun

- Existing auth checks: both scenarios passed.
- Existing order/date/commission checks: all 36 assertions passed across UTC, Africa/Johannesburg, America/Los_Angeles, and Asia/Tokyo.
- Production build: passed, including PWA generation.
- Lint on all 33 earlier changed/new source files: passed with zero errors and the same six warnings.
- `git diff --check`: passed.
- Additional supplied checks: unavailable because all three packages are missing.

No migrations were executed, backend settings changed, commits created, pushes made, or deployments performed. Package reconciliation remains incomplete pending the missing files.

## Completed additional reconciliation — 8 October 2026

All three additional packages are now present under OfficeBites-Fixes. Their READMEs, manifests, supplied checks, replacement diffs, and history migrations were reviewed. All ten replacement-file SHA-256 hashes match their manifests. No package remains missing.

### Applied fixes and preservation

- Customer names: added the batched `get_order_customer_names` client and integrated it into vendor orders and customer/vendor conversation lists, details, and newly opened threads. Genuine guest order names and fallback display behavior remain available; chronological message mapping is preserved.
- Support/feedback: switched ticket creation to the existing atomic `create_support_ticket` RPC, validates subject/body before upload, and removes a newly uploaded attachment only after a definite SQL rejection. Guest/member feedback inserts no longer request SELECT; rating/comment constraints match live. Ticket filters and badges use the live statuses; replies disable while sending and on resolved/closed tickets, and failures show a toast. Existing admin RPC methods remain intact.
- Catalogue: added escaped/quoted search values for meal/vendor OR filters and a date-only weekday helper that keeps Date objects on the existing local-calendar convention. The [official PostgREST URL grammar](https://docs.postgrest.org/en/v16/references/api/url_grammar.html) confirms the required quoting and escaping. Previously applied paid-only vendor sales calculations remain intact.
- Added both already-applied migrations as local source-history files only. No SQL was executed from the packages, including installation, rollback, or fixture verification scripts.
- Pre-edit hash snapshots confirm that only the eight existing files targeted by the new packages changed during this pass. Checkout.jsx, the PayFast signature helper, all other earlier modified/new files, package files, and environment configuration are unchanged. Redundant final blank lines were removed from replacements; source line endings were normalized for clean diffs.

### Files changed or added in this pass

```text
src/services/chatService.js (extended earlier changes)
src/services/customerNameService.js (new)
src/services/orderService.js
src/components/ui/StatusBadge.jsx
src/pages/help/Feedback.jsx
src/pages/help/SupportTickets.jsx
src/services/supportService.js
src/services/foodService.js
src/services/vendorService.js (extended earlier changes)
src/utils/catalogueFilters.js (new)
checks/support-service.mjs (new)
checks/catalogue-filters.mjs (new)
supabase/migrations/20261007152430_scoped_order_customer_names.sql (new, history only)
supabase/migrations/20261007153218_support_atomic_create_and_feedback.sql (new, history only)
OFFICEBITES-FIXES-REPORT.md (updated)
```

The combined working tree contains 49 changed/new application, check, and history files, plus this report; 41 source files are included in targeted lint.

### Read-only live compatibility results

Both expected migration IDs were reconfirmed in live history. The public name RPC accepts `p_order_ids uuid[]`, returns order ID/name rows, uses invoker rights, and permits authenticated execution only. Its private helper matches the package's active-account checks, 200-order limit, and scoped customer/admin/approved-vendor ownership rules.

The support creation RPC's nine parameter names, types, defaults, JSONB return type, invoker rights, and authenticated-only execution match the replacement's request. Existing admin support RPC signatures remain compatible. Live support statuses are `open`, `waiting_customer`, `in_progress`, `resolved`, and `closed`.

Feedback has RLS enabled, rating 1–5 and comment length <=5000 constraints, and INSERT grants for exactly the replacement's five fields for anon/authenticated users. Its ownership INSERT and authenticated-owner/admin SELECT policies match the new insert-only request. No backend mismatch was detected in the inspected contracts. The frontend gaps recorded in the initial attempt (unused name/atomic-support RPCs and guest feedback SELECT) are addressed by this pass.

### Final validation

- `node checks/support-service.mjs`: seven mocked service checks passed, including atomic request mapping, initial-message payload, validation before upload, guest/member feedback, invalid rating, definite-rejection cleanup, and ambiguous-network retention.
- `node checks/catalogue-filters.mjs`: six assertions in each of four timezones; 24 passed.
- `node checks/auth-race.cjs`: both scenarios passed.
- `node checks/order-rules.mjs`: nine assertions in each of four timezones; 36 passed.
- Timezones: UTC, Africa/Johannesburg, America/Los_Angeles, Asia/Tokyo.
- `npm run build`: passed, including PWA service worker generation with 105 precache entries. The existing portable runtime and installed locked dependencies were reused.
- `npm run lint -- <all 41 changed/new source files>`: passed with zero errors and the same six earlier warnings; no additional warnings from the new replacements.
- `git diff --check`: passed after final source normalization and report edits.

### Remaining limits and skipped work

The supplied `verify_names.sql`, `verify_support.sql`, and `verify_menu.sql` create fixtures or simulate database operations; they were not run against live because backend verification for this task is read-only. No runnable customer-name JavaScript check is supplied. Database fixture results quoted in package READMEs were not claimed as rerun here.

Authenticated browser name display, support/customer/admin interactions, real attachment upload/download, live guest/member feedback submission, catalogue REST punctuation searches, installed-PWA refresh, and a real PayFast payment/ITN remain unverified end-to-end. Passing mocked checks and inspecting contracts does not establish those outcomes. An ambiguous support timeout can still require checking ticket history before retrying; the prepared fix does not add request-ID deduplication. The earlier payment/payout/retention and operational limits still apply, and six lint warnings remain.

No commit, push, deployment, migration execution, or backend setting change was performed.

## Local browser verification preparation — 8 October 2026

Configuration was located in `src/services/api/supabaseClient.js`. No environment file was initially present. Missing names were `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. An ignored `.env.local` was created containing the live project's URL and an enabled public publishable key retrieved through Supabase. No secret/service-role key is used, no credential values are recorded here, and no existing source changes were overwritten. This supersedes the earlier report's missing-local-configuration limitation.

The existing portable Node runtime was reused to run `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`. Vite reported ready; the server is listening only on the local machine at **http://127.0.0.1:5173/**.

### Checks actually performed

- Local HTTP GETs for /, /login, /food/search, /checkout, and /help/tickets returned 200 HTML; /src/App.jsx returned 200 JavaScript. These establish server/app-module delivery, not rendered browser correctness.
- Live public catalogue GETs using the configured public key returned 200 for both meals and vendors with each of Chicken, chicken comma rice, Chef (special), an embedded quoted phrase, and a backslash: ten successful read-only search requests.
- Git confirms .env.local is ignored. Source code, earlier fixes, Edge Functions, backend settings, and migrations were not changed in this preparation.
- No browser was automated, user credentials entered, authenticated flow exercised, payment started, order created, message sent/read, favourite changed, menu saved, suborder advanced, notification marked/dismissed, or support/feedback record submitted.

### Manual browser checklist

Use a normal browser window for the customer and a separate browser profile/private window for the vendor. Enter your credentials directly in the browser. Keep developer tools Console and Network open; report route, action, visible result, HTTP status, and redacted error text. Do not share passwords, keys, authorization headers, contact information, or session tokens.

1. **Customer login/logout/refresh:** open /login, sign in to your customer account, refresh /profile and confirm the same account remains signed in. Sign out, refresh, and confirm the account remains signed out. Repeat sign-in and check there are no stalled loading screens. These checks require your browser interaction; they were not performed here.
2. **Menu/search/favourites/cart/date:** open /food/search and try the punctuation searches above, then open a meal. View existing saved favourites at /favourites. Add a meal to the cart, change its quantity, refresh, and confirm the cart persists locally. Inspect /checkout without placing the order; the displayed delivery date should match the SAST cutoff rule (tomorrow before 19:00 SAST; the day after at/after 19:00). Saving/removing a favourite changes live data and remains pending explicit authorization.
3. **Unpaid-order recovery:** open an existing order that you are authorized to view at /orders/<orderId>, with no PayFast query parameter. A pending-payment order should offer retry guidance and payment navigation; a paid/terminal order should not offer another payment. You may view /payment/<orderId>, but do not click the button that initiates PayFast. Do not place a new order or start/complete payment in this pass.
4. **Vendor menu/progression:** sign in as the vendor in the separate window. Inspect /vendor/menu and /vendor/orders without saving changes. Paid suborders should expose only the next fulfilment action; unpaid ones should expose none. Menu edits/uploads/deletion and independent multi-vendor advancement require explicit authorization for dedicated existing test records. Multi-vendor progression also requires accounts owning each participating vendor; it cannot be established by inspecting one vendor.
5. **Chat/notifications:** inspect the chat list and existing notification list in both sessions. Leave conversation threads closed until read-flag changes are authorized: opening a thread calls markConversationRead. Sending messages, marking/dismissing notifications, and generating notification events remain pending explicit authorization for test accounts/conversations. Incoming delivery and synchronized flags cannot be claimed verified from list inspection.
6. **Support/feedback:** inspect /help/contact, /help/report, /help/tickets, and /help/feedback. Check the ticket status filter labels and form controls. Do not submit a ticket, reply, upload an attachment, or submit feedback until live test-record creation is explicitly authorized. After authorization, validate initial ticket/message creation together, public/internal admin replies using a test ticket, and guest/member feedback separately.

### Pending evidence and limits

All six authenticated/interactive stories require your interaction. Actual production-writing steps are deferred as specified above. The successful public GETs do not establish authenticated RLS behavior, full UI rendering, storage uploads, real-time delivery, or payment retry correctness end-to-end. The earlier regression/build/lint results remain recorded; those are distinct from browser validation.

## Designated-test-account verification — 8 October 2026

The user manually verified the following browser actions and reported them passed:

| Check | Result | Evidence |
| --- | --- | --- |
| Customer login | Passed | User's manual browser verification |
| Admin login | Passed | User's manual browser verification |
| Vendor login | Passed | User's manual browser verification |

These are user-reported results; the assistant did not perform or observe these login actions. Logout and refresh/session persistence remain pending.

The user authorized favourite changes, test chat exchanges, marking test-account notifications read, and clearly labelled test support tickets/feedback, conditional on identifying designated test accounts and records first. Account identifiers, a test conversation/linked test order, favourite meal scope, notification scope, and test submission label have been requested. No dependent live changes will be made until those identifiers are supplied. No test credentials or session values will be recorded here.

No browser-control tool or agent-browser executable is currently available to this session. Browser actions will require the user's interaction unless an appropriate automation capability becomes available; direct backend/API actions will be distinguished from browser verification. Real customer data remains outside the authorized test scope. Order progression, payment initiation, commits, pushes, and deployment remain excluded.

No commit, push, deployment, SQL migration execution, or backend setting change was performed.
