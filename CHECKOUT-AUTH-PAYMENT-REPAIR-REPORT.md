# Checkout, authentication and payment-state repair

16 October 2026. Work on `feat/legal-vendor-corporate-acquisition`; preserve all existing uncommitted legal/corporate work and delivery migrations. Staging project: `eyhmarmekioovcjibcbr`. No production deployment, main push, payment initiation or historical record correction is authorized.

## Confirmed initial evidence

A synthetic authenticated customer running the nested orders/profiles/suborders/vendors/items SELECT in a rollback-only staging transaction fails with SQLSTATE `42501`: `permission denied for function vendor_can_see_order`. The orders RLS policy calls that function, but authenticated lacks EXECUTE. All related table SELECT grants do exist. This is a helper grant failure, not evidence that all customer rows need exposing. RLS must remain enabled.

The frontend RPC argument names and `mealId`/`qty` mapping match the current staging signature. Core creates unpaid, pending-payment rows; delivery enforcement is off. Frontend and core currently agree on 19:00 SAST the previous day. The requested 09:00 delivery-day rule is a conflicting business-rule change; confirmation and boundary tests are required before altering it.

The exact affected Vercel URL and redacted response bodies for the two reported 400s have been requested. Invalid credentials, unavailable meals, expired cutoffs and malformed requests can legitimately return 400; no specific customer's login/checkout failure is yet established from status codes alone.

## Environment and deployment distinction

Remote reconfirmed: `https://github.com/Siphamandla1998/officebites.git`. Current HEAD remains `abebf8a7de14984e61a183b1fc257eba31a53811`; the earlier uncommitted legal/corporate framework remains preserved. No local commit or push was made.

The supplied Vercel preview `https://officebites-n7cs82zjg-sp24tg-6983s-projects.vercel.app/` is READY, preview target, built from `8d4daed77583975aa834d2627dd38118465d0650` on `feat/checkout-ozow-distance-admin-controls`. It does not contain the later local delivery/legal/frontend repair changes. No Vercel deployment was created by this repair.

The preview was opened in a fresh signed-out Edge browser. It rendered OfficeBites with HTTP 200 and fetched its catalogue from staging. Mutating Supabase requests were blocked during this observation; none were attempted. Some copied catalogue image URLs reference public live Storage objects; these were read-only media GETs, not live Auth/Database requests. No signed-in browser failure is claimed reproduced from that signed-out visit.

`.env.staging.local` was verified to target `eyhmarmekioovcjibcbr` and contain a public publishable key. Values were not printed. The preserved default `.env.local` still targets live: use **`npm run dev -- --mode staging --host 127.0.0.1 --port 5173 --strictPort`** for local staging verification. Build checks explicitly used `--mode staging`. No environment file or secret was changed.

## Root causes and safe diagnostic evidence

| Reported symptom | Evidence and conclusion | Repair/status |
| --- | --- | --- |
| Authenticated orders 403 | Native staging nested SELECT reproduced `42501`, `permission denied for function vendor_can_see_order`. Policy dependency lacked EXECUTE; table grants were not the missing permission. | Narrow authenticated helper grant, empty search path, active vendor ownership helper. Unrelated-customer and vendor suborder isolation verified. Anonymous execution remains denied. |
| Checkout 400: Active approved vendor required for fulfilment | Two approved vendor rows have **NULL owner_id**, so their Profile/Auth joins fail. Five of six available meals belonged to these vendors. Native synthetic ownerless-vendor checkout reproduced the exact message and SQLSTATE `P0001`. The existing insert guard is correct. The original cart payload was not supplied, so this does not establish which specific meal was submitted by the user. | Align catalogue visibility with the guard; customer catalogue/nearby results exclude unfulfillable vendors. Preserve the actual guard and all existing vendor/order rows. Do not invent owner/Auth records. Show actionable cart errors for stale saved items. |
| Login 400 | A nonexistent synthetic staging login returned actual HTTP 400, `invalid_credentials`, `Invalid login credentials`. This is expected authentication rejection. The original customer's code/body was not supplied. | Preserve the distinction between invalid credentials, unconfirmed email, session expiry and transient failure. Do not reset passwords or claim the reported login bug resolved. SDK restoration now propagates refresh errors safely. |
| Other checkout 400s | Anonymous invalid-input HTTP test returned `P0001`, `Guest name is required`, details/hint null. Seven frontend RPC names match the installed signature; items are `{mealId, qty}`. | Client errors now map known validation failures to safe instructions and unexpected/ambiguous errors to check history before retrying, without SQL details. Preflight rejects mismatched SDK/UI identity or failed user verification before sending create RPC. |
| Admin Completed in a payment list | getRecentPayments copied a fulfilment status from a financial suborder row into the payment badge. That also used meal-only gross as a payment amount and could treat missing receipt evidence as verified payment. Actual staging has one legitimately paid/completed suborder and zero inconsistent completed orders; no data corruption was proven. | Payment lists require a single provider COMPLETE receipt that reconciles to the recorded order total, show **Paid**, include delivery, and label date-only evidence as a date. Unresolved/duplicate receipts remain in financial reports, not falsely advertised as verified payments. |
| Waiting for vendor approval | No such literal exists in current local source or the inspected preview commit's order/ticket pages. Its exact screen/session state was not captured. | Payment messaging is now derived from stored suborder payment state. Vendor acceptance is shown only after paid status; unknown/partial payment cannot enable whole-order retry. Completion requires paid, completed child orders; inconsistent paid-phase statuses display review. The user's exact original screen remains unreproduced. |
| Foreign-origin blob blocked in vendor admin | Read-only staging metadata found one persisted vendor logo beginning `blob:`. Admin Avatar rendered the stored value directly; vendor profile update accepted arbitrary logo/cover strings. Temporary previews also lacked URL cleanup. | Filter persistent image sources, reject temporary URL saves in service and database triggers, and revoke locally created object URLs on replacement/unmount. Preserve the old broken value; a legitimate image must be re-uploaded by the authorised vendor/admin. |
| Additional payment blocker: CORS | OPTIONS on staging payfast-initiate returned another preview's Allow-Origin for both the supplied preview and localhost. HTTP 200 alone did not mean the browser would allow initiation. | Staging-only exact-origin addition deployed and preflight verified. No wildcard Vercel allowance, production configuration change or actual payment initiation. |

Diagnostics recorded only project reference, authentication state/role, status/code, safe validation messages, argument names and synthetic shapes. No passwords, tokens, authorization headers, private contact data or real order payloads are recorded here. The original unprovided login response cannot be inferred from HTTP status alone. See [PostgREST error mapping](https://supabase.com/docs/guides/api/rest/postgrest-error-codes).

## Database and Edge changes actually applied to staging

Source migration: `supabase/migrations/20261016101707_repair_order_policy_helper_access.sql`.
Installed staging migration version: **`20261016103515`**.

It repairs the orders policy helper's authenticated execution, adds an RPC-only private orderability predicate and restrictive vendor SELECT policies (public orderable catalogue; owner/admin access retained), preserves CENTRAL/approved VENDOR discovery calculations while checking Auth identity, and rejects new blob/data/javascript image values. Existing blob rows are not rewritten and unrelated edits remain possible. No RLS was disabled, table-wide customer access granted, previous migration replayed or financial/delivery snapshot rewritten.

`payfast-initiate` was inspected before deployment and reconciled against its deployed staging version. Deployed expiry-token rejection and active-profile checks were absent from the local branch and were preserved explicitly. Ownership, guest proof, vendor lifecycle, payment controls, outstanding attempts and cancellation serialization remain enforced by the locked `prepare_payfast_order` RPC. Configuration is checked before recording an attempt, avoiding an issued attempt merely because configuration is missing.

Staging **payfast-initiate v19** deployed with `verify_jwt=false`, matching its previous setting; it performs its own authenticated-user/active-account checks and requires server-validated guest proof. Uploaded files: `payfast-initiate/index.ts`, unchanged `_shared/payfast.ts`, new `_shared/payment-origins.ts`. The signature helper was compared against the captured deployed helper and matched after line-ending normalization, including special-character encoding. No PayFast notify or Ozow function was deployed.

The additional allowlist applies only when SUPABASE_URL is exactly the staging project's HTTPS hostname. It adds the supplied preview and `http://127.0.0.1:5173`. Production retains its configured list. A different preview URL needs a reviewed explicit entry; wildcard preview origins remain disallowed.

Actual post-deployment OPTIONS results: supplied preview 200 with matching Allow-Origin; local origin 200 with matching Allow-Origin; unrelated preview 200 with a nonmatching Allow-Origin (browser denied). These calls do not create payment attempts or contact PayFast. Real return/cancel fields were tested only in a mocked handler, not by issuing a payment form against existing orders.

## Payment and fulfilment trace

- Core order creation remains pending_payment / unpaid. Frontend redirects, ticket creation, approved storefronts and admin list rendering cannot confirm payment.
- PayFast initiation uses authenticated identity or ticket-linked guest contact; authoritative total/preparation are server-side. Signed form POST, return/cancel navigation and the ITN endpoint remain distinct. The unchanged notification handler validates the PayFast signature and validation response before server-only confirmation. No confirmation is performed by a browser return URL.
- Native tests use the service-only confirmation RPC with synthetic evidence inside rollback, then progress each vendor independently through accepted/preparing/ready/collected/completed. The first vendor cannot complete the aggregate order while the second remains confirmed. Skipping directly to completion and progressing an unpaid order are rejected.
- Recent verified-payment lists now distinguish payment from fulfilment and exclude unresolved/duplicate/missing provider receipts rather than treating a completed sale row as payment proof. They are a reconciled business-payment summary, not a complete gateway-log or refund report; existing financial reports retain unresolved history.
- Payment retry requires a pending-payment parent and wholly unpaid suborders, refreshes before initiation, and still relies on server preparation/reconciliation. Partial/unknown/verifying/paid/cancelled orders cannot trigger another whole-order payment from these controls. Bank debits without a callback require reconciliation, not an automatic second payment.
- Ozow remains disabled/not-ready. Its initiation, webhook signature/delivery deduplication, receipt reconciliation and disabled flags are covered by existing mocked/native tests; no real OAuth/gateway exchange occurred.
- Manual EFT is a legacy stored method, not an enabled checkout/upload confirmation flow. No manual proof upload or admin assertion was introduced as payment evidence. Manual settlement must not be fabricated to unblock these orders.
- Existing fulfilment and financial transition guards remain authoritative. No historical order was marked paid/completed, reclassified or otherwise corrected to conceal a display error.

## Files changed in this repair

Earlier uncommitted legal/corporate files remain preserved; overlap with authService, browser harnesses and regression runners was reconciled.

```text
src/services/authService.js
src/services/orderService.js
src/services/vendorService.js
src/services/api/mappers.js
src/pages/auth/Login.jsx
src/pages/admin/AdminOverview.jsx
src/pages/admin/AdminPayments.jsx
src/pages/customer/OrderTracking.jsx
src/pages/customer/PaymentUpload.jsx
src/pages/customer/TicketConfirmation.jsx
src/components/features/MealFormModal.jsx
src/components/features/OrderCard.jsx
src/components/features/TicketCard.jsx
src/components/forms/FileUpload.jsx
src/components/ui/Avatar.jsx
src/components/ui/StatusBadge.jsx
src/utils/authError.js (new)
src/utils/checkoutError.js (new)
src/utils/orderState.js (new)
src/utils/persistentImage.js (new)
supabase/functions/payfast-initiate/index.ts
supabase/functions/_shared/payment-origins.ts (new)
supabase/migrations/20261016101707_repair_order_policy_helper_access.sql (new)
checks/checkout-repair.mjs (new)
checks/checkout-repair-database.mjs (new)
checks/checkout-repair-staging.sql (new)
checks/payment-cors.mjs (new)
checks/fixtures/checkout-repair-prerequisites.sql (new, isolated schema fixture only)
checks/browser-harness.jsx
checks/checkout-browser.spec.mjs
checks/checkout-database.mjs
checks/recovery-scope.mjs
checks/verify-local.mjs
CHECKOUT-AUTH-PAYMENT-REPAIR-REPORT.md (new)
```

The existing financial/security migration sources, PayFast notify/signature implementation, Checkout.jsx calendar-date correction, orderRules cutoff logic, CENTRAL migration history, package/lockfiles and Vite/PWA configuration remain unchanged. The recovery scope test now explicitly allows the requested AdminOverview payment-label correction while retaining its other protected boundaries and fee arithmetic checks.

## Verification results

- Final full `node checks/verify-local.mjs`: **passed**, including the final CORS/auth-guard reconciliation. Includes original auth/order/date/support/financial/delivery/legal regressions, plus 20 isolated repair database assertions, 66 service/state/image/auth assertions and 25 payment-origin assertions. The older isolated baseline lacked the deployed policy helper and fulfilment insert guard; its repair fixture now reconstructs those prerequisites. Hosted tests use the actual schema, not that simulation.
- Final focused `node checks/checkout-repair.mjs`: **66 assertions passed**, covering actual service code with SDK stubs, including invalid login, session restoration/refresh rejection, suspended profile, logout, stale checkout identity, exact RPC shape, safe errors, paid versus completed, mixed vendor states, image rejection and receipt-backed payment totals. These are not actual successful password logins.
- `node --experimental-strip-types checks/payment-cors.mjs`: **25 assertions passed** against the actual Edge handler with mocked RPC/signing. Exact staging origins/return/cancel URLs, production isolation, foreign preview denial, expired token/suspended account/configuration failures before preparation; no gateway network calls.
- Native staging repair suite: **18 assertions passed**. Original suites also passed: checkout 12, Ozow/subscription 16, delivery origin 24, legal/corporate 22. **92 native assertions total**, using synthetic accounts/orders in rollback transactions. No fixture remains committed.
- Browser: **30 full-suite tests passed**, then **6 affected-flow tests passed** after the final status guard tightening. Covers unpaid inconsistent completion, Paid-only admin receipt badge and delivery-inclusive amount, foreign-origin blob suppression, checkout/guest validation, gateway controls, route/account races, refresh recovery, CSV and date rules. Most are isolated app/SDK fixtures with hosted writes blocked; the signed-out hosted-data smoke check is distinct.
- Production build with `--mode staging`: passed; PWA generated with **122 precache entries**. No claim of frontend deployment or installed-PWA update verification.
- Targeted lint on all **36 changed/new frontend source files**, including preserved earlier legal work: passed, zero warnings/errors. Deno checks on all six Edge entrypoints passed; changed initiation was rechecked after reconciling deployed guards.
- Read-only post-repair REST: staging public publishable configuration verified; anonymous catalogue sees one approved/orderable vendor and one available meal; anonymous orders SELECT remains denied, HTTP 401 / `42501`.
- Read-only post-test data: original suborder counts still **6 unpaid pending, 3 paid confirmed, 1 paid completed**; zero inconsistent completed orders. Two ownerless vendor rows and the single old blob logo remain stored. No synthetic repair Auth account remains.
- Security advisors: existing 24 private RLS-without-policy INFO notices; 7 anonymous SECURITY DEFINER warnings; authenticated count increases from 39 to **40** because the existing policy-required helper is now executable. Its result is limited to current active vendor ownership, not arbitrary order data. Existing leaked-password-protection warning remains unchanged. See [function exposure advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- `git diff --check` and whitespace inspection of newly added files: passed. Existing unchanged lines are not rewritten merely to normalize their whitespace. Protected source checks passed: notification/signature implementation, historical financial/security migrations, account removal, date rules and PWA configuration remain intact.

## Remaining decisions, access limits and payment readiness

**Staging is not cleared for real-money testing.** Compilation, mocked callbacks, rollback SQL and CORS preflight do not establish actual merchant readiness, bank processing or completed PayFast ITN delivery. No real payment, actual initiation for an existing order, payout, refund, customer message or account deletion was performed.

The original valid-account login 400 still needs its redacted Auth error code/body and browser interaction with credentials entered directly in the browser. The exact reported Waiting for vendor approval screen/session has not been reproduced. Successful authenticated browser password login and real authenticated REST order-history access were not claimed; actual native RLS access and mocked UI/session recovery passed separately.

The 09:00 SAST delivery-day cutoff remains an unanswered business-rule clarification. Current frontend/database both enforce 19:00 the previous day, and existing boundary tests pass. This checkout error does not justify silently changing the cutoff. No cutoff migration was applied.

Existing ownerless staging vendors cannot be used for fulfilment or payment preparation until an administrator supplies/verifies legitimate ownership. No missing user/Profile/Auth record was created for them. The old broken logo needs an authorised real image upload; its object URL cannot be recovered across browser origins.

The existing preview still serves the older frontend commit; local status, image and authentication-display fixes need a separately reviewed preview deployment before claiming them as deployed browser behaviour. Only the explicitly reported staging database/Edge changes are installed. No source was committed/pushed, no main merge or production deployment occurred, and live Supabase was not mutated.

Delivery enforcement, corporate billing and retention purging remain disabled; Ozow remains disabled. Keep real-money testing blocked until the repaired frontend is reviewed in staging, the intended cutoff is confirmed, designated accounts pass actual browser login/refresh/history/checkout, and gateway sandbox/ITN verification is complete.
