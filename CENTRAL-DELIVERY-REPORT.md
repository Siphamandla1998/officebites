# Central hub and approved vendor origins — 16 October 2026

Implemented locally on `feat/checkout-ozow-distance-admin-controls`, preserving starting commit `8d4daed77583975aa834d2627dd38118465d0650` and its clean working tree. This request supersedes mandatory vendor GPS for delivery. No push, merge, frontend/Edge deployment or production database change is performed in this pass. Local feature commits are permitted; pushing would create a Vercel preview and is deferred under the no-deploy instruction.

## Policy and effective origins

Draft staging policy: OfficeBites — Eduvos Umhlanga, 1D Lunar Row, Umhlanga Ridge Boulevard, Umhlanga New Town Centre, 4319; 0.5 km free, 5 km maximum, R15 outer zone, straight-line Haversine distance. The previous owner-supplied candidate pin remains -29.721180,31.071621 and is explicitly **unverified**. Enforcement, owner fee confirmation and service checkout-readiness flags remain false.

Every vendor defaults to CENTRAL, with no requirement for business GPS or an editable profile radius. VENDOR mode uses a separate approved origin record and only an administrator can select it. Approval alone leaves CENTRAL selected. Approved vendor radius defaults to the hub policy or an admin-approved smaller cap, always bounded by the global maximum. Global free-radius/standard-fee rules apply. Invalid/inactive/suspended vendors cannot request changes or fulfil quoted delivery.

Quotes evaluate every cart vendor. Any undeliverable suborder rejects the whole quote with the vendor name. R15 is charged once if any vendor needs paid-zone delivery, otherwise zero. Per-vendor calculated charges are retained; one deterministic paid-zone vendor (sorted vendor ID) carries the checkout fee allocation for reconciliation. This allocation is bookkeeping, not vendor earnings or a payout entitlement, and requires final fee-structure review. Meal commission and processor-fee policies are unchanged.

Nearby discovery now uses effective origins when enforcement is enabled. When disabled, it does not hide vendors using an unverified geographic boundary, and returns no asserted delivery distance. Vendor profile text directs customers to checkout rather than advertising a vendor-editable radius.

## Approval and concurrency controls

Private RLS-protected origin/history tables have no customer/vendor direct-write grants. Authenticated owner requests require an active approved vendor and valid address/coordinates. Requests select CENTRAL and invalidate prior approval. Decisions require an active administrator, current request revision and a reason. Approve, reject, revoke, CENTRAL and VENDOR decisions record actor, timestamp, revision and details in history/business audit. Decision/invalidation notifications communicate the resulting mode to the vendor. No real vendor was modified or notified by testing.

Direct profile address/GPS/status/archive changes trigger approval invalidation and CENTRAL fallback. Existing vendor latitude/longitude/radius columns are preserved, but cannot authorize delivery from those coordinates. Suspended vendors cannot bypass the workflow by editing profiles. Origin, policy and vendor/owner locks plus quote version comparison prevent an old quote from silently using a revoked/changed origin. Quote creation and order creation recompute server-side; no browser fee or payment total is accepted. Settings changes invalidate quotes.

Order-time immutable per-suborder JSON snapshots contain mode, origin identifier/coordinates, destination, distance, policy/approval versions, radius/fee context, calculated charge and allocated checkout charge. Snapshot edits are refused. New unenforced orders also snapshot their context, with `quoteEnforced=false`, null destination/distance and zero delivery charge; no GPS is invented. Existing historical orders are not backfilled. Later hub edits, moves and revocation do not rewrite paid totals or snapshots. PayFast preparation still returns the authoritative stored order total.

An independent-session policy-lock probe was attempted but the receiver could not observe the lock holder through the connector. It is **inconclusive**, not passed. Two SQL scripts are supplied for independent staging SQL sessions. Sequential quote/revocation ordering and stale-version rejection pass; native simultaneous approval/revocation versus checkout still needs verification.

## Staging migrations

All changes were reviewed and dry-run in isolated PostgreSQL before staging. Earlier migrations were not replayed. No blanket db push was used.

| Source file | Installed staging history |
| --- | --- |
| 20261016090258_central_hub_vendor_origin_approval.sql | 20261016091616 |
| 20261016091839_central_hub_display_name_encoding.sql | 20261016092052 |
| 20261016092359_delivery_unenforced_order_snapshots.sql | 20261016092635 |

The second migration is a narrow forward correction: PowerShell's default encoding corrupted the em dash in the staged hub display name during transport. ASCII Unicode-escape SQL restores the intended default/name without touching fee, pin, approvals or history. Subsequent SQL reads explicitly use UTF-8. The third adds zero-charge context snapshots to new unenforced checkouts; it does not backfill existing orders. Source/history timestamp mappings must be reconciled before any future CLI workflow.

## Workflow descriptions

1. Vendor Settings → Delivery origin: CENTRAL/status shown, proposed address and coordinate inputs, GPS capture with accuracy/freshness validation, Request location approval, and approval history. No admin controls appear. Business profile can save without business GPS; its former editable radius no longer controls delivery.
2. Admin Payments → Checkout controls: hub name/address/map link, candidate pin, free/maximum radius, standard fee, explicit pin/owner-fee attestations and required configuration reason. Enforcement remains disabled while the service checkout-readiness flag is false. The old settings RPC cannot bypass that gate. Only the service-only `service_confirm_delivery_checks(revision,evidence)` can record reviewed checkout evidence; it was not called to enable this feature.
3. Admin Payments → Vendor-origin approval queue, or Admin Vendors → Delivery mode and approval: inspect proposed map pin/history, give a reason, approve/reject, then explicitly select VENDOR if approved. Revoke returns to CENTRAL and records/notifies the change. Stale decisions must reload.
4. Customer checkout: shows maximum delivery distance, each effective origin and distance, one delivery charge and the server quote expiry. Errors identify the undeliverable vendor; no quote means no enforced checkout.

## Validation and limits

- Full existing isolated regression runner passed. Expanded delivery suite: 59 assertions covering default CENTRAL without GPS, boundaries 0/0.5/0.51/5/5.01 km, approved vendor equivalents, request/approval/rejection/revocation, direct coordinate edits, suspended/unauthorized writes, stale revisions, mixed origins, one undeliverable vendor, once-only fees, immutable paid history, discovery and disabled-mode snapshots.
- Native staging: 12 existing checkout, 16 Ozow/subscription and 24 delivery assertions passed in explicit rollback transactions, including guest and authenticated SQL contexts. No real provider call or persistent fixture. Postchecks: zero QA Auth rows/origin requests, private RLS enabled, no member origin-table UPDATE privilege, enforcement/pin/fee/readiness gates false. These are database-context tests, not actual GoTrue/browser login.
- Browser: 25 tests passed using disposable Edge profiles. New synthetic journey requests a location as vendor, checks CENTRAL pending status, switches to admin, approves without changing mode, explicitly selects VENDOR, then revokes to CENTRAL. Hosted writes are blocked; one existing signed-out staging read story remains separate.
- Final focused rerun: customer delivery-quote and vendor/admin approval stories both passed after the profile/radius and quote UI edits. Final targeted lint, staging-mode build (117 PWA entries) and whitespace checks passed. Backend/checks are committed locally as `ce53257`; UI/report commit and final working-tree status are reported in chat. Neither local delivery commit is pushed.
- Lint/type-check/build/whitespace results and final expanded assertion count are recorded in TEST-RESULTS.md. No real payments, customer messages, order classification or existing account deletion occurred.
- Post-migration security advisors: 11 intentional private RLS/no-policy informational findings; seven anonymous and 39 authenticated SECURITY DEFINER API warnings; existing leaked-password protection warning. New callable functions were inspected for explicit actor/ownership/active-account guards and ACLs. No unrelated settings were changed. Remediation references: https://supabase.com/docs/guides/database/database-linter and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

Before activation: verify the exact operational Eduvos pin; confirm the once-per-checkout fee/allocation structure; perform actual authenticated and guest staging browser checkout; exercise real independent-session approval/revocation races and mobile GPS/PWA refresh; review evidence against the current policy revision. Save/review policy while disabled, record verified service evidence, and only then consider a separately authorized enablement/release. Ozow and paid subscription billing remain disabled and retain their earlier onboarding blockers.

## Changed files

Application: `src/components/features/CheckoutControls.jsx`, new `VendorDeliveryOrigin.jsx`; `src/pages/admin/AdminVendors.jsx`; customer `Checkout.jsx`, `VendorProfile.jsx`; vendor `VendorSettings.jsx`; `src/services/checkoutService.js`.

Checks: new `checks/delivery-origins.mjs`, `delivery-origins-staging.sql`, `delivery-policy-lock-holder.sql`, `delivery-policy-lock-staging.sql`; updated `checkout-database.mjs`, `checkout-staging.sql`, `browser-harness.jsx`, `recovery-browser.spec.mjs`.

Three migration files above, this report and the five development reports. Package/lockfiles, environment files, Edge Functions, PayFast signatures/notify logic, commission snapshots and PWA configuration are preserved.
