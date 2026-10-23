# Vendor-direct launch handoff — 20 October 2026

**Follow-up:** [Staging release review](vendor-direct-staging-readiness-20261020.md) records the revised fail-closed installation defaults, refund safeguards, synthetic-only operator view, current evidence and exact pending approval. Hosted staging remains unchanged.

## Status

Local implementation on `feat/vendor-direct-launch-payments`, based on audited `b7c2d3b4b0b530a2710b5de97e912f59f8d53c60`. Not deployed, pushed or committed. The pre-existing uncommitted release report is preserved. No production database was accessed. Hosted staging was read only; no migration, secret, function, setting or order was changed there.

**Not cleared for a real-money pilot.** The staged schema still lacks this migration. Its PayFast flag was found enabled/ready, contrary to the older report; Ozow remains disabled/unready. This local change does not change any currently hosted checkout. Disable rejected provider initiation in an explicitly authorised staging/release operation; do not treat current flag state as merchant permission.

## Implemented

- Guest checkout retained; one vendor per order, explicit cart replacement choice, only approved vendor-supported PayShap/EFT methods. No active gateway option or fallback.
- Existing trusted pricing, meal/quantity/cutoff checks, OB references, delivery quotes/origin snapshots, fulfilment flow and vendor-specific commission snapshots reused. No delivery enforcement, pricing, marketing, VAT or subscription flags activated.
- Private append-only vendor bank-profile versions, independent administrator approval and evidence. Pending edits leave existing approved versions in place. Bank details remain out of public vendor/order responses.
- Immutable order recipient snapshot, amount, method, random access capability, idempotency key and deadline. Defaults: 15 minutes, capped by the existing previous-day 19:00 SAST cutoff. Threshold: R500 for additional admin receipt review; both are configurable.
- Customer reporting leaves fulfilment pending and suborder payment unpaid. Protected receipt confirmation requires the assigned active vendor/admin; wrong amounts, suspicious/disputed/cancelled/late orders remain unpaid and under review. Row locks, idempotent confirmation, unique vendor bank reference and one receivable per order prevent duplicate credit.
- Disputes hold fulfilment. Administrator resolution is audited and does not itself confirm bank receipt. Paid history stays paid when refunds are recorded; refunds are separate adjustments.
- Refund requests/processing and admin-evidenced completion/decline are recorded, including late/unconfirmed transfers without inventing a paid order or commission. Full reconciled refunds permit admin cancellation of an unfulfilled paid manual order; completed fulfilment remains historical. No gateway/bank refund is initiated by this software.
- Existing commission snapshot accrued once as a vendor receivable; manual gross proceeds excluded from gateway financial sales/payout eligibility. Weekly/date-filtered CSV statements show gross, commission, refunds, credits, collections and balances. Recorded commission returns reduce collected cash; a negative balance after refunds requires vendor credit reconciliation.
- Existing gateway configuration reused for manual availability. A separate singleton holds only manual deadline/risk parameters. Provider settings cannot reactivate PayFast/Ozow; new provider attempts are blocked independently. Existing callbacks, payment records and signature code remain intact.
- No proof upload feature or new storage bucket. No bank data or merchant secrets in frontend configuration. Payment capabilities stay in session storage/memory, outside URLs and generic order JSON. SHA-256-scoped request IDs survive reload/ambiguous responses in the tab without storing checkout payloads in the request-key store.

## Modified application files

- `src/services/manualPaymentService.js`: manual RPC adapter, private capability and request-key persistence.
- `src/services/orderService.js`: existing identity checks retained; manual-order RPC and capability capture.
- `src/context/CartContext.jsx`, `src/components/features/CartDrawer.jsx`: explicit one-vendor cart flow and restored-cart guidance.
- `src/pages/customer/Checkout.jsx`, `PaymentUpload.jsx`, `OrderTracking.jsx`: method selection, protected instructions, reporting, cancellation and tracking integration.
- `src/components/features/ManualPaymentStatus.jsx`, `ManualPaymentWorkspace.jsx`: tracking, bank profile submissions/approval, verification, disputes, refunds, statements and reconciliation.
- `src/components/features/CheckoutControls.jsx`: gateway reactivation controls unavailable.
- `src/pages/vendor/VendorSettings.jsx`, `VendorOrders.jsx`, `VendorRevenue.jsx`, `src/pages/admin/AdminPayments.jsx`: embedded existing-dashboard workflows.

## Migration

`supabase/migrations/20261020090841_vendor_direct_manual_payments.sql`, generated using the Supabase CLI and verified against the isolated baseline plus October-16 fixtures. It adds private tables/indexes/RLS, checked RPCs, immutable history and guard triggers; expands allowed method names; privately retains the existing delivery/order creation core; rejects outdated checkout entrypoints; adds a narrow full-refund cancellation rule; filters only new manual instructions from the existing gateway financial view. Historical order/payment rows are not backfilled or rewritten.

Requires the currently audited October-16 schema, including Ozow attempts, delivery snapshot, financial and account helpers. The migration asserts the expected cancellation-function insertion point. Staging reads confirmed the relevant method/gateway constraint names and that the transition trigger applies only to `order_suborders`. **Do not blanket `db push`**: hosted/local historical migration timestamps differ.

## Validation

- `node checks/verify-local.mjs`: passed the complete local regression runner, including 96 new manual-payment assertions and the existing account, financial, delivery, legal, CORS, provider-mock and four-timezone checks. The subsequently extended isolated database suite adds three historical PayFast callback assertions (99 manual-suite assertions total), explicitly confirming that an existing pending provider order can still reconcile after the new initiation block.
- `PLAYWRIGHT_CHANNEL=chrome node checks/verify-browser.mjs --grep-invert 'unmocked public frontend'`: 43 local browser fixtures passed, including five new manual-flow tests, storage denial, account/route races, legal access, reporting, delivery and vendor order regression. All hosted Supabase requests are blocked; the separately hosted-data test is intentionally excluded.
- Mobile (390 px) and desktop (1440 px) EFT screenshots captured; mobile screenshot inspected. No horizontal overflow in the tested instruction screen.
- `node node_modules/oxlint/bin/oxlint`: existing React provider/export/dependency warnings; no errors in the successful lint run.
- `node node_modules/vite/bin/vite.js build --mode staging --configLoader native`: local PWA build, manifest and service worker generation. No deployment.
- Initial attempts retained honestly: Playwright's expected bundled browser was missing; installed Chrome passed. An old recovery test expected removed PayFast-era text; updated to assert the new reference/instruction screen. The first VM service regression needed the newly introduced token-store dependency mocked; full rerun passed.

Test/config changes: `checks/manual-payments-database.mjs`, `manual-payments-browser.spec.mjs`, `checkout-database.mjs`, `checkout-repair.mjs`, `checkout-browser.spec.mjs`, `recovery-browser.spec.mjs`, `browser-harness.jsx`, and `playwright.config.mjs`. The existing provider-option assertions were updated to require absence even when old flags claim readiness. New operator SQL permissions/transitions are exercised in PGlite; persistence of the actual operator forms remains part of hosted staging verification.

PGlite exercises actual SQL functions, roles, permissions and triggers using synthetic fixtures. It does not prove native PostgreSQL concurrent execution, Supabase/PostgREST schema exposure, real authentication delivery, real banking, installed-device PWA behaviour, webhook registration, or merchant permission. No hosted transaction or provider payment is claimed as tested. The React frontend is JavaScript/JSX; there is no configured standalone TypeScript check.

## Exact staging procedure (requires separate hosted-change authorisation)

1. Re-list projects and verify project **name `officebites-staging`, ID `eyhmarmekioovcjibcbr`**. Verify the intended frontend staging environment targets that exact URL/public key. Do not copy production configuration, secrets or database contents.
2. Record current staging migration history, gateway flags, order/payment counts and relevant function definitions. Verify the October-16 prerequisites and inspect migration diff. Preserve a controlled backup/snapshot according to existing access policy. No reset/seed/truncate or blanket history repair.
3. Obtain explicit approval to apply only the named new migration to staging. Apply through the project's migration workflow, then re-read schema/version and run Supabase security advisors. Confirm public grants, RLS, fixed function search paths, old proof-upload revocation and no newly exposed bank tables.
4. Recheck **both gateway providers disabled**. Attempt a flag reactivation and new gateway preparation only inside rollback-only synthetic staging tests; expect rejection. Verify historical callbacks/read access with approved fixtures, without fabricating real payment notification records.
5. Provision designated test customer, two vendor identities and two independent admins through the approved Auth/onboarding process. Use two explicitly synthetic staging vendors/meals. Do not alter an operational vendor or insert fabricated production identities.
6. Vendor A submits verified test-bank receiving details; unrelated vendor and anonymous access must fail. No customer method appears before independent approval. Admin submitter cannot approve their own version. Approve with verification evidence. Submit a changed pending version and confirm existing approval/order snapshots stay unchanged.
7. Exercise guest and member EFT/PayShap orders from the staged frontend. Verify prices/quantity rejection, unique OB references, quote/cutoff behaviour, mixed-vendor rejection and simultaneous duplicate-key requests from two connections (one order). Test concurrent confirmation/report/cancel/refund from independent connections. Verify immutable amounts/recipients, test classification, and row locks.
8. Validate guest capability access versus UUID-only/wrong-token denial. Verify ticket/contact tracking still works but cannot recover banking instructions without the capability/authenticated owner. Do not put capabilities in logs, URLs or screenshots shared publicly.
9. Reporting must leave payment unpaid. Wrong vendor/anonymous/suspended accounts cannot verify. Confirm correct amount and bank reference as the assigned vendor; confirm high-value payments require admin review. Disputed, cancelled, expired, underpaid/overpaid and reused bank-reference cases must remain safe. Confirm paid records/commission are created exactly once.
10. Follow acceptance → preparing → ready → collection/delivery → completed. Test dispute hold/resolution, refund lifecycle, full-refund cancellation and commission credits/collections/returns. Reconcile CSV totals in SAST date windows and ensure test orders are excluded from operational statements. Verify delivery-fee refund allocation separately.
11. If business/bank/legal permission is signed off, arrange a small genuine vendor-directed bank transfer performed by authorised humans. Independently inspect bank receipt. Test both supported methods and a real vendor refund; do not use an OfficeBites/personal recipient for third-party food sales. Record redacted evidence and results.
12. Test an actual mobile banking-app return, browser reload, installed PWA update, offline error behaviour and device GPS. Existing public-only caching must never store payment RPC responses. Record staged build/commit IDs and results before proposing any production release.

## Vendor onboarding and launch blockers

- Verify each seller's legal identity, account ownership, receiving bank/business-use permissions, registered ShapID and actual PayShap capability. Two-person approval is enforced; an operational independent admin is required.
- Obtain signed commercial agreement covering when 17% (or the existing agreed override) accrues, delivery receipt/reimbursement, statement period, invoice terms, marketing exceptions, refunds and VAT treatment. CSV exports support manual invoicing but do not issue statutory/tax invoices or auto-collect money.
- Publish reviewed legal versions only through separately approved existing legal controls. Draft proposals are in `vendor-direct-legal-review-DRAFT.md`; no legal version was published here. Confirm seller/refund/support disclosures before real orders.
- Obtain provider-specific written authorisation before any future gateway integration release. Ozow's public terms do not prove approval for this marketplace. Current technical readiness is insufficient.
- Native staging security/concurrency/end-to-end evidence and the genuine-bank/device tests above remain outstanding. Current live deployment provenance must be verified separately; the previous release report is historical evidence only.
- Guest capability loss requires support or authenticated-owner access to instructions. There is no new anonymous capability-recovery service. Tracking via existing ticket/contact recovery is retained.
- The pilot queue loads scoped history without server pagination; keep pilot volume controlled, and add pagination before wider rollout. No automated expiry job deletes/cancels orders: deadlines are enforced at payment-report/confirmation and shown on reads; expired bank receipts require explicit support/refund review.

## Production checklist — not authorised/executed

Require signed staging evidence, bank/vendor/legal/commercial approval and explicit deployment approval. Verify actual production Git/alias/database provenance, backup and exact schema prerequisites; resolve timestamp drift with reviewed migrations. Configure independently approved vendor profiles and operational admins. Keep new PayFast/Ozow initiation disabled; preserve callbacks and secrets for history. Reconfirm delivery flags/pricing unchanged, monitor pending/review queues, and coordinate the schema/frontend/PWA update so old clients fail closed and refresh. Run a controlled single-vendor smoke test with agreed support coverage; reconcile bank receipt, commission and refund evidence. Do not infer readiness from a successful build.

## Rollback / stop procedure

Disable `manual_eft` and `manual_payshap` using existing administrator gateway controls or audited `admin_manual_settings(false,false,15,500,'…incident reason…')`; verify checkout blocks and pending order instructions remain recoverable. Communicate directly through approved support operations; this task sends no messages. Pause fulfilment of disputed orders and reconcile already sent transfers with vendors. Retain all profiles, recipient snapshots, payment/refund events and commission entries.

Do not blindly reverse the migration or roll back to an old gateway-enabled frontend. The safe fallback is a checkout-unavailable frontend with both gateways still blocked; preserve historical callback routes and existing-order support. A subsequent reviewed forward migration can restore the old creation API/view only if no outstanding manual orders/receivables are made unsafe. No DROP/TRUNCATE/reset or automatic gateway reactivation is part of rollback.
