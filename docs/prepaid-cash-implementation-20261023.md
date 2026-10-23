# Prepaid vendor cash and EFT local implementation — 23 October 2026

Status: local implementation; hosted UAT and launch NO-GO. Branch `feat/vendor-direct-launch-payments`, deployed baseline `695e5e19cf581f6202dcc058afad1ee2fba23208`. No hosted changes or commits.

## Executed validation

- PGlite: 662 assertions passed (`.officebites-local/prepaid-pglite.log`).
- Native PostgreSQL: 691 assertions passed (`.officebites-local/prepaid-native-final.log`), including 26 existing observed-lock concurrency assertions and three duplicate prepaid-cash concurrency assertions. The latter use parallel connections and verify one order/receipt/commission; they do not prove every cash race.
- Service/state suite: 70 assertions passed (`.officebites-local/prepaid-services.log`).
- Rebuilt browser harness: 24 payment regression tests passed (`.officebites-local/prepaid-browser-final.log`); one separate prepaid-cash mobile receipt test passed. An earlier broad browser run was interrupted and is not counted as a complete pass.
- Focused and full lint passed after correcting duplicate JSX and a handler name interpreted as a hook; existing full-project warnings remain.
- Production build and PWA generation passed (129 precache entries). Harness build passed. The final redundant ternary cleanup preserves rendered behaviour.
- Local PostgreSQL server stopped after testing. Fixture closeout restores gateway and activation locks. No current hosted state is inferred from local results.

Remaining development/verification gaps: dedicated full vendor-assisted form browser tests and automated accessibility audit; broader cash cancellation/capacity/receipt race coverage; adversarial handover tests; new-candidate recovery rehearsal. These prevent calling the entire feature set fully validated or ready for hosted installation. Optional proof uploads remain unavailable pending protected quarantine and malware controls.

## Implemented

Vendor/admin assisted dashboard entry reuses the existing order, suborder, booking and commission infrastructure. Customer name, phone, optional email, items, quantities, approved future date/window and request evidence are validated. Vendor cash requires independent recipient authorisation and a disabled, expiring cash gate. Cash receipt, order creation, commission snapshot and confirmed capacity commit together. Missing/partial cash rejects creation. Successful paid capacity does not expire with the unpaid timer. Duplicate requests/receipts replay safely or reject changed payloads. Vendors are scoped to their own orders. Cash remains excluded from platform-held financial sales/payouts.

EFT requires the latest submitted profile to be independently approved and not revoked. Checkout captures recipient, reference, server total and agreement snapshot. Customer reporting never verifies funds. Authorised bank verification requires evidence; partial/overpaid receipts require review. Refunds use existing append-only financial adjustments and independently reconciled cancellation.

Cash receipt snapshots identify actual custodian, beneficiary, amount, ZAR currency, actor and server timestamp. Restricted custody reporting separates receipt, vendor balance and commission liability. Customer receipt view does not expose internal settlement information. Structured requests use protected access tokens, rate limits and single conversion. Requests do not reserve capacity or confirm payment.

## Candidate SQL and affected files

No migration in `supabase/migrations` was added or edited for this work. Local-only candidates, guarded by a fixture marker, are:

- `checks/pilot/booking-candidate.sql` and `atomic-collection-candidate.sql` (existing collection dependencies).
- `checks/pilot/assisted-cash-candidate.sql`.
- `checks/pilot/cash-custody-candidate.sql`.

Frontend: `AssistedOrders.jsx`, `CashCustody.jsx`, `CustomerOrderRequest.jsx`; integration in `AdminOverview.jsx`, `VendorOrders.jsx`, `Checkout.jsx`, `PaymentUpload.jsx`; `assistedOrderService.js`. Tests: browser harness/payment spec, checkout database runner, assisted-cash database assertions. The existing booking test's cutoff fixture was made deterministic. Other working-tree changes predate this task and must be reviewed separately before any commit.

## Cash custody boundary

Vendor-received cash has no admin handover obligation. Admin cash creation has a separate disabled policy lock, even if vendor cash is unlocked in a disposable test. The foundation stores immutable receipt and handover declarations/events, recipient acknowledgement, disputes and reversals. Sender declaration alone cannot reconcile a handover. Partial and bank handovers default disabled. No automatic transfer or commission deduction occurs.

Admin custody is NOT approved or ready for activation. Gross/net settlement must be explicitly decided before exposing a collection workflow. Required owner decisions: named custodians, storage/security, handover deadline, gross/net and commission invoicing/tax treatment, refund responsibility while funds move, discrepancies, partial transfers, transfer evidence and independent acknowledgement. Finance/legal review remains required. The custody foundation needs dedicated adversarial/concurrency review before installation.

## Operations and stop conditions

Before physically taking cash, check the vendor, menu, approved service date/window, current total and capacity. This precheck cannot guarantee capacity until commit. Submit once with a stable request/receipt identifier. If the response is uncertain, reconcile that identifier before another receipt or order. If physical cash was received but creation fails, return it or use an independently approved exception process; never fabricate an order. Supply the official reference, summary and protected tracking only after success. Use approved consent-compliant notifications; current isolation blockers prohibit delivery testing.

Vendor refunds are actual physical returns followed by independent financial reconciliation. Preserve original receipt and commission snapshots. Cancellation releases confirmed capacity only through the approved refund/cancellation flow. Never mark customer payment unpaid because a settlement is outstanding.

## Installation/recovery plan — requires separate approval

Capture current definitions/owners/grants, schema and financial row counts. Resolve existing notification and effective PostgREST evidence first. Review and generate forward migrations for collection, assisted payments, then custody dependencies; these fixture candidates are not hosted installers. Keep all gates locked and all four gateways disabled, 15 minutes/R500 baseline. Verify permissions, historical records, default-deny direct RPC access and notification isolation before synthetic provisioning. Run supervised staging tests before any separate activation approval.

On failure stop. Disable new-entry gates through an approved operation; preserve receipts, orders and adjustments. Do not drop financial tables, restore defective functions automatically or remove cash values from constraints while cash history exists. Restoring older UI cannot undo money already received. Reconcile committed/uncertain receipts and fulfil or refund before considering reviewed forward repair. Recovery must be rehearsed for these new candidates; previous security recovery tests do not prove cash migration recovery.

## Activation checklist

EFT: accepted PostgREST/RLS and notification evidence; independent synthetic bank approval; recipient/snapshot/verification/refund tests; approved operational ownership; supervised staging UAT; explicit technical and business activation approval.

Vendor cash: all EFT-independent security prerequisites; named independently authorised vendor recipient; native capacity/receipt races; customer tracking, privacy/mobile review; approved failure/refund procedures; reviewed forward migration and recovery rehearsal; supervised synthetic UAT and explicit vendor-cash approval.

Admin cash: all vendor-cash safeguards plus approved custody/settlement/refund policy, finance/legal review and dedicated reconciliation tests. Vendor-cash approval never unlocks admin custody.

R0 Eduvos collection remains the only approved collection price. R10 paid collection is prohibited. Inactive R15 delivery configuration is preserved. PayFast/Ozow and hosted EFT/cash remain disabled.
