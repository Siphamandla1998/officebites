# OfficeBites current repair audit — 16 October 2026

Starting branch `feat/legal-vendor-corporate-acquisition`, HEAD `4097407`. No AGENTS.md found in the repository. Existing preview-payment report is preserved byte-for-byte (SHA-256 D6649A49D732CB9840EC2032DA8CDE70108B1681B06884C9B0A9A74642B2AC75).

## Evidence before application edits

Read the development, checkout repair, legal/corporate, delivery, integration-readiness, release and preview payment reports and current payment/order/legal/admin source. Historical reports are evidence of earlier work, not current verification.

- Current staging read: Ozow disabled/not ready; PayFast ready but disabled and in maintenance. This differs from the earlier preview report. No setting was changed.
- Aggregate staging reconciliation: six pending unpaid orders and one cancelled unpaid order have no COMPLETE receipt; three confirmed paid orders and one completed paid order each have exactly one COMPLETE receipt matching the order total. No unsupported stored paid order was reproduced. One of the four receipts has a test-labelled identifier. Stored receipts do not independently prove bank settlement or a genuine provider callback.
- Customer tracking derives Paid from stored suborder payment_status. Admin recent payments already require matching receipts. The vendor order modal incorrectly maps paid payment status to the Completed fulfilment badge.
- checkoutService assumes PayFast enabled/ready when the gateway RPC is missing (PGRST202): unsafe optimistic availability.
- Ozow is hidden unless enabled, ready and outside maintenance. Current disabled/not-ready state explains its absence. Actual merchant credentials, hosted redirect, webhook verification and settlement/refund readiness remain unverified; do not enable it.
- Shared footer exposes vendor agreement and fee links to customers and signed-out visitors. Both direct routes are public. Required customer terms/privacy/refund routes must remain public. Vendor application consent is a separate, intentional business flow.
- Analytics converts null processor fees to zero and labels provider-neutral fees as PayFast fees. Financial reporting explicitly uses null for unknown Ozow fees.
- Payments starts with a long checkout configuration block including delivery policy and origin approval queue before its page title/receipt list. Legal/corporate workspace renders every editor and operational section in one long page.
- Existing preview branch alias returned HTTP 200 through read-only curl outside the broken sandbox proxy. Authenticated preview journeys are not yet verified. Browser capture awaits permission required by the Product Design skill; no screenshots or hosted authenticated pass claimed.
- Corporate acquisition, standard breakdown and onboarding enforcement remain false in current staging reads.

## Prioritised repair plan

1. Fail closed on missing gateway settings; distinguish vendor payment badges from fulfilment; retain server-only confirmation and existing historical records.
2. Show disabled Ozow availability clearly; keep readiness gates and independent provider controls. Test disabled/maintenance/error states without provider requests.
3. Scope commercial footer links to vendor/admin surfaces and protect direct commercial document routes; preserve public customer policies.
4. Put Payments heading first; collapse delivery administration separately. Group Legal workspace sections without changing commercial activation logic. Correct unknown-fee analytics.
5. Run isolated service/database regressions and staging-mode build/lint. Capture mobile and desktop before/after evidence when browser permission is available; distinguish synthetic authenticated fixtures from signed-out hosted evidence.

No push, merge, deployment, persistent hosted mutation, payment initiation or historical status correction is authorised by this plan. Entire installed-PWA, real merchant and authenticated hosted flows remain separate verification work.

## Implemented local repairs

- Removed optimistic PayFast readiness fallback. Missing settings now produce a retryable error and no payment action.
- Checkout reads and refreshes gateway settings. With no enabled, ready provider outside maintenance it preserves the cart, explains unavailability and prevents creating another unpaid order. The success message is provider-neutral. A server check still decides whether initiation is allowed after a setting changes.
- Ozow absence is explained without offering an unverified payment action. Existing independent gateway forms and backend readiness checks remain intact.
- Vendor payment badge now says Paid instead of Completed; unknown payment status requests review. Modal has a labelled dialog role. Keyboard focus trapping remains a separate accessibility gap.
- Customer/public/auth footers retain only Terms, Privacy/POPIA and Refunds. Vendor footer retains business links. Direct vendor agreement/fee routes require vendor/admin role. Applicants can review published documents inline in the explicit vendor-consent flow; customer registration does not render that flow.
- Payments heading precedes controls; delivery policy/origin administration is expandable. Admin Legal editors, corporate administration and commercial statements/fee references are grouped separately. Vendor ledger downloads remain available.
- Analytics preserves null processor fees as Unresolved and uses provider-neutral labels.

## Current preview capture steps

Read-only Edge capture at 390×844 and 1440×1000, fresh contexts with production Supabase and hosted mutations blocked. Current-run files are in `.officebites-local/current-audit-visuals/`. These show the existing hosted build, not the local repairs. All twelve final captures returned HTTP 200, had no captured page errors or horizontal overflow. Inspected final contact sheet and individual public/vendor-fee captures; earlier loading-state screenshots were rejected and replaced.

| Step | Journey | Observed health / limit |
| --- | --- | --- |
| 1 | Search meals | Renders; commercial links visibly leak into customer footer. No meal search submitted. |
| 2 | Empty checkout | Renders an actionable empty state; same footer leak. No hosted order submitted. |
| 3 | Terms | Accessible; explicitly unpublished, incomplete business disclosures. This is not approved legal coverage. |
| 4 | Vendor fees | Publicly reachable before local fix; unpublished notice. Commercial route/navigation exposure verified. |
| 5 | Admin Payments | Redirects signed-out visitor to login. Authenticated hosted controls untested. |
| 6 | Vendor Orders | Redirects signed-out visitor to login. Authenticated hosted fulfilment untested. |

![Current Preview mobile customer footer](.officebites-local/current-audit-visuals/preview-390-1.png)

## Wider flow audit and remaining work

| Surface | Current evidence | Outstanding verification |
| --- | --- | --- |
| Auth / role permissions | Protected routes inspected; session/account race and role fixtures in regressions. Payment confirmation/preparation/Ozow recording are service-only in current staging ACLs. | Actual customer/vendor/admin login, refresh and email recovery on this Preview. |
| Gateway administration | Current staging RPC definition requires active admin and readiness before enabling; each update is audited. | Hosted admin toggle/persistence deliberately not mutated; actual merchant sandbox/ITN evidence absent. |
| Order/payment/fulfilment | Aggregate stored receipts match current paid orders. UI and callback code inspected; browser returns do not confirm payment. | User identified Preview but no ticket code; specific reported Paid case remains unresolved. Receipt provenance and bank settlement cannot be inferred from stored totals. |
| Delivery / catalogue | Local isolated delivery/approval/quote checks; existing 19:00 prior-day cutoff retained. | Verified hub pin, real device GPS, native concurrent approval/checkout, delivery activation. |
| Vendor menu/images | Persistent image guards and ownership service paths inspected; existing fixture coverage retained. | Real account storage upload and approved vendor operation. |
| Chat / notifications / support | Existing service/state/error/race regressions; disabled reviews explicitly disclose unavailability. | Two-account hosted realtime delivery, real ticket/reply delivery. No messages sent. |
| Reports / commercial | Unknown fee display corrected; immutable snapshots and corporate disabled state retained. | Receipt provenance, refunds/settlement, complete legal disclosures/publication. Commercial report is not payout evidence. |
| PWA / accessibility | Staging-mode build and viewport checks. Labelled modal semantics added. | Physical installation/update/offline recovery, keyboard focus trap/Escape restoration and full accessibility audit. |

This is a broad source/fixture review with scoped hosted evidence, not a claim that every authenticated PWA operation or real-money integration passed. No production reads/writes, historical ZIP import, branch switch/reset, commit/push or deployment occurred.

## Reproducible verification

Use Node 22 (this session used the existing temporary Node 22.23.3 runtime; it was absent from PATH). No dependency installation was needed.

```powershell
node checks/verify-local.mjs
node node_modules/vite/bin/vite.js build --mode staging
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:PLAYWRIGHT_DISABLE_GPU = '1'
node checks/verify-browser.mjs
node node_modules/oxlint/bin/oxlint <changed source/check files>
git diff --check
```

- Full isolated regression suite: passed, including database fixtures, role/payment/receipt, legal/corporate, cancellation, delivery, dates, support and session races. No new SQL was applied to hosted staging.
- Final Edge suite: **37 passed (2.0 minutes)**. Synthetic services block hosted writes; the separate unmocked signed-out staging read story also passed. Enabled Ozow in a fixture is not hosted readiness.
- Final staging-mode production build: passed; 122 PWA precache entries. Targeted lint on 16 changed sources/checks passed; whitespace checks passed.
- Final current-run visual evidence: local payment, customer policies, Admin Payments, Analytics, Legal administration, vendor orders and vendor payment modal at mobile and desktop. Role-switch capture was tightened to assert the actual Orders heading; the earlier overview capture was rejected. Synthetic fixture amounts/provider flags differ from current hosted staging by design.
- Strengthened visual check rerun: **1 passed**, then **1 passed (24 seconds)** with screenshot animations disabled to capture settled navigation. Corrected vendor Orders and settled desktop Legal screenshots inspected directly. This test-only capture refinement followed the 37-test pass; application source did not change afterward.
- Earlier browser runs are retained rather than hidden: first 32 passed/2 failed (ambiguous heading and collapsed delivery queue); next 35 passed/2 failed (missing createdAt in the new vendor fixture and an over-specific legal heading locator). The corrected full suite passed. Preview capture initially failed to find the app root; subsequent stable captures passed, with loading-state captures rejected.
- Read-only staging postcheck: PayFast remains disabled/maintenance/ready; Ozow disabled/not ready; corporate/standard/onboarding flags false; zero published legal versions.
- Branch and HEAD remain unchanged. Existing preview-payment report SHA-256 remains D6649A49D732CB9840EC2032DA8CDE70108B1681B06884C9B0A9A74642B2AC75. All repairs remain local and uncommitted.

![Local customer payment with customer-only policies](.officebites-local/current-audit-visuals/local-390-payment.png)

![Local grouped Legal administration](.officebites-local/current-audit-visuals/local-390-legal-admin.png)

![Local vendor payment distinct from fulfilment](.officebites-local/current-audit-visuals/local-390-vendor-payment.png)
