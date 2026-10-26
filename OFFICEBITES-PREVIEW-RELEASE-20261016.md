# OfficeBites Preview release — 16 October 2026

Owner authorised committing the reviewed work and pushing only `feat/legal-vendor-corporate-acquisition` to trigger Vercel Preview. Starting HEAD `40974072a5899c96a2e422b175c3f214b9f56b01`. No main push/merge, production deployment, migration, charging activation or legal publication.

## Reviewed scope

Reviewed all modified tracked files, the new repair audit, and the empty starting index; no other nonignored untracked files were present. Existing changes in OFFICEBITES-PREVIEW-PAYMENT-VALIDATION-REPORT.md are included intact (starting SHA-256 D6649A49D732CB9840EC2032DA8CDE70108B1681B06884C9B0A9A74642B2AC75). Ignored environments, historical ZIPs, tools, build output and evidence are preserved and excluded from Git.

Changes cover gateway fail-closed behaviour, no-gateway checkout prevention, explicit Ozow unavailability, vendor payment versus fulfilment labels, customer policy-only navigation, protected vendor legal routes with applicant inline review, grouped admin controls/legal sections, unknown processor-fee display, dialog semantics and regression/visual checks. Detailed file inventory is generated from the reviewed Git candidate list before staging.

## Release validation

- Full `node checks/verify-local.mjs`: passed, including isolated SQL/payment/legal/delivery/security/service/date regressions.
- Full Edge `node checks/verify-browser.mjs`: **37 passed (2.3 minutes)**, including mobile/desktop captures. Synthetic tests block hosted writes; actual signed-out staging read test is separate.
- `vite build --mode staging`: passed; 122 PWA precache entries.
- Repository-wide oxlint: exit 0, no errors, nine existing warnings in unchanged hooks/contexts. Changed sources previously passed targeted lint.
- Frozen Deno check on all six discovered Edge entrypoints: passed. Two earlier command setup failures referenced nonexistent entrypoints; no function was changed or deployed.
- Git whitespace and scoped secret/path scans run before committing. No dependency changes, environment files, private data or credential values included.

## Environment and payment safety

Vercel project `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71`, team `team_kKRzCLk1pNHoIA4sV1M0ciSg`. Preview variable readback matches `https://eyhmarmekioovcjibcbr.supabase.co`; public publishable key matches an active staging key. No feature-branch override was found. Values are not recorded here. Production/development variables were not copied or edited. Local `.env.local` remains preserved; local builds explicitly use staging mode.

Staging gates: PayFast disabled, maintenance true, configuration-ready true; Ozow disabled/not ready. Delivery enforcement and readiness attestations false. Acquisition/standard-breakdown/onboarding flags false. Zero approved legal versions. No merchant secret was retrieved, no payment initiation/notification fabricated, and no existing order status was edited. Merchant sandbox/live credential mode and genuine payment/webhook processing remain unverified; disabled gateways make this a non-transacting inspection Preview.

Production baseline: officebites.co.za alias points to `dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt`; remote main remains `4c4835db62b7db4c7a725c92d7a6294ca523fa57`. The existing feature deployment is Preview; no production target is requested. Current previous-day 19:00 SAST cutoff is unchanged.

## Deployment and hosted verification

Commit **9b1623680afe6530c7282ed2be6754cd4947d373** (`fix: fail closed on checkout gateways and separate payment statuses`) was pushed normally only to the authorised feature branch. Remote branch readback equals HEAD. Vercel Git integration created **dpl_ZGxYvQjxdGY74s7Lhx1J1RVEQEvz**, **READY**, Preview (`target=null`), source Git, exact matching commit/branch. Build logs confirm cloning 9b16236 and running the project build. No production deployment was requested.

- Inspection URL: **https://officebites-git-feat-legal-vendor-da31dd-sp24tg-6983s-projects.vercel.app/**. Alias readback resolves to the new deployment. Use this accepted payment origin.
- Immutable URL: https://officebites-8oj6fgzwk-sp24tg-6983s-projects.vercel.app/. It is not an approved initiation/return origin; no wildcard CORS allowance was added.
- Actual branch-origin PayFast OPTIONS returns HTTP 200 and exact matching Allow-Origin; no POST/initiation was sent.
- Actual deployed compiled client contains the intended staging URL/public publishable key, no production project URL. Actual hosted reads reached only `eyhmarmekioovcjibcbr.supabase.co`.

### Deployed Edge QA and visual findings

At **390×844** and **1440×1000**, fresh contexts, service workers blocked for deterministic online checks:

| Step | Check | Result and evidence boundary |
| --- | --- | --- |
| 1 | Search and empty checkout | Actual staging/public rendering passed; customer footer has only Terms/Privacy/Refunds. |
| 2 | Terms and vendor-fee access | Actual Terms displays unpublished notice; signed-out vendor fee route redirects to login. No document published. |
| 3 | Admin/vendor signed-out access | Actual `/admin/payments` and `/vendor/orders` redirect to login; no credentials submitted. |
| 4 | Customer nonempty checkout and payment | Deployed JavaScript with intercepted synthetic backend passed: no-gateway Place order disabled, cart retained, PayFast disabled and Ozow explanation visible. No order/payment request reached staging. |
| 5 | Payment states | Deployed synthetic unpaid order shows Unpaid; a separate synthetic stored-paid response shows Paid and Waiting for vendor acceptance, with no fulfilment completion implied. No hosted order changed. |
| 6 | Admin gateways | Deployed synthetic admin form passed PayFast ON/OFF, maintenance, save/reload persistence; Ozow enable checkbox remains disabled while unready. Four save requests across both widths were fulfilled locally by the browser interceptor, not sent to Supabase. This does not verify hosted admin persistence. |
| 7 | Analytics and Legal | Deployed synthetic admin views passed; unknown processor fees render Unresolved; legal/commercial administration is grouped and collapsed. |
| 8 | Vendor Orders and overview | Deployed synthetic vendor role rendered both screens at both sizes. This does not certify real-account login, RLS or fulfilment. |

**Passed:** full deployed QA rerun (12 actual public route checks plus six role/viewport scenarios), no page errors, no horizontal document overflow, no unexpected backend calls; separate actual hosted/bundle-isolation smoke passed. Saved screenshots under `.officebites-local/release-visuals/`; inspected mobile disabled checkout, paid-awaiting-acceptance and desktop gateway controls directly. Visual spacing, legible controls and customer policy navigation are consistent on inspected sizes.

**Harness failures retained:** initial deployed-fixture run omitted the favourites read response. Initial legacy isolation helper blocked the documented read-only delivery settings RPC. Both were corrected in ignored audit helpers; complete reruns passed. No application/deployment failure was found.

![Deployed mobile checkout, synthetic backend, gateways disabled](.officebites-local/release-visuals/deployed-fixture-390-checkout-disabled.png)

![Deployed desktop gateway controls, synthetic backend](.officebites-local/release-visuals/deployed-fixture-1440-admin-gateways.png)

### Final safety and outstanding work

Post-QA staging reads confirm both gateway states unchanged, delivery disabled, acquisition/standard/onboarding disabled and zero published legal versions. Remote main still `4c4835db62b7db4c7a725c92d7a6294ca523fa57`; officebites.co.za remains on `dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt`. No production database was queried or migrated. No Edge Function, payment secret, cutoff or historical payment/commission record changed.

Still blocked/unverified: genuine customer/vendor/admin login and refresh on the new Preview, hosted admin setting persistence, actual guest/member order submission while gateways are disabled, merchant sandbox mode/credentials/redirects/ITN/webhooks/refund/settlement, installed-PWA/offline/device GPS, and the specific reported Preview Paid case without its ticket code. These are not claimed as passes or clearance for real-money use.

All pre-existing work is included in the feature commit. This postdeployment release-report update is the only intentionally uncommitted tracked change so recording the exact deployment does not trigger a second deployment. Existing payment validation report remains unchanged at its starting file hash.

## Exact committed file inventory

```text
OFFICEBITES-CURRENT-REPAIR-AUDIT.md
OFFICEBITES-PREVIEW-PAYMENT-VALIDATION-REPORT.md
OFFICEBITES-PREVIEW-RELEASE-20261016.md
checks/browser-harness.jsx
checks/checkout-browser.spec.mjs
checks/recovery-browser.spec.mjs
src/components/features/CheckoutControls.jsx
src/components/features/VendorConsent.jsx
src/components/layout/LegalLinks.jsx
src/components/ui/Modal.jsx
src/layouts/VendorLayout.jsx
src/pages/admin/AdminAnalytics.jsx
src/pages/admin/AdminPayments.jsx
src/pages/customer/Checkout.jsx
src/pages/customer/PaymentUpload.jsx
src/pages/shared/CommercialWorkspace.jsx
src/pages/vendor/VendorOrders.jsx
src/routes/AppRoutes.jsx
src/services/checkoutService.js
```

Authenticated real-account hosted journeys and actual merchant integration require designated sessions and verified sandbox access; they must not be represented as passed by synthetic role fixtures. The reported Preview Paid case still lacks its ticket code; current staging paid orders match stored receipts, which alone do not prove bank settlement.
