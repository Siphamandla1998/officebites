# Payment and delivery pilot readiness — 22 October 2026

## Business clarification and latest local phase

The owner clarified on 22 October: **Eduvos collection is R0 only; paid collection is not authorised.** The R10 collection requirement was an error and is removed from scope. R10 remains only a potential separately approved delivery service. No delivery fee recipient, settlement or refund obligation is assumed. The existing inactive R15 delivery policy and the original R0 booking foundation are preserved.

The atomic collection phase now implements the local checkout integration, checkout-time agreement snapshots, scoped EFT activation lock, configuration revisions/idempotency, protected booking reads and native PostgreSQL race tests. See [current phase results](atomic-collection-local-20261022.md) for the latest inventory, evidence and remaining blockers. The sections below retain the earlier audit/checkpoint and its original counts; statements about missing local integration/native tests there are superseded by that phase report. **Hosted UAT and live launch remain NO-GO.** No hosted state was changed or freshly attested during the atomic phase.

**NO-GO for hosted UAT and live launch.** Target week: 26 October 2026. This review does not authorise hosted changes or promise that date. Branch `feat/vendor-direct-launch-payments`; HEAD remains `695e5e19cf581f6202dcc058afad1ee2fba23208`. No commit, push, deployment, hosted migration, account or order creation occurred.

## Verified staging baseline

Read-only `get_project` confirmed `eyhmarmekioovcjibcbr`, `officebites-staging`, ACTIVE_HEALTHY, PostgreSQL 17. SQL observation **22 October 2026 12:59:50 UTC / 14:59:50 SAST**:

| Item | Observed value |
| --- | --- |
| Manual EFT / PayShap | Both disabled; ready true; maintenance false |
| PayFast | Disabled; ready true; maintenance true — readiness is not merchant authorisation |
| Ozow | Disabled; ready false; maintenance true |
| Payment deadline / review threshold | 15 minutes / R500 |
| Existing delivery | Disabled; R15; revision 2; hub pin unverified; activation not ready |
| Orders / manual payments / vendor payment profiles | 15 / 0 / 0 |

Only project metadata and SELECT queries were used. No production project was queried. Vercel configuration and domains were not changed or freshly re-attested in this task. The previously verified Preview/release provenance is recorded in `complete-staging-release-results-20261022.md`; this local work is not present there until a separately approved release.

## Existing features reused

| Area | Existing implementation and evidence |
| --- | --- |
| Vendor → menu → cart | Vendor/menu UI and `CartContext.jsx`; vendor replacement confirmation; backend single-vendor validation in `create_manual_order` |
| Guest checkout | Validated mobile, server-priced meal items, weekday availability, protected ticket/contact recovery and payment token; request-key/payload-matching idempotency |
| Payment eligibility | `get_vendor_manual_methods` checks active approved vendor/owner, independently approved profile, method support and enabled/ready/not-maintenance gateway. Checkout displays only eligible EFT/PayShap; no eligible method preserves cart |
| Banking onboarding | `ManualPaymentWorkspace.jsx`: vendor submits EFT/PayShap profile, pending version, independent admin approval/evidence; vendor cannot approve their own submission. Existing workflows need fixture/onboarding UAT, not a replacement banking feature |
| Instructions and settlement | Immutable approved recipient/amount/deadline; copy from protected order snapshot; customer report is a claim, not receipt; vendor/admin receipt reconciliation; no bank transfer initiated by OfficeBites |
| Delivery | Existing central-hub/radius/GPS quote model, quote expiry/cart/identity/revision validation, approved vendor-origin workflow, immutable suborder delivery snapshots. `20261016090258` and `20261016092359` implement these; reuse rather than overwrite |
| Scheduling | `meals.available_days` server-checked; `useDeliveryDate` and `create_order_core` enforce previous-day 19:00 SAST cutoff. `collection_time` text and catering `event_booking_requests` are not capacity reservations |
| Order safety | Pending payment, report/review/receipt states; paid-only fulfilment; unpaid cancellation; reported payment cancellation requires reconciliation; dispute/full-refund fulfilment holds; refund records and separate receivables; idempotent receipt and commission entry |
| Admin settings | Corrected singleton WHERE/exact-one update, active-admin validation/audits, frontend pending/reload/draft safeguards. Server revision/idempotency/activation interlock remains design-only |

## Local changes and their limits

1. `src/pages/customer/Checkout.jsx`: EFT first and default when both methods are eligible; explicit user selection and server eligibility remain authoritative. PayShap-only vendors remain selectable only when the backend permits them. **This is a preference, not the EFT-only staging activation interlock.** Separate PayShap UAT is still required.
2. `checks/manual-payments-browser.spec.mjs`: expectations and keyboard navigation updated for EFT first; existing unavailable, guest, support, cart and provider-blocking regressions retained.
3. `checks/pilot/booking-candidate.sql`: **isolated local prototype, outside the auto-applied migration directory**. Requires a local fixture marker; the marker prevents accidental use, not an environment attestation/security boundary. No public RPCs or table/function grants, no activation writer, no scheduler. Existing public function definitions and R15 settings are unchanged by installation.
4. `checks/pilot/booking-database.mjs`: integrated tests use the existing real migration/function fixture and synthetic vendor/profile/order data entirely inside disposable PGlite. `checks/checkout-database.mjs` adds one invocation before the pre-existing recovery/security tests; the unrelated existing imports are preserved.

The prototype supplies separate disabled policy, admin-curated destination IDs (Eduvos collection / Umhlanga / Gateway), separate vendor/mode windows, preparation time, cutoff, capacity, immutable reservation snapshots, expiring unpaid holds and cancellation release. Default fees are R0/R10 in database configuration, not permanent client constants. Delivery quotes fail closed without recipient/settlement approval. There is no vendor-origin switch in this policy; origin is CENTRAL.

Reservation acquisition locks the order, payment, policy, window and destination before validating price and capacity. Window row locking serialises capacity admission; one order and one request key cannot create duplicate reservations. Existing confirmed reservations count; expired held reservations stop counting without depending on cron. Customer reports do not extend holds. Verification of an expired reservation fails in the same transaction, rolling back provisional paid/commission transitions. A refund alone does not release a slot; the existing controlled cancellation after reconciliation does. Partial refunds/disputes retain the reservation until an authorised operational decision.

**Not implemented or claimed ready:** public booking/configuration RPCs, customer mode/day/window controls, admin window/destination controls, controlled rescheduling, atomic order/fee adapter, stable checkout-time commission snapshot, native multi-connection concurrency verification and hosted tests. Do not deploy the prototype as a complete feature. The explicit fee mismatch test rejects a current R70 order for an R80 delivery quote: silently appending R10 after the immutable payment snapshot would be unsafe.

## Launch blockers, owners and smallest fixes

| Blocker | Evidence / required action | Owner |
| --- | --- | --- |
| Hosted UAT isolation still NO-GO | Existing operator checklist: authoritative effective PostgREST service/override evidence and independent notification-channel inventory/non-delivery confirmation missing. SQL catalog values are not service proof. Complete existing support/operator evidence, then separately approved installation/transport verification | Operator / Supabase Support |
| No approved vendor recipient | Fresh staging count: zero payment profiles. Reuse existing vendor submission + independent admin approval; no real bank information in synthetic UAT | Vendor / independent admin |
| Delivery fee custody/settlement undefined | Customer currently pays one vendor; no authorised provider split. Decide who is entitled to R10, who receives it, vendor-to-delivery-operator settlement/invoice, refunds and failed delivery. Keep paid delivery blocked meanwhile | Business owner / vendor / delivery operator / legal-commercial review |
| Pickup point and dispatch operation unapproved | Hub pin unverified; R15 activation flag false. Approve exact pickup point, approved destination IDs, staffed windows, capacities and handover responsibility. No arbitrary typed address should qualify | Campus/operator / admin |
| Booking not connected to order transaction | Candidate only. Implement one atomic pricing + order + immutable manual-payment + reservation transaction, reusing guest/auth/payment checks and idempotency. Reject old checkout paths while pilot enforcement is active; preserve historical reconciliation | Engineering, local next work |
| Customer/admin booking interfaces absent | Current checkout has delivery text and next orderable date, not collection/day/slot controls. Add minimal mode, approved point and future available-window selection after stable server contract; admin manages destination/window capacity with revision/reason | Engineering / operator |
| Activation concurrency protection absent | Existing design `admin-payment-settings-safety-design-20261021.md`: one revision/request ledger/interlock across BOTH admin writers and initiation/eligibility. Locked by default; scoped EFT-only unlock with expiry; legacy writers fail closed; disabling and history remain available | Engineering + separately authorised operator |
| Fee agreement snapshot timing | `private.snapshot_paid_commission` captures current vendor rate at receipt verification. Standard default is 17%, but this is not proof of each vendor's agreement. Freeze agreed eligible food rate/base at checkout; preserve existing historical paid snapshots | Engineering / vendor agreement approver |
| Delivery admin singleton UPDATE risk | `admin_save_delivery_hub` in `20261016090258` uses an UPDATE without WHERE (lines around 100–102). Same pattern as the fixed manual-settings error. Not executed against hosted staging here. If this path is retained, a targeted forward fix needs singleton predicate/exact-one guard, auth/audit/revision preservation and local tests | Engineering |
| Real parallel transaction proof absent | PGlite runs one database engine; 54 booking assertions do not prove native independent-session races/deadlock behaviour. Neither psql nor docker was available on PATH in this session. Run native PostgreSQL 17 tests with real concurrent transactions before promotion | Engineering / local test environment |

No new payment provider integration is required for a synthetic, no-funds manual EFT order. Live vendor agreements, actual recipient verification, notification/privacy/legal readiness and staffed reconciliation are additional live-launch requirements. PayFast/Ozow merchant approval must never be inferred.

## Proposed minimal contract and migration sequence — not approved to execute

Do not use a bulk `db push`: it could include excluded UAT security work. Generate reviewed forward migrations only after the final local design/tests; the local prototype is not one of those migrations.

1. Capture fresh definitions/owners/ACL/RLS, settings, gateway metadata, delivery policy, order/ledger counts and recovery checkpoint. Reconfirm exact staging project and operator approval. Resolve notification/PostgREST evidence using existing runbooks; keep all methods off throughout installation.
2. Install separately reviewed settings revision/idempotency/locked activation interlock in one transaction, covering `admin_manual_settings`, `admin_update_payment_gateway`, method eligibility and new initiation. Reconcile existing clients; retain historical receipt/refund/callback processing. Test recovery before approval.
3. Add disabled pilot policy/destinations/windows/bookings and append-only configuration audit with no existing-row backfill. Defaults R0/R10; existing R15 singleton remains intact. Add active-admin configuration wrappers with expected revision, idempotency, reason and server validation. Initial destinations/windows remain unavailable until explicitly approved. Central-only is enforced server-side.
4. Add a versioned atomic checkout contract: existing identity/cart/method plus mode, destination ID, window ID, policy/window revision and request UUID. Hash all inputs server-side; matching request replays original result, changed payload rejects. Price food + configured fee once; snapshot agreed 17% eligible food basis/rate and delivery beneficiary separately BEFORE exposing immutable payment instructions. Save order/payment/booking/snapshots in one commit. Reuse the original eligibility and RLS checks. No payment instructions on failed reservation. Do not guess settlement for R10.
5. Lock-order/native concurrency and SQL/RLS tests must pass before installing the checkout adapter. Quote is availability information, not a reservation. Revalidate under the window lock and serialize concurrent same-request operations. Rescheduling, if needed later, locks old/new windows in UUID order and records old/new snapshots, actor and reason; no silent snapshot overwrite. For the first pilot, use cancellation/reconciliation and a new order rather than expose an untested rescheduler.
6. Release only the minimal checkout/admin booking UI against the versioned contract after separately approved staging migration and Preview deployment. Mixed-version clients must fail closed when pilot enforcement is on. No silent fallback to old free-text/R15 checkout.
7. Complete separately approved synthetic onboarding and bounded EFT-only test: guest order → exact snapshot/capacity check → customer report remains unpaid → vendor simulated receipt → 17% food receivable once → fulfil/handover → refund/cancellation/late-payment cases → disable EFT. No real funds. PayShap remains disabled until its own approval/UAT. All four methods disabled at closeout, 15 minutes/R500 retained.

## Validation evidence

Commands use the existing local Node 22 runtime and installed dependencies. No dependency or lockfile changes.

| Check | Result / boundary |
| --- | --- |
| `node checks/checkout-database.mjs` | **535 assertions passed**: existing 481 plus 54 booking assertions. `.officebites-local/pilot-database-20261022.log` |
| New booking coverage | R0 collection; approved Gateway AND Umhlanga R10 quote; unapproved/outside-area rejection; settlement approval; mode/vendor/revision/cutoff/lead-time/capacity rejection; immutable/replayed snapshots; disabled direct client reads/writes/RPC; customer report stays unpaid; receipt/commission once; cancellation release; expired hold capacity and atomic failed receipt rollback; existing R15/public functions unchanged |
| Browser regression | **38 passed (2.8 minutes)**, existing checkout and manual-payment suites, mobile/desktop and keyboard selection; local harness only, hosted Supabase requests blocked. `.officebites-local/pilot-browser-20261022.log` |
| Lint | Completed with existing warnings; `.officebites-local/pilot-lint-20261022.log` |
| PWA build | Generated service worker, 125 precache entries; `.officebites-local/pilot-pwa-build-20261022.log` |
| Not covered | Native parallel capacity/revision races, new booking UI/browser flows, actual R80 delivery order/recipient accounting, controlled rescheduling, hosted Auth/REST/notification/booking/payment transport |

A test-only clock fixture temporarily disables ONLY the candidate booking immutability trigger, ages one reservation and immediately restores it. This is not a production expiry API or a restoration procedure. Existing refund/dispute and guest/vendor/admin protections run in the same database chain. Browser regression does not prove a new booking UI exists.

## Recovery, audit and stop conditions

- Current recovery is simply discard the disposable PGlite database; no hosted change was made. Preserve the pre-existing local security recovery evidence and never restore an absent email hook as proof of suppression.
- Before any future hosted release: test an explicit disable-new-initiation procedure with historical receipt/refund access intact. Disable pilot/EFT initiation first; leave PayShap/PayFast/Ozow off. Preserve policy versions, payment/booking snapshots, request keys and all financial/audit history. Do not delete reservations or restore an old unchecked writer. A UI rollback must not reopen the legacy unchecked checkout path.
- For unpaid, unreported cancelled orders, release reservation transactionally; expired holds cease counting. Reported/late money, disputes and paid cancellations require receipt/refund reconciliation. Never auto-confirm payment to recover a slot. Existing confirmed meals/delivery obligations must remain visible and honoured or refunded through the vendor.
- Reconcile before/after counts for orders, payment attempts, profiles, receivables and audit events. One logical request → one order, booking and successful settings audit sequence; replay → no additional mutation/audit success. Delivery fees never enter food commission. Vendor receives only the approved total and approved recipient snapshot.
- Stop on drift, unknown environment, notification delivery, gate bypass, unexpected activation, duplicate/mismatched snapshots, capacity violations, changed commission agreement, inability to reconcile an uncertain request, or missing independent approval. No automatic destructive rollback.

## Decision and next action

**NO-GO: hosted UAT. NO-GO: one-vendor live pilot.** The shortest lower-risk route is a collection-first, EFT-only pilot AFTER the existing isolation evidence, approved pickup operation, atomic booking integration, activation protection and synthetic UAT pass. This avoids the unresolved delivery-settlement dependency but does not remove booking/payment safety requirements. Add R10 delivery only after its operational/settlement approval and separate tests.

Next executable work remains local: finish and test the atomic collection/order adapter plus minimal mode/window UI and the already-designed settings interlock; operator work can proceed in parallel on PostgREST/notification evidence and pickup/settlement decisions. No hosted installation or payment activation is requested by this document. Present the final migration/artifact, recovery evidence and exact bounded operations for separate explicit approval before any hosted work.

Task file inventory: `src/pages/customer/Checkout.jsx`, `checks/manual-payments-browser.spec.mjs`, the single pilot import in `checks/checkout-database.mjs`, `checks/pilot/booking-candidate.sql`, `checks/pilot/booking-database.mjs`, `checks/pilot/README.md`, and this report. Existing recovery/security imports and all unrelated uncommitted files were preserved. No file under `supabase/migrations` was changed or added.

Security review reference: [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), consulted for explicit grants plus RLS. The changelog Markdown fetch returned an unsupported-content-type error; no assertion about newly changed Supabase service capabilities is based on that failed fetch.
