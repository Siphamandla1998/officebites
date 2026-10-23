# Vendor-direct launch audit — 20 October 2026

## Recorded baseline

- Local starting branch `feat/legal-vendor-corporate-acquisition`, HEAD `b7c2d3b4b0b530a2710b5de97e912f59f8d53c60`, tracking origin branch, ahead one commit.
- `origin/main` locally records `4c4835d`; local `main` is behind it. Neither is assumed to be the deployment source.
- Existing uncommitted `OFFICEBITES-PREVIEW-RELEASE-20261016.md` is preserved.
- New branch: `feat/vendor-direct-launch-payments`, based on inspected HEAD containing the checkout/security repairs.
- Latest local migration: `20261016101707_repair_order_policy_helper_access.sql`. Hosted staging history includes its corresponding `20261016103515` migration and the October-16 checkout, Ozow, delivery, legal and reporting prerequisites. Earlier hosted and local timestamps differ: do not blanket db push.
- Connected project listing independently identifies `eyhmarmekioovcjibcbr` as `officebites-staging`. Only staging settings/history were queried; production database was not accessed.
- Staging read: PayFast enabled/ready, Ozow disabled/unready. This contradicts the older release report. Delivery enforcement remains disabled, free radius 0.5 km, max 5 km, outer fee R15.
- Existing release notes identify a historical production deployment and feature Preview. Current live deployment provenance has not been independently verified. No push/deployment is authorised.

## Findings and smallest implementation

1. `customer/Checkout.jsx`, `orderService.js`: guest name/mobile, no required email; authenticated identity verified; database cart prices and delivery quotes authoritative. Existing checkout permits multiple vendors and depends on gateway availability. Add vendor-specific manual selection and an idempotent RPC around the existing creation core.
2. `PaymentUpload.jsx`, `paymentService.js`: gateway redirects/retries and secure guest ticket/contact recovery. Replace new payment instructions with token-protected manual instructions; retain provider services/callbacks for history.
3. `orderState.js`, database transition triggers: payment and fulfilment already separated; unpaid fulfilment blocked. Keep these transitions; reporting payment updates private submission state only.
4. `private.gateway_settings`, preparation RPCs, `payment_attempts`, `ozow_attempts`, PayFast ITN log: retained. Block new provider preparation independently of flags. Merchant authorisation is absent; credentials/readiness cannot substitute for it.
5. Vendor orders/settings have ownership-scoped order access but no approved banking workflow. Add append-only private profile versions, independent admin approval, order snapshot, vendor verification/dispute controls.
6. Admin payments has gateway settings/history. Add approval queue, deadlines, manual queue, audit history and receivables export. Keep banking data out of public catalogue/order JSON.
7. Existing paid-transition trigger captures vendor commission (default 17%, vendor-specific rate supported). Reuse once, with no marketing activation or VAT assumption. Existing payout reporting assumes platform settlement: exclude manual proceeds from that ledger and expose separate vendor-direct receivables/collections/refund adjustments.
8. Private banking and instruction tables have RLS and no client grants; narrow checked RPCs expose necessary data. Guest instructions require a random order capability, not UUID/ticket enumeration. Direct historical checkout endpoints must reject new calls to prevent bypassing manual eligibility.
9. Existing `checks/` includes PGlite role/security/financial regressions, browser fixtures, CORS and order rules. Extend the isolated database suite with real new-function allow/deny/state/ledger assertions; run lint/build and appropriate regressions. Hosted native concurrency and real bank receipt still require staging validation.
10. Legal framework is versioned/approval-controlled. No published legal text will be edited. Draft vendor-direct amendments separately for human legal/commercial review.

## File plan

- One additive migration: private profiles/settings/instructions/events/receivables; checked RPCs; preserve provider callbacks and existing calculation core.
- `services/manualPaymentService.js`, checkout/order service: scoped RPC adapters.
- `Checkout.jsx`, `PaymentUpload.jsx`, `CartContext.jsx`: single vendor, manual selection, safe instructions/reporting.
- Small shared payment management components embedded in existing vendor settings/orders and admin payments/revenue screens.
- `checks/manual-payments-database.mjs`: security/payment/commission regression cases appended after existing baseline checks.
- Handoff and unpublished legal-review documents with staging gates, rollback and launch blockers.
