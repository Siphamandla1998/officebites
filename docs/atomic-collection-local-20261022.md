# Atomic R0 collection — local implementation results, 22 October 2026

**Hosted UAT: NO-GO. Live pilot: NO-GO.** Local checkout/booking integration is implemented and exercised; it is not installed on staging. Branch remains `feat/vendor-direct-launch-payments`, HEAD `695e5e19cf581f6202dcc058afad1ee2fba23208`. No commits, pushes, deployment, hosted configuration, hosted accounts/orders, banking changes or payment activation occurred.

## Owner clarification

- Eduvos collection costs **R0**. Paid collection is excluded.
- R10 refers only to a potential approved-area delivery service needing separate approval. No fee recipient or refund obligation is inferred.
- Existing inactive R15 delivery settings are unchanged. The original collection foundation is retained; this phase adds an atomic extension.
- PayFast/Ozow remain blocked for new marketplace payments. The new collection contract permits EFT only; PayShap requires separate UAT and a later reviewed change. Historical payment verification/reconciliation is retained.

The last hosted observation remains the preceding report's read-only 14:59:50 SAST checkpoint: all four disabled, 15 minutes/R500, delivery disabled/R15/revision 2, 15 historical orders and zero manual payments/profiles. **This phase did not re-query or modify hosted settings.** Local test fixture enablement is a disposable simulation, not hosted activation.

## Reused lifecycle and minimal integration

The existing server-priced `create_manual_order`, approved banking profiles, guest identity checks, payment tokens, receipt verification, refund/dispute/receivable lifecycle and paid-only fulfilment remain authoritative. The new API does not create an alternative order state machine or collect/split vendor funds.

`create_collection_order` accepts identity/cart/method, stable request UUID, approved window/destination IDs and expected policy/window revisions. It accepts no fee or commission from the browser. It:

1. Validates authenticated identity/active account or permitted guest name/mobile.
2. Locks the request key and compares the entire canonical payload on replay; a changed payload or key already used by a different checkout fails.
3. Locks enabled policy, unexpired EFT authorisation, available collection window and approved Eduvos destination. Rejects stale revisions, wrong vendor/mode, full/expired windows, preparation lead-time and previous-day 19:00 SAST cutoff violations.
4. Requires an independently approved commission agreement version and ordinary vendor/profile/gateway eligibility. Rejects active legacy delivery enforcement or vendor-specific origin, without changing either policy.
5. Calls the existing manual-order creation implementation privately. Creates one order, existing recipient/reference/payment snapshot, private checkout-time financial snapshot, immutable R0 reservation, request mapping and durable captured event in the **same transaction**.
6. Returns protected payment access only with the successful result. A deferred constraint checks reservation/authorisation expiry again at commit; an expired transaction rolls back completely.

Legacy `create_manual_order` cannot bypass booking enforcement. The collection eligibility wrapper masks PayShap and requires both enabled policy and unexpired EFT approval. A private gateway trigger enforces the same lock through BOTH existing admin gateway-writing paths, including direct RPC requests. Defaults are locked; neither collection admin RPC exposes policy activation or unlock. There is **no approved hosted operator unlock procedure in this artifact**; its attestation/actor/audit/expiry process must be reviewed separately before any hosted installation or UAT activation. A local fixture marker is not proof of a staging environment.

Commission snapshots store vendor ID/name, signed agreement ID/version/monotonic revision, actual agreed rate, eligible food subtotal, commission, R0 fee, approved payment profile ID and reference. Agreement selection follows locked configuration revision rather than transaction-start timestamps. The paid transition reads this snapshot, preserving older historical behaviour for non-collection orders. A later global/vendor rate cannot recalculate the order. The default standard total remains 17%; a new agreement override requires explicit independent admin evidence. The 2% component is not described as an actual processor charge.

The existing receipt function additionally rejects changed amount/reference on a paid collection replay. Refund status replay stores and compares amount/product allocation/evidence atomically; mismatched replay rejects. Repeated reconciled full-refund cancellation does not append another cancellation success event. Customer reports remain unpaid and do not extend reservation TTL; full refund alone does not release capacity until controlled cancellation.

## Customer and administrator UI

- Checkout fetches server-approved options and offers collection day/window selection, full pickup label, R0 fee, total and EFT only. Delivery is explicitly unavailable for this collection pilot. No banking details appear in the availability response.
- Missing windows preserve the cart; loading/errors/stale revisions block checkout. No transport error falls back to a delivery order. The existing old-release path is retained only when the optional read RPC is absent (`PGRST202`) or policy disabled; the server still prevents bypass once installed/enforced.
- Payment instructions show the protected collection snapshot and expiry state; payment reporting never claims settlement. Expired/released bookings disable reporting and explain independent reconciliation.
- Admin payment dashboard adds collection pickup-point, window/capacity/cutoff/availability and agreement-version controls. Server checks active-admin permission, independent agreement approval, revision, request payload and audit reason. Capacity cannot drop below active reservations; booked vendor/start/end cannot be rewritten. Rescheduling remains intentionally unavailable; use independently reconciled cancellation/new booking.
- Pending/uncertain admin mutations lock editing; confirmed success clears reason. Reload failure is distinguished from mutation failure. A deliberate retry after an uncertain response retains the original request UUID AND expected revision, preventing duplicate creation after reconciliation. There are no automatic mutation retries.

## Security and notification boundaries

Private agreement, financial, request, activation, refund-replay and outbox tables have RLS enabled and no client/service-role table grants. Immutable history triggers protect snapshots/request mappings. Public functions revoke PUBLIC execution and explicitly grant only required anon/authenticated reads/checkout; admin functions are authenticated plus active-admin checked. Banking instructions retain their existing protected token/customer/vendor/admin access checks. New booking reads deny unrelated vendors/customers and unauthorised guests. Vendors cannot change the private commission snapshot or its food/vendor basis through suborder edits.

The outbox captures only order ID, event type and timestamp, with `(order_id,event)` deduplication. Creation, report, verified payment and cancellation capture commits atomically; aborted transactions leave no event. **No sender, recipient resolver, retry worker or external notification transport was added or enabled.** Before adding a sender, require a separately reviewed delivery ledger, per-recipient/event deduplication, claim/lease/retry limits and idempotent provider/capture handoff; the immutable outbox is not a finished delivery worker.

Existing independent email/SMS/push/MFA/scheduled/Edge/operational channels and hosted Auth suppression remain subject to the existing operator checklist. Native SQL grants/RLS tests are not authoritative hosted PostgREST configuration or transport evidence. Keep the PostgREST and notification-isolation blockers unchanged; no real notification probes were performed.

## Executed validation

| Check | Actual result / evidence |
| --- | --- |
| Integrated PGlite SQL | **602 assertions passed**, including the existing 535 plus 67 atomic collection assertions; `.officebites-local/atomic-collection-database.log` |
| Native PostgreSQL 17.10 | **628 assertions passed** on the same fixture, including **26 native concurrency assertions**; `.officebites-local/atomic-collection-native.log`. This is a separate run, not 628 additional independent tests |
| Service contract/state regressions | **70 passed**; `node checks/checkout-repair.mjs`. Verifies collection RPC argument contract excludes client fee/date/address and retains normal identity checks |
| Browser suite | **71 passed**, existing full harness excluding its explicitly unmocked hosted-style test; `.officebites-local/atomic-collection-browser.log` |
| Final focused UI check | **5 passed** after final UI changes; collection mobile/desktop/keyboard, empty/error state, protected expiry, admin save and uncertain-response replay; `.officebites-local/atomic-collection-browser-focused.log`. Four overlap the earlier full suite; the uncertain-response case is new |
| Lint / production PWA | Passed with existing warnings; final logs `.officebites-local/atomic-collection-lint.log`, `.officebites-local/atomic-collection-pwa.log`. No application dependency/lockfile changes |

Native tests use independent connections and observe `pg_blocking_pids` barriers for final-slot contention, same-key replay, duplicate verification, cancellation versus verification and admin window changes. Profile approval overlaps an uncommitted checkout and preserves the already approved recipient snapshot. Expiry uses an observed server-clock barrier followed by an actual failed COMMIT, proving no order/outbox survives. It does not assume sleep duration establishes concurrency. SQL failure injection at orders, items, manual payment, financial snapshot, booking, request mapping and outbox insert proves full rollback. Receipt/commission/refund replay, stop-new-initiation while historical receipt still works, expired unlock and private-table/unauthorised RPC access are also exercised.

The local PostgreSQL runtime initially failed with `0xC0000135`; dependency inspection identified an absent runtime DLL in its binary directory/System32. Adding the existing Edge runtime directory to that process's PATH allowed PostgreSQL 17.10 to run; no Windows runtime/service was installed. Packages were pinned in ignored `.officebites-local/native-runtime` (`@embedded-postgres/windows-x64@17.10.0-beta.17`, `pg@8.16.3`, install scripts disabled), not app dependencies. Tests bind only `127.0.0.1:55432`, fixed database `officebites_local_atomic`; client/bootstrap verify the exact workspace data directory before use/reset. The disposable server is stopped after validation.

Screenshots: `.officebites-local/atomic-collection-visuals/checkout-390.png` and `checkout-1440.png`. These are synthetic local screens, not staging evidence.

Final read-only local closeout passed: all four fixture gateways disabled, collection policy disabled, EFT authorisation cleared, deadline 15 minutes, threshold R500 and legacy fee R15. Evidence: `.officebites-local/atomic-collection-closeout.json`, explicitly labelled **not hosted staging**. The disposable PostgreSQL server stopped successfully. Reproduction commands are in `checks/pilot/README.md`.

## Files changed in this phase

Runtime source: `src/pages/customer/Checkout.jsx`, `src/pages/customer/PaymentUpload.jsx`, `src/pages/admin/AdminPayments.jsx`, `src/services/orderService.js`; new `src/services/collectionService.js`, `src/components/features/CollectionBooking.jsx`, `src/components/features/CollectionAdmin.jsx`, `src/utils/collection.js`.

Tests: `checks/browser-harness.jsx`, `checks/manual-payments-browser.spec.mjs`, `checks/checkout-repair.mjs`, `checks/checkout-database.mjs`; new `checks/pilot/atomic-collection-candidate.sql`, `atomic-collection-database.mjs`, `native-client.mjs`, `native-bootstrap.mjs`, `native-concurrency.mjs`, `native-runtime-diagnostic.mjs`.

Documentation: `checks/pilot/README.md`, `docs/payment-delivery-launch-readiness-20261022.md`, this report. Original `booking-candidate.sql` and its safety constraints are preserved. Unrelated release/preparation/security work and existing imports are preserved. No files in `supabase/migrations`, root package manifests or deployment configuration were changed.

## Migration preparation and recovery

SQL remains **local candidates outside automatic migrations**, not a staging-approved installer. Dependencies: original manual-payment migration, corrected singleton migration `20261021094956` (hosted version `20261021100655`), then booking foundation, then atomic extension. Do not bulk-push pending migrations. Promotion requires a freshly captured exact function/owner/ACL/schema baseline and project attestation for `eyhmarmekioovcjibcbr`; generate a forward migration with the Supabase CLI after that review. Definition patches intentionally fail on unexpected source drift. Grants and private-function moves require explicit review against the actual hosted function signatures.

Rollback for a future installed pilot must **stop new initiation**, not erase financial history: separately authorised operator disables policy, clears EFT authorisation, and disables all four flags while preserving 15 minutes/R500. Preserve ready/maintenance/provider secrets, original R15 policy, orders, recipient/commission/booking snapshots, requests, outbox and audits. Existing receipt/refund/reconciliation routines and the dual historical/collection commission reader must remain. A UI rollback must never reopen a legacy unchecked order-creation route. Tested local stop behaviour denies new orders and still permits an authorised receipt on an existing valid reservation. Late/expired receipt remains a reconciliation/refund case; do not auto-reserve capacity or mark it paid to force recovery.

Before any new collection orders exist, a separately reviewed full definition/ACL restoration could be considered against captured baselines. After any exist, restoring the old commission calculation would lose the checkout agreement guarantee; use a forward repair and retain the new snapshot reader. No destructive rollback or hosted restoration was executed or authorised by these local tests.

## Remaining blockers and supervised staging sequence

1. **Critical — hosted isolation:** operator/Supabase Support must supply authoritative effective PostgREST service/override evidence and complete independent notification-channel isolation evidence. Reuse existing checklist; missing values are unknown, not defaults. No hosted writes until evidence and applicable conditional installation approval are reconciled.
2. **High — migration/activation operator controls:** review a project-attested forward installer, recovery checkpoint and separately authorised bounded EFT unlock with actor, approval reference, revision, expiry and immutable audit. The normal app admin cannot perform that unlock. Existing general manual-settings revision/idempotency redesign remains separate; the new collection config contract supplies those protections for booking configuration, not all legacy admin operations.
3. **High — operations/onboarding:** approve exact Eduvos pickup point, staffed windows/capacity/cutoffs, one vendor's actual agreement, and independent recipient ownership. Use synthetic fixtures first under explicit provisioning/profile approval. No real banking values in local tests.
4. **High — hosted transport/UAT:** after separate SQL/security/Preview approvals, verify actual REST/RPC schema cache, permissions, inactive defaults and legacy-path blocking. Then separately authorise one bounded synthetic R0/EFT order, customer report (unpaid), vendor simulated receipt, commission once, handover, cancellation/refund/expiry and closeout. No transfer. Reconcile order/payment/profile/booking/receivable/audit counts before and after. PayShap/PayFast/Ozow stay off.
5. **Deferred — delivery:** no R10 delivery acceptance, recipient/refund allocation, vendor-specific origin or changes to inactive R15 policy in this phase. Requires separate business/operational approval and implementation/UAT. Paid collection is not on the roadmap.

Stop on unknown environment, drift, notification delivery, gate bypass, unexpected activation, mismatched agreement/recipient/booking snapshot, duplicate financial events, capacity violation or unresolved request outcome. No automatic hosted mutation retry or destructive rollback.

**Recommendation:** accept the local collection integration for review; do not install or launch yet. Next executable external action remains the operator's existing read-only PostgREST/notification evidence package. Once accepted, present exact installation, recovery and bounded UAT operations for separate explicit approval. No hosted action is requested by this report.

References consulted: [PostgreSQL 17 locks](https://www.postgresql.org/docs/17/explicit-locking.html), [deferred constraint triggers](https://www.postgresql.org/docs/17/sql-createtrigger.html), [native runtime source](https://github.com/leinelissen/embedded-postgres). Supabase changelog Markdown fetch remained unsupported; no hosted configuration capability is inferred from it.
