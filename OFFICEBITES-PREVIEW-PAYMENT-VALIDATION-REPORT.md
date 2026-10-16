# OfficeBites Preview payment validation

16 October 2026. Branch: `feat/legal-vendor-corporate-acquisition`. Repository: Siphamandla1998/officebites. Starting HEAD: `abebf8a7de14984e61a183b1fc257eba31a53811`.

## Scope and safety

The owner authorized committing/pushing this feature branch and creating a Vercel **Preview only**. All earlier local checkout, delivery, legal/corporate changes and reports were reviewed and preserved. No reset, merge, rebase or cherry-pick. Main is not pushed. The current 19:00 SAST previous-day cutoff, standard combined 17% (15% + 2%), historical snapshots and PayFast signature encoding remain intact.

Vercel team `team_kKRzCLk1pNHoIA4sV1M0ciSg`, project `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71` / officebites, GitHub connection Siphamandla1998/officebites. Owner reconfirmed Production Branch Tracking is **main**. The connector cannot independently read that setting. Only this feature branch may be pushed; deployment target must be Preview.

Preview frontend variables were inspected without printing values. Generic Preview URL points to staging **eyhmarmekioovcjibcbr**; its public publishable key matches an active staging key. No feature-branch override exists. Production/development variables were not copied or edited. Ignored `.env.local` still points to live and is preserved; all validation builds explicitly use `--mode staging`.

Production alias baseline: officebites.co.za points to `dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt` (`officebites-ms6sjgmw8-sp24tg-6983s-projects.vercel.app`). Existing metadata records commit `ee258d614e46eb3ae7a1957ffb11ff7a3c819180`, branch fix/backend-staging-completion. That historical deployment is not changed by confirming branch tracking; it must remain serving during this task.

## Included development work and final small fixes

Includes the previously reviewed authentication/profile guards, member/guest checkout identity/error handling, payment-vs-fulfilment state helpers and receipt-backed admin summaries, persistent image protections, legal version/consent/corporate disabled framework, three already-installed history migrations, regression scripts and implementation/audit/legal reports. Earlier delivery and Ozow/subscription commits are preserved in ancestry and are included when the feature branch is pushed.

Small changes made during Preview preparation:

- `src/pages/admin/AdminPayments.jsx`: receipt-report errors no longer hide independent gateway administration.
- `src/components/features/CheckoutControls.jsx`: successful saves display confirmation only after settings reload; gateway forms have distinct accessible names. Manual EFT is explicitly unavailable rather than presented as a working confirmation method.
- `src/pages/customer/PaymentUpload.jsx`: close the cancellation dialog before returning to the order, preventing it from intercepting actions when navigation immediately returns to payment.
- `checks/browser-harness.jsx` and `checks/checkout-browser.spec.mjs`: synthetic persisted gateway updates and independent toggles/save errors, including receipt-report failure. The existing cancellation test stresses rapid navigation without cancelling the order.

The Deno lockfile is a reviewed dependency lock, not a credential/runtime dump. Environment files, node_modules, dist, temporary runtimes, ignored local evidence, browser traces/screenshots and private-data fixtures are excluded. An explicit reviewed path list is used rather than blind git add -A; candidate scans reject private keys, secret Supabase keys, JWT literals, GitHub tokens and credential-bearing database URLs. This is a scoped scan, not a guarantee that all conceivable secrets can be recognized.

## Backend consistency and disabled gates

Staging source/history comparison and divergence are documented in OFFICEBITES-INTEGRATION-READINESS-REPORT.md. Recent timestamped migrations match installed history except the original CENTRAL display-name encoding, corrected by its separately installed forward repair. Staging has the older cleanup migration whose local source is absent; do not infer this branch is safe for blanket db push. No migration is applied in this Preview task.

At preparation, staging **payfast-initiate v19** and all three files match local source after line-ending normalization: index.ts, unchanged _shared/payfast.ts, _shared/payment-origins.ts. verify_jwt=false is intentional; own Auth/profile/guest verification and service-only preparation remain required. No gateway deployment is needed merely to publish frontend changes. Exact new Preview CORS/return-origin results are recorded after deployment below; old-preview acceptance does not establish new-preview acceptance.

Read-only staging controls: PayFast enabled/ready, no maintenance; Ozow disabled/not ready; delivery enforcement, pin/fee/readiness attestations, corporate acquisition, standard fee breakdown, onboarding enforcement and retention disabled. Published legal versions: zero. These settings were not activated by this task. PayFast enabled/ready does not prove merchant sandbox mode; do not initiate a payment without that separate verification.

## Ozow findings

Reviewed the actual One API adapter, secure server environment requirements and current official [request-payment contract](https://hub.ozow.com/api-reference/one-api/post-payments/) and [transaction status contract](https://hub.ozow.com/api-reference/one-api/get-transactions-id/). Hosted initiation uses payments scope, authoritative amount/reference, an HTTPS return origin and persisted attempts. Thin webhook verification uses signature/freshness plus authoritative transaction lookup and server deduplication. Browser return is navigation only. Pending/ambiguous attempts block blind retry; incomplete/error transaction status is not a guarantee that every related provider attempt is terminal.

The implementation is independently controlled from PayFast, server-credential-only, staging-restricted and hard gated. A genuine hosted redirect, success/failure/cancel return, merchant/client/site access, secrets, webhook subscription/signing sample and provider transaction lookup have **not** been verified. Ozow must stay disabled. Refund/settlement integration remains incomplete. Mocked success and rollback SQL are not a merchant integration pass.

## Gateway and checkout verification

The admin RPC saves each provider separately and enforces readiness server-side. Runtime reads drive payment buttons and periodic refresh; rebuilding the PWA is not required to toggle an already-ready gateway. PayFast preparation rechecks enabled/ready/maintenance under server authority; stale frontend state cannot authorize initiation. Verified notification processing is independent of new-initiation availability. Unpaid cancellation is distinct from bank cancellation/refund.

Manual EFT is not a supported checkout gateway in this release. Historical stored payment methods do not authorize proof upload or client/admin-declared paid status. No credential entry fields were added to the admin UI.

Actual hosted browser admin toggle persistence, designated-account order history, authenticated/guest order creation and sandbox redirects remain separate from fixture results. No existing production or staging customer order was used to create payment evidence. The user's earlier manual login pass is preserved; it predates the new Preview and cannot certify that deployment's session persistence.

## Validation before commit

- Full `checks/verify-local.mjs`: passed, including 103 isolated legal/corporate assertions, 66 checkout/auth/status/service assertions, 25 mocked CORS assertions, mocked Ozow integration and existing auth/date/financial/delivery regressions.
- Five native staging rollback suites: checkout 12, Ozow/subscription 16, delivery 24, repair 18, legal/corporate 22; **92 passed**. Temporary synthetic fixtures and test-only commercial constraint bypasses roll back. No persistent gate or financial change.
- Staging-mode production build: passed, 122 PWA precache entries. Repeated after the cancellation-dialog change.
- Targeted lint: 37 changed/new frontend sources passed, then affected sources/checks rechecked after the final dialog fix. All six Edge entrypoints passed Deno check using `--frozen --node-modules-dir=none`.
- Browser first run: **30 passed, 1 failed**, timeout because the cancellation dialog intercepted a later Cancel payment click during rapid route return. An isolated rerun passed, showing timing sensitivity; closing the dialog explicitly is the corrective change. The final full-run result is recorded below rather than concealing this failure.
- Final rebuilt Microsoft Edge browser suite after the dialog fix: **31 passed (3.9 minutes)**, including the independent gateway administration test. Synthetic services block hosted writes; the signed-out hosted read check is separate. This is not a hosted sandbox transaction pass.
- Whitespace checks pass; LF/CRLF Git notices are not errors. No credentials or private-data artifacts were included in the reviewed candidate inventory.

## Commit, push and deployment record

Development commit **6400b23a13d54220d0cb90ffe9fec28ecafe8b75** was pushed normally to origin/feat/legal-vendor-corporate-acquisition. GitHub branch readback matches; remote main remains 4c4835db62b7db4c7a725c92d7a6294ca523fa57. Automatic Git integration created Preview **dpl_5JCrMPqWRXcTGujJ1yhA3wwisFzF**, READY, exact commit 6400b23, at https://officebites-n1n4mjpp2-sp24tg-6983s-projects.vercel.app/. Build logs confirm completion and 122 PWA precache entries. Target is Preview (API target=null), not production.

Verified branch alias: **https://officebites-git-feat-legal-vendor-da31dd-sp24tg-6983s-projects.vercel.app/**. This is the intended payment-testing origin. The immutable deployment URL and branch alias initially both failed PayFast CORS (OPTIONS 200 but nonmatching Allow-Origin). That was a real broken boundary, not a successful preflight.

Necessary staging-only follow-up: added only the verified exact branch alias to _shared/payment-origins.ts and extended checks/payment-cors.mjs. **32 assertions passed**, including return/cancel URLs and exclusion from production. Deno frozen check passed. Deployed **staging payfast-initiate v20 ACTIVE**, retaining verify_jwt=false and identical index/signature source. All three deployed files match local after line-ending normalization. Actual OPTIONS from the branch alias now returns a matching Allow-Origin. No POST/preparation/provider request was made. Unknown/immutable Preview origins remain unapproved; use the verified branch alias for payment UI checks. No wildcard origins or production functions were changed.

The CORS follow-up was committed and pushed as **40974072a5899c96a2e422b175c3f214b9f56b01** (`fix: allow staging payments from verified feature preview`). Its final frontend deployment is **dpl_DGdhEnAsXG22FgmcUZcgGcArUrzW**, **READY**, Preview target, source Git, exact pushed branch HEAD. Immutable URL: **https://officebites-bh01fqzcj-sp24tg-6983s-projects.vercel.app/**. Vercel build logs confirm deployment completion. The verified branch alias above resolves to this final deployment and is the accepted payment CORS/return origin. The initial 6400b23 deployment remains historical evidence only.

OAuth/confirmation/password-reset redirect allowlists cannot be read or edited with the connected Supabase tools. The app currently uses password login (no signInWithOAuth call); reset email requests use the current origin/reset-password. Exact branch-origin/reset-password allowance and confirmation email delivery need dashboard verification before those email-based flows can be claimed. No Auth setting or redirect secret was changed.

## Final deployed Preview browser results

Fresh Microsoft Edge mobile context (390 x 844), no saved credentials. Production Supabase requests and hosted mutation endpoints were blocked by the test harness. Pages were fetched from the verified final branch alias, not the older preview. Actual response host was only eyhmarmekioovcjibcbr.supabase.co.

| Journey/check | Result | Evidence and limit |
| --- | --- | --- |
| /login | Passed, signed-out rendering | HTTP 200, visible password form; no credentials submitted |
| Signed-out refresh | Passed | Login form remains visible after actual page reload; not authenticated persistence |
| /food/search | Passed, public render/read | HTTP 200, actual staging meals GET 200; no overflow on inspected viewport |
| /checkout | Passed, empty-cart/read only | HTTP 200, empty-cart UI; focused follow-up read of get_delivery_settings returned 200 and enabled=false |
| /terms | Passed | HTTP 200, actual staging get_legal_portal 200 and unpublished notice; no legal version activated |
| /admin/payments and /vendor/orders | Passed, signed-out protection only | HTTP 200 app routing redirects to /login and displays password form; authenticated screens not tested here |
| Deployed bundle isolation | Passed | Compiled Supabase client contains staging URL/public publishable key, no live project URL; no values recorded |
| Latest frontend repair inclusion | Passed, static evidence | Deployed admin chunk contains Gateway settings saved and reloaded; Vercel SHA equals final pushed HEAD |
| PayFast branch-origin CORS | Passed | Actual OPTIONS returns matching Allow-Origin after staging v20; no initiation |
| Customer login and authenticated refresh/history | Blocked for assistant on new Preview | User's earlier manual login pass retained; no designated session/credentials available to automation |
| Admin PayFast ON/OFF/re-enable and persistence | Passed in synthetic browser/native permission checks; hosted UI untested | Final local browser suite proves independent save/refresh/error behaviour; staging setting was not persistently toggled |
| Ozow ON/OFF, provider redirect, supported return/cancel | Blocked for hosted provider test | Ozow remains not-ready/disabled; mocked browser/adapter tests are not actual provider success |
| Guest/member order submission and state transitions | Passed in native rollback, genuine browser blocked | Synthetic service-confirmed paid state remains distinct from sequential vendor fulfilment completion; no actual gateway evidence |
| Cancel/return/retry UI and status consistency | Passed in local browser regressions; hosted signed-in flow untested | Modal race fixed; return does not confirm payment; unknown/partial/paid states cannot trigger whole-order retry |
| Mobile navigation/render | Partial | Six signed-out routes render at mobile viewport without horizontal overflow; no physical-device or installed-PWA update test |

Hosted smoke setup failures are retained: first script inspected only the entry chunk and could not find a lazy admin asset; corrected inspection uses the service-worker precache manifest. The second script completed all route/configuration assertions but its over-restrictive mutation filter blocked the read-only get_delivery_settings POST. This is **not counted as a full smoke-run pass**. A separately focused checkout test allowed that documented read RPC and passed (200, enforcement false, no blocked writes). Neither setup failure demonstrates an application permission/payment bug; individual passed assertions and the limits above are the evidence.

## Final safety and working-tree state

Production officebites.co.za still resolves to **dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt**, and the latest Production deployment ID is unchanged. Remote main remains **4c4835db62b7db4c7a725c92d7a6294ca523fa57**. No production Supabase query/write/deployment, production Vercel setting, alias or payment secret was changed. No migration was applied. Staging's only persistent backend change is the necessary PayFast v20 exact-origin allowance.

Final staging reads confirm PayFast enabled/ready as before, Ozow disabled/not ready, corporate/standard/onboarding flags false, delivery and retention false, and zero retained synthetic legal/repair Auth accounts. No provider initiation, customer order/message, refund/payout or deletion occurred.

All application/Edge/check changes are committed and pushed in the two SHAs above. The working tree was clean after the second push. This postdeployment report update is intentionally retained locally and uncommitted so the recorded final verification describes the exact deployed HEAD; no extra deployment is triggered by recording the results. Ignored local audit/browser artifacts are preserved and excluded from Git. Final git diff --check passes.

## Files reviewed for the development commit

```text
CHECKOUT-AUTH-PAYMENT-REPAIR-REPORT.md
LEGAL-APPROVAL-CHECKLIST.md
LEGAL-CORPORATE-IMPLEMENTATION-REPORT.md
OFFICEBITES-INTEGRATION-READINESS-REPORT.md
OFFICEBITES-PREVIEW-PAYMENT-VALIDATION-REPORT.md
checks/browser-harness.jsx
checks/checkout-browser.spec.mjs
checks/checkout-database.mjs
checks/checkout-repair-database.mjs
checks/checkout-repair-staging.sql
checks/checkout-repair.mjs
checks/fixtures/checkout-repair-prerequisites.sql
checks/legal-corporate-database.mjs
checks/legal-corporate-disable.sql
checks/legal-corporate-staging.sql
checks/payment-cors.mjs
checks/recovery-browser.spec.mjs
checks/recovery-scope.mjs
checks/verify-local.mjs
deno.lock
src/components/features/CheckoutControls.jsx
src/components/features/CommercialStatement.jsx
src/components/features/MealFormModal.jsx
src/components/features/OrderCard.jsx
src/components/features/TicketCard.jsx
src/components/features/VendorConsent.jsx
src/components/forms/FileUpload.jsx
src/components/layout/LegalLinks.jsx
src/components/ui/Avatar.jsx
src/components/ui/StatusBadge.jsx
src/layouts/AdminLayout.jsx
src/layouts/AuthLayout.jsx
src/layouts/CustomerLayout.jsx
src/layouts/PublicLayout.jsx
src/layouts/VendorLayout.jsx
src/pages/admin/AdminOverview.jsx
src/pages/admin/AdminPayments.jsx
src/pages/auth/Login.jsx
src/pages/auth/Register.jsx
src/pages/customer/BecomeVendor.jsx
src/pages/customer/OrderTracking.jsx
src/pages/customer/PaymentUpload.jsx
src/pages/customer/TicketConfirmation.jsx
src/pages/help/LegalDocument.jsx
src/pages/shared/CommercialWorkspace.jsx
src/routes/AppRoutes.jsx
src/routes/routeComponents.js
src/services/api/mappers.js
src/services/authService.js
src/services/commercialService.js
src/services/orderService.js
src/services/vendorService.js
src/utils/authError.js
src/utils/checkoutError.js
src/utils/constants.js
src/utils/orderState.js
src/utils/persistentImage.js
supabase/functions/_shared/payment-origins.ts
supabase/functions/payfast-initiate/index.ts
supabase/migrations/20261016094201_legal_corporate_framework.sql
supabase/migrations/20261016100142_commercial_reporting_contract_locks.sql
supabase/migrations/20261016101707_repair_order_policy_helper_access.sql
```

## Remaining production blockers

Corporate refund/settlement/negative-balance integration and independent-session races; approved legal documents/disclosures/VAT treatment; actual gateway sandbox/ITN verification; designated authenticated browser flows; installed-PWA update and physical mobile coverage. The integration audit also records missing admin favourite counts, removal-blocker UX, receipt review indicators and cleanup source-history restoration; these unrelated reconciliations were not silently merged during Preview preparation.

No real-money payment, actual refund/payout, customer message, account deletion, order classification/backfill, corporate charge, delivery enforcement, unapproved subscription or legal publication is authorized or performed. Production must remain unchanged.
