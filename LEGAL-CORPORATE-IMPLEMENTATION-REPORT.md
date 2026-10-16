# Legal, vendor and corporate acquisition implementation

## Follow-up verification — 16 October 2026

The working tree and this report were read before edits. Branch remains `feat/legal-vendor-corporate-acquisition`, HEAD `abebf8a7de14984e61a183b1fc257eba31a53811`. All prior local changes and installed staging versions remain preserved. This follow-up adds refund validation/replay regressions in `checks/legal-corporate-database.mjs`, adds `LEGAL-APPROVAL-CHECKLIST.md`, and updates this report. No application behaviour, migration, production configuration or charge activation was changed in this follow-up.

### Payment and checkout evidence

Staging history reconfirms installed legal framework `20261016095620`, reporting locks `20261016100710` and checkout-policy repair `20261016103515`; nothing was replayed. The policy helper is executable by authenticated callers and denied to anon. The native repair suite passed 18 assertions again: customer-owned history access/isolation, member and guest order creation, rejection of ownerless/unavailable vendors, unpaid progression rejection, service-only synthetic payment confirmation, independent sequential vendor acceptance/completion, and unchanged snapshots on confirmation replay. These are database role-scoped tests inside rollback, not valid-password browser login or a gateway payment/ITN.

Root causes and already-applied fixes remain detailed in `CHECKOUT-AUTH-PAYMENT-REPAIR-REPORT.md`: missing order-policy helper EXECUTE; approved but ownerless vendors; conflated payment/fulfilment labels; stale identity preflight; persisted temporary image URLs; and staging payment CORS. The original user-account Auth 400 still lacks its actual response code/body; a mocked or deliberately invalid login cannot diagnose that account. The exact reported vendor-approval screen remains unreproduced. No new root cause was inferred from HTTP status alone.

Read-only post-test inspection shows the same 6 unpaid/pending, 3 paid/confirmed and 1 paid/completed suborders, with zero acquisition, standard-component and refund ledger entries and zero published legal documents. Corporate charging, standard breakdown and onboarding enforcement remain false. These results do not establish complete production or browser readiness.

### Financial and legal conclusions

Native legal suite passed 22 assertions again, with all synthetic documents/accounts/orders and test-only activation bypasses rolled back. It verifies the 120-order R8,400 example: standard R1,428 (R1,260 platform plus R168 internal charge), acquisition R581 and illustrative R6,391 proceeds before unresolved provider/tax treatment. R20 then R50 acquisition refunds credit R2 then R5 at the original rate; replay does not duplicate credit. This private engine test is not a provider-confirmed refund or completed payout integration.

Six additional isolated tests reject zero/negative/null/sub-cent refund amounts, a short provider event ID and a replay whose amount differs from the original event. No tax assumption or settlement election was made. Acquisition thresholds remain progressive positions 1–49 at 5%, 50–99 at 7.5%, and 100+ at 10%, per agreement/vendor/SAST week. Existing custom commission snapshots remain authoritative.

`LEGAL-APPROVAL-CHECKLIST.md` records all five public documents, entity verification, addresses, Information Officer, VAT/pricing, food cancellation applicability, data practices, version/consent approval and operational gaps. Owner-supplied entity details match staging; missing fields remain blank. Retired refund text promises unsupported turnaround times but is redirected away from public policy routes. There are no approved published documents; neither admin approval controls nor automated checks confer legal approval.

### Concurrency and release blockers

Independent authenticated-session races remain **not performed**. Available management SQL executes isolated rollback fixtures; the current suite does not coordinate separately authenticated connections sharing committed synthetic orders. No database connection credentials or designated authenticated test sessions were available through the local setup. PGlite tests and sequential native replays must not be called concurrency proof.

To complete this gate, supply staging-only connection access through a secure local environment (not chat/Git) and disposable-account browser sessions. Run coordinated independent transactions for simultaneous checkout, duplicate/different payment evidence, positions 49/50 and 99/100, same/different refund events, cumulative over-refunds, agreement expiry while waiting for locks, and opposing fulfilment/administrative changes. Verify unique ledger keys, totals, rollback on conflicting evidence, deadlock/retry behaviour and no accidental duplicate orders. Do not enable hard-disabled corporate charging on shared staging to manufacture this evidence; use an isolated staging clone for the enabled-engine races.

Source inspection confirms the commercial advisory transaction lock, order share lock, unique order/vendor and weekly-position constraints, refund replay checks and server eligibility/expiry checks. This supports the design but does not prove all races safe. Standard refund compensation, acquisition payout allocation and already-paid negative-balance recovery remain incomplete. Real authenticated browser login/history/checkout, installed-PWA update, gateway sandbox confirmation and actual PayFast ITN remain separate gates. The owner clarified advance-meal cutoff 13:00 previous day and some same-day meals; the same-day closing rule is still needed before changing the legacy cutoff.

**Production assessment: not ready for corporate activation or real-money sign-off.** No push, merge, production deploy, live mutation, payout, actual payment/refund, account deletion or customer message occurred in this follow-up.

### Follow-up check results

- Full `node checks/verify-local.mjs`: passed before the six additional refund cases. Targeted `node checks/checkout-database.mjs` then passed on the final test file: 38 checkout, 43 Ozow/subscription, 59 delivery, **103 legal/corporate**, and 20 repair assertions. This is isolated regression evidence, not independent-session concurrency.
- Hosted rollback suites rerun: repair 18, legal/corporate 22, checkout 12, Ozow 16 and delivery 24; **92 native assertions passed**, with no retained fixtures. Post-test reads confirm zero synthetic legal/repair Auth accounts and hard CHECK constraints prohibiting acquisition/standard-component activation.
- `npm run build -- --mode staging`: passed, 122 PWA precache entries. Targeted oxlint on 36 changed/new frontend source files and `git diff --check`: passed. Existing LF/CRLF Git notices are not whitespace failures.
- Deno check of all six existing Edge entrypoints: passed with `--node-modules-dir=none` using global dependency resolution. Initial default resolution failed to locate the JSR package's realtime dependency in frontend node_modules; no dependency upgrade or deployment was made.
- Staging security advisors: unchanged 24 private RLS/no-policy INFO, 7 anonymous SECURITY DEFINER warnings, 40 authenticated SECURITY DEFINER warnings and leaked-password-protection warning. These are outstanding review items, not a clean security certificate. The repaired policy helper has an empty search path and a scoped active-vendor boolean; no anonymous grant. References: [private RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [anonymous function exposure](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated exposure](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Browser initial default-channel run failed before exercising application assertions and was stopped. Installed Microsoft Edge is used for the replacement run; its final result is recorded below. Fixture-based browser sessions are not actual independently authenticated hosted accounts.
- Replacement Microsoft Edge browser run: **all 30 tests passed**. Includes actual downloaded commercial/financial CSVs, public legal notices, checkout and status rendering, stale route/account response protection, refresh/retry, four browser timezones, delivery-origin administration and one signed-out read-only hosted-data smoke test. Hosted account credentials, real payment initiation and actual independent financial sessions were not exercised. Changed regression-file lint and new-file whitespace inspection also passed.

## A. Initial audit — recorded before implementation, 16 October 2026

Repository: Siphamandla1998/officebites. Branch: `feat/legal-vendor-corporate-acquisition`, created from clean `abebf8a`, preserving `ce53257` delivery backend and `8d4daed` Ozow/subscription groundwork. Fetched main remains `4c4835db62b7db4c7a725c92d7a6294ca523fa57`. No production release is authorized.

Existing React routes expose short static policies under /help only; they lack immutable versions, acceptance evidence and business disclosures. Refund text advertises timelines unsupported by a verified refund-execution workflow. There is no approved legal draft in the supplied request. Public legal publication must remain blocked pending approved wording and disclosures.

Vendor Auth registration and customer upgrade create pending vendors without durable legal acceptance. Existing server-side role whitelisting, active-account checks and vendor approval must be preserved. Metadata can express consent but must never confer authority.

The actual paid-suborder trigger snapshots a vendor-specific rate (default 17%) and rounded meal-subtotal commission. Delivery is excluded. Historical snapshots are immutable. An unused frontend constant incorrectly adds 2.5% to 17%; the requested model decomposes 17% into 15% + 2%, never 19% or 19.5%. Provider expenses remain distinct. No historical rates may be rewritten.

Existing corporate_opportunities are event-booking leads, not verified workplace memberships or accepted acquisition agreements. New entities must avoid repurposing those records. No corporate fee engine or provider-confirmed refund ledger exists. Payout allocation already snapshots liabilities and uses locking/idempotency; any additional deductions must reconcile with it before activation. The fee-policy choice remains an explicit administrator decision.

Staging schema and financial/Auth functions were inspected read-only in `eyhmarmekioovcjibcbr`. Production `gfzhdkitdyqftealgqfi` is excluded from mutation. Preserve all installed staging migrations and source history; use only new additive migrations. Delivery remains disabled (0.5 km free, 5 km maximum, R15 planned, unverified hub pin). Ozow, subscription billing and retention purging remain disabled.

### Owner-supplied disclosures

- Legal entity: Officebites PTY LTD.
- Enterprise number: K2026677349.
- Owner and beneficiary: Siphamandla Khumalo.
- These are owner-supplied, not independently verified registry evidence.
- Trading name OfficeBites; contact officebites4@gmail.com; telephone 073 371 6062; website https://officebites.co.za.
- Outstanding: approved policy/agreement drafts; principal business address; legal-notice address; VAT status/treatment; Information Officer identity/contact; approved dispute and settlement/refund operational terms.
- Ownership/beneficiary details are retained in this owner-supplied audit, not automatically published as personal data. Legal review must establish applicable office-bearer and place-of-registration disclosures; ownership alone does not establish an office held.

## B. Implemented changes

This is a **disabled staging framework, not a completed production-ready commercial release**. Existing business flows remain active under their existing backend contracts; the new mandatory consent programme is not enabled while approved documents are missing.

- Public routes `/terms`, `/privacy`, `/refund-policy`, `/vendor-agreement`, `/vendor-fees`, plus redirects from older help policy URLs. Public layout avoids role-based customer redirects. Pages retrieve only approved, effective versions, show effective/updated dates, immutable content hash, version, business disclosures, print/save-PDF and marketplace navigation. Missing versions display an explicit unpublished notice. No legal wording was invented. Existing short policy modules remain in source but are no longer routed as the published policies.
- Footer links in public, customer, authentication and vendor layouts cover registration, checkout and vendor account areas without changing checkout calculations or PWA configuration.
- Administrator workspace `/admin/commercial`: maintain disclosures, save immutable document drafts, approve a version using a legal approval reference only after disclosures are complete, and explicitly enable/disable new-application consent enforcement. Approval references are evidence supplied by the administrator, not an automated legal opinion.
- Eight initially unchecked vendor acknowledgements linked to full documents; signup carries consent claims to the existing Auth workflow. When enabled, a vendor insert trigger rejects signup and customer upgrade unless all eight acknowledgements and current approved versions validate. The server stores immutable acceptance evidence. Auth metadata expresses consent only; existing role/ownership checks confer authority. Auth and legacy upgrade RPC signatures remain intact.
- Existing vendors can separately record acceptance of current legal versions. Accepted content/version/hash is retained in the database and visible to the vendor/admin. No automatic re-acceptance or historical repricing occurs.
- Administrator corporate CRM supports names/internal identifiers, business contacts/location, estimated employees, notes/status, secured date, independently verified membership and revocation, vendor offers with explicit dates (12-week default), and termination. Registered-member counts are explicitly distinguished from paid orders.
- Vendor workspace `/vendor/corporate` shows scoped invitations, accepted/active/expired opportunities, retained documents, accept/decline actions, fee illustrations and CSV statements. Accepted corporate financial terms cannot be edited; new terms require a new offer. Activation is deliberately rejected until settlement integration is completed.
- Server-side acquisition preparation checks verified pre-order membership, one matching accepted active agreement, dates, confirmed paid suborders, complete vendor fulfilment, non-test classification and undisputed attribution. Delivery is excluded. One ledger charge per order/vendor and a unique agreement/vendor/week position prevent duplicate charges. All matching suborders must be completed; their subtotals aggregate into one order position.
- SAST Monday weeks; progressive 5% through position 49, 7.5% through 99, 10% thereafter. An advisory transaction lock serializes eligibility/administrative changes. Persisted eligibility timestamps are monotonic under that lock; report sequencing is `(eligible_at, order_id)`. This records actual server eligibility, not a provider/client-supplied or backdated completion timestamp.
- Immutable standard ledger preparation pins acceptance only for new suborders while enabled. Existing paid commission remains authoritative. At 17%, platform amount is rounded at 15%; the internal charge receives the cent remainder of the existing rounded 17% total. No extra 2% is added. Custom vendor rates are left untouched rather than forcibly decomposed. Current adapter supports undiscounted meals only and is hard-disabled.
- Private append-only refund compensation computes cumulative credits at the original acquisition rate, caps refunds at eligible meal value, and deduplicates provider events. Fully refunded entries remain auditable; their positions are not reused and earlier rates are not repriced. Refund-adjusted qualifying counts exclude fully refunded entries. This interpretation needs explicit contractual approval because historical ordinal positions can have gaps after refunds.
- No public or service-role grant permits calling the refund recorder. It is **not** a provider refund adapter. Administrator assertions cannot masquerade as confirmed provider refunds.
- A payout hold rejects allocation for vendors with acquisition charges until the existing allocator consumes the new ledger. This prevents silent overpayment; it is not completed payout reconciliation or negative-balance handling.
- Read-only scoped reports and actual CSV downloads distinguish acquisition charges/credits/net fees, qualifying orders, unique paying customers, weekly vendor/agreement volume and new standard fee components. Date filters use inclusive SAST calendar dates. Historical 17% entries are not retrospectively split. Provider expenses/tax remain explicitly unresolved in this supplementary report; the original financial report remains authoritative for existing sales.
- Corrected unused frontend constants from an erroneous 19.5% combined rate to the requested 15% + 2% = 17%. Regression assertions now enforce this while preserving server snapshot files, PayFast verification/signature encoding, account removal, delivery logic, order calendar-date rules and PWA configuration.
- No subscription/advertising plan or billing was activated. No gateway or Edge Function implementation changed in this task.

### Source inventory

New: `src/services/commercialService.js`, `src/components/layout/LegalLinks.jsx`, `src/components/features/VendorConsent.jsx`, `src/components/features/CommercialStatement.jsx`, `src/pages/help/LegalDocument.jsx`, `src/pages/shared/CommercialWorkspace.jsx`.

Extended: all five layouts, Register, BecomeVendor, authService, AppRoutes/routeComponents and fee constants. Added isolated/native checks and a staging containment script; extended existing regression/browser harnesses. This report is separate from, and does not overwrite, earlier delivery/Ozow implementation reports.

## C. Database changes

Only staging `eyhmarmekioovcjibcbr` was migrated. No existing source migration was replayed or edited. The Supabase connector records its own installation timestamp; the following mapping is intentional:

| Source filename | Installed staging version |
| --- | --- |
| `20261016094201_legal_corporate_framework.sql` | `20261016095620` |
| `20261016100142_commercial_reporting_contract_locks.sql` | `20261016100710` |

New private tables: commercial_settings, legal_versions, vendor_legal_acceptances, vendor_consent_intents, corporate_accounts, corporate_memberships, corporate_agreements, corporate_attributions, commercial_audit, acquisition_ledger, commercial_refund_adjustments, standard_sale_contracts, standard_fee_ledger.

Every new table enables RLS with no direct API table grants, including service-role default grants. RPCs perform explicit active admin/owner checks. Public wrappers use invoker rights; privileged internal helpers live in private with empty search paths and explicit EXECUTE grants. Public access is limited to published policy/disclosure reads. Vendor reports omit customer identifiers and internal CRM contacts, membership evidence and notes. Customers cannot access the corporate workspace.

Constraints/indexes cover document kind/version uniqueness, one active verified membership per customer, one acquisition charge per order/vendor, unique weekly positions, agreement scope, numeric refund limits, original accepted-term immutability, and append-only evidence. Existing profiles/vendors are retained through existing account-removal procedures; no new Auth foreign key requires deleting retained financial records.

Hard CHECK constraints prohibit enabling standard fee breakdown/acquisition flags even through the admin UI. A separately reviewed corrective release must complete the settlement/refund adapter and remove those interlocks. The admin cannot bypass them through the supplied controls.

`checks/legal-corporate-disable.sql` is a manual staging containment script: disable new behaviour and revoke mutating RPC/helper grants while retaining read access, evidence and payout holds. It was prepared, **not executed against staging**. It is not a guaranteed financial rollback. Do not drop ledgers, erase signed evidence, reverse provider events or remove holds after charging; those require forward reconciliation/corrective migrations. All currently installed ledgers are empty and no historical data was rewritten.

## D. Financial verification

Undiscounted R70 eligible meals, one vendor/agreement/week, before provider expenses and tax:

| Orders | Product sales | Platform 15% | Internal 2% | Acquisition | Combined fees | Vendor proceeds |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 49 | R3,430.00 | R514.50 | R68.60 | R171.50 | R754.60 | R2,675.40 |
| 50 | R3,500.00 | R525.00 | R70.00 | R176.75 | R771.75 | R2,728.25 |
| 99 | R6,930.00 | R1,039.50 | R138.60 | R434.00 | R1,612.10 | R5,317.90 |
| 100 | R7,000.00 | R1,050.00 | R140.00 | R441.00 | R1,631.00 | R5,369.00 |
| 120 | R8,400.00 | R1,260.00 | R168.00 | R581.00 | R2,009.00 | R6,391.00 |

Position 0 has no rate; 1/49: 5%; 50/99: 7.5%; 100/101/120: 10%. Native staging reproduced 120 paid/fulfilled synthetic orders and the component totals. A R20 then R50 refund of position 120 credits R2 then R5, never exceeding its original R7 acquisition charge; replaying the first event does not credit twice. Net acquisition fees become R574, with 119 remaining qualifying orders and the original 120 immutable charge entries. No actual payment or provider refund was made.

## E. Testing and actual results

- `node checks/verify-local.mjs`: passed. Includes 33 recovery checks, 73 original database checks, support 7/auth 2 scenarios, checkout 38, Ozow/subscription database 43, delivery-origin 59, new legal/corporate checks, checkout rules 44, mocked Ozow integration 33, and four timezones × (order 9/catalogue 6/frontend 53). The latest full run included 85 legal/corporate assertions. The subsequent targeted checkout/database run passed **97** legal/corporate assertions, adding independent unpaid/unfulfilled, test-order, expired-status, missing-membership and disputed-attribution exclusions.
- `checks/legal-corporate-staging.sql`: **22 native staging assertions passed**, including actual Auth signup/profile/vendor triggers, rejection without consent, accepted versions, immutable evidence, legacy upgrade enforcement, admin/vendor/anonymous access, activation interlock, 120-order progressive fees, duplicate events, cumulative refund credits and filtered report reconciliation. Synthetic accounts/orders/documents and temporary constraint bypasses were inside one transaction and rolled back. Fixture order creation timestamps explicitly simulate separate RPC transactions because PostgreSQL `now()` is fixed at BEGIN.
- Browser: full 26-test suite passed before the final commercial reporting component. Then both targeted tests passed on final components: all five anonymous mobile policy routes and a real downloaded commercial CSV with vendor CRM controls absent. Existing suite includes a signed-out read-only staging frontend smoke check. Remaining browser checks use service fixtures with hosted requests blocked; no authenticated browser staging registration, consent signing or real corporate financial flow is claimed.
- `npm run build -- --mode staging`: passed; PWA generated, 121 precache entries. This is compilation/service-worker generation, not a deployed frontend or installed-PWA update test.
- Targeted source lint: passed, zero warnings/errors on changed source files and layouts.
- Deno check: all six existing Edge entrypoints passed (PayFast initiate/notify, Ozow initiate/webhook/reconcile, admin-account-removal). No functions were deployed or invoked.
- `git diff --check`: passed. Additional whitespace inspection covers new untracked source, SQL, checks and this report.
- Security advisors after the framework migration: 24 INFO notices for RLS-without-policy private tables (13 new intentional RPC-only tables), unchanged 7 anonymous / 39 authenticated exposed SECURITY DEFINER warnings from existing functions, and existing leaked-password-protection warning. New exposed wrappers are invoker functions. See [RLS advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [function exposure advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No unrelated Auth setting was changed.
- Final read-only staging checks after native tests: zero synthetic Auth accounts, published documents, acceptances, corporate accounts and ledger entries. All new commercial flags, delivery enforcement and retention purging remain false. Anonymous financial reporting and direct authenticated private-ledger writes are denied.

Failures found and corrected during development: a JavaScript expected-value assertion used floating-point equality; a fixture skipped legal fulfilment transitions; the initial eligibility function referenced a nonexistent parent-order payment_status (payment belongs to suborders); and a native fixture needed an explicit order_status enum cast. No failed migration was blindly rerun. Passing final runs supersede those failed development checks.

### Untested or incomplete

Independent native concurrent-session eligibility races, multi-vendor/same-order acquisition end-to-end, negotiated custom component schedules, discount-funded sales, provider-confirmed full/partial standard-fee refund reconciliation, already-paid payout recovery, real corporate customer retention analytics, attachment/document-file retention, browser printing/PDF output, accessibility assistive-technology testing and installed-PWA update recovery remain unverified or unimplemented. Monday boundary arithmetic is tested, but a real cross-week concurrent native workload was not exercised. No completed PayFast payment/ITN or Ozow gateway transaction was performed.

## F. Release readiness and remaining blockers

**Do not activate or release this as the complete commercial programme.** Staging has the disabled schema/contracts. This task has not deployed the frontend, pushed the branch, merged main, changed production, initiated payments/refunds, classified existing orders, executed payouts, enabled retention or deleted accounts/files.

Owner/legal decisions still required: approved Terms, Privacy/POPIA, Refund/Cancellation, Vendor Partnership and fee schedule drafts; business and legal-notice addresses; applicable VAT treatment; Information Officer/contact; applicable office-bearer/place-of-registration disclosures; lawful retention and dispute processes; refund operations and settlement/refund allocation responsibilities. The supplied entity name/number and owner/beneficiary are recorded; they are not independent registry verification or approval of policy wording.

Engineering blockers before activation: complete the provider-confirmed refund adapter and standard fee compensation, integrate acquisition/refund liabilities into the existing payout allocator rather than merely holding payouts, implement reviewed negative-balance/recovery behaviour, support/validate vendor-funded discounts and negotiated schedules, add pre-charge attribution dispute management, and finish missing native concurrency/multi-vendor/browser scenarios. The supplementary report intentionally does not claim final vendor payable amounts or replace existing marketplace reports. No unsupported refund turnaround is published.

Safe sequence: complete approved disclosures/content; review the legal-content checklist against [ECTA](https://www.gov.za/documents/electronic-communications-and-transactions-act), [CPA](https://www.gov.za/sites/default/files/32186_467.pdf) and [POPIA](https://www.justice.gov.za/legislation/acts/2013-004.pdf); stage document publication and enforce consent using disposable accounts; finish settlement/refund integration and native concurrency tests; explicitly approve tax/commercial operations; review a separate activation migration; only then seek approval for a production release. These links inform review and do not constitute a compliance certification.
