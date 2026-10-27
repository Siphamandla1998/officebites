# OfficeBites real-vendor launch readiness — 27 October 2026

**Historical report. Superseded by [the checkout compatibility repair](INTEGRATED-CHECKOUT-COMPATIBILITY-REPAIR-20261027.md).** The live deployment/source identity, minimum SQL package and native test evidence below have newer findings. Retained for provenance.

**NO-GO for hosted installation, hosted UAT, legal publication and real-money launch.**

A local integration candidate and two additional security candidates are prepared.
This is **not a completed, production-compatible backend installer**. The verified
production-source baseline and extraction/rehearsal of the minimum backend foundations
remain open. Do not deploy this frontend against the current production schema.

## Workspace, provenance and preservation

- Release branch: `release/vendor-eft-legal-launch`.
- Isolated worktree: `C:/Users/Siphamandla.Khumalo/Documents/officebites/.officebites-local/worktrees/vendor-eft-legal-launch`.
- Candidate base: `origin/main`, `4c4835db62b7db4c7a725c92d7a6294ca523fa57`.
- Payment input: `feat/vendor-direct-launch-payments`, `4b94fbe89e8b5a672e4f308701df61c1224580fd`.
- Legal input: `feat/legal-pages-vendor-clickwrap`, HEAD `4cac836a35ef0e75e589a2640772f775ca1a260c`, plus its existing uncommitted B–E source.
- Phase E is included because customer publication and order-linked/guest acceptance
  are required by this release; B–D alone do not provide those controls.
- Original payment working tree is clean. All 93 initially captured input-file hashes
  still match. The legal worktree's existing changes remain there, unchanged by this task.
  See [preservation evidence](release/source-preservation.json) and
  [source input manifest](release/source-provenance.json).
- Nothing was staged or committed. No push, merge, deployment, hosted SQL write,
  migration, legal publication, account/vendor/bank approval or activation occurred.
  Git fetch and creation of the new branch/worktree changed shared Git metadata only.

## Fresh production and staging evidence

| Boundary | Observed evidence | Limit |
|---|---|---|
| Production custom domain | `officebites.co.za` resolves in Vercel to `dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt`, reported branch `fix/backend-staging-completion`, commit `ee258d614e46eb3ae7a1957ffb11ff7a3c819180` | Newer production-target deployments exist; target alone does not identify the live custom-domain deployment |
| Production source | GitHub fetch of that exact SHA returned `upload-pack: not our ref`. Package, routes and AuthContext hashes match origin/main; order-service hash differs | Vercel's order-service base64 response is truncated. No complete production source archive or full baseline certification was obtained |
| Served production frontend | Public HTML and seven referenced JavaScript assets returned HTTP 200; Supabase module contains `gfzhdkitdyqftealgqfi.supabase.co` | JavaScript was fetched without execution. Only hashes/hostnames retained; no key values. This does not exercise checkout/Auth |
| Production database | `OfficeBites`, `gfzhdkitdyqftealgqfi`, eu-west-1, ACTIVE_HEALTHY, PostgreSQL 17.6.1.147; 38 history entries ending `20261010101910_production_audit_cleanup` | Health is not backup, transport or authorization proof |
| Production foundations | Manual payment, gateway settings, versioned legal, B activation, C assignment, D compliance and E order-evidence tables are absent in captured catalogs | Staging packages cannot be installed as production deltas unchanged |
| Existing vendors | One approved and nine suspended; all ten have commission_rate 0.17 | No identities/bank details collected. Counts are not compliance sign-off |
| Existing orders, 09:59:07 UTC | 32 orders: 31 pending_payment, one preparing; 33 suborders. Aggregate contract/financial preservation digests recorded | Pending orders need controlled operational reconciliation. Do not assume unpaid means no money moved; do not cancel/backfill them automatically |
| Staging identity | `officebites-staging`, `eyhmarmekioovcjibcbr`, eu-west-1, ACTIVE_HEALTHY, PostgreSQL 17.6.1.166 | Staging is not disposable |
| Staging history | 54 entries, ending `20261021100655_fix_admin_manual_settings_singleton` | Semantic names and definitions need reconciliation; local timestamp differs |
| Staging payments, 09:28:10 UTC | EFT false/ready true/maintenance false; PayShap false/true/false; PayFast false/true/false; Ozow false/false/true; zero bank profiles and zero approved profiles; 15-minute deadline, R500 threshold | Fresh staging facts only. Production has no corresponding gateway-settings table; production payment enablement is not certified by this observation |

Metadata is in [release evidence](release/). Schema, constraints, enums, indexes,
triggers, policies, owners, ACLs, defaults, role membership, selected definitions,
function hashes, histories and aggregate preservation digests were read without
customer/banking rows. This is not a complete reproducible managed-Supabase dump.

**Baseline requirement is not satisfied:** the new worktree uses an explicitly
uncertified origin/main candidate. Recover the complete live deployment source or
provide another independently verified production-compatible baseline before
approving this as the release branch. The unavailable deployed commit was not
invented or substituted as though verified.

## Implemented local integration

| Area | Candidate behavior | Backend/release dependency |
|---|---|---|
| Customer legal reading | Terms, Privacy, Refunds labels; six approved-source document routes, responsive reading/print views; Poppins/light theme retained | No working draft imported into application text. Missing approved text fails closed |
| Customer checkout | One vendor, EFT/PayShap only; unchecked current legal review; identity/session checks; offline/stale/error handling; guest order recovery; saved order-terms view | E receipt/deferred enforcement plus the new manual launch guard; no provider fallback or client-supplied authoritative hashes/times |
| Vendor agreement | Complete assigned Agreement, vendor-specific Fee Schedule and Operating Standards, with Privacy/Refunds; unchecked authority/read/understand/agree declaration; explicit disabled-until-ready Accept & Continue; immutable receipt history | Existing legal-version and vendor-acceptance stores reused. Rollout remains off; no fabricated schedules or approval |
| Pending vendor onboarding | Registration/application routes lead to agreement/compliance review; private evidence/banking submission without selling privileges | B/C/D required. Banking submission uses D's scoped compliance reader; it does not approve a vendor |
| Admin verification | Vendor-specific approved document assignment; identity/food/premises/CoA/operations/bank review, audit history, expiry/revocation, explicit approval/restoration/enrollment | Reviewer identity/time and readiness remain backend-authoritative; source B–D gates preserved |
| Payment settings | Latest ManualSettingsForm, narrow checked RPC, revision/conflict/offline/lost-response/reload behavior and admin-assisted banking form retained | Corrected singleton and checked-revision backend must be installed. The original checked SQL's staging-only guard has NOT been weakened to make it a production migration |
| Payment instructions | Protected post-order recipient/reference; EFT or registered ShapID; copy/error/support/recovery; customer reporting does not mark paid | Actual receipt verification and duplicate-reference/ledger protection remain server-side. Unsupported cash instructions fail closed |
| Launch scope | Collection/assisted creation and admin controls, new delivery controls/origin approval and corporate-acquisition navigation removed; no PayFast/Ozow initiation or marketing activation | Reference fixtures retain historical excluded code solely to test existing B–E dependencies; they are not the production installation package |
| Legal admin | Read-only version/acceptance history and release-disabled publication review at `/admin/legal`; no corporate acquisition offers or enforcement-disable button | Approved text/disclosures and a separately reviewed publication procedure remain necessary |

The checked settings and pending-bank implementations were reconciled rather than
overwriting one with the other. Account-switch handling from the later payment
workspace is preserved. Textarea/select accessibility fixes were also retained
after browser tests reproduced the missing support Message label.

## Security corrections prepared here

### 1. Production browser-role grants

Fresh production catalogs grant anon/authenticated TRUNCATE on inspected order,
profile and vendor tables, alongside unnecessary schema-administration privileges.
RLS does not constrain TRUNCATE. This is a confirmed privilege exposure, **not a
demonstrated reachable PostgREST exploit**. See
[PostgreSQL row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

Candidate `release/production-candidates/20261027093453_production_launch_browser_grants.sql`:

- Requires the captured 38-entry production ledger, final cleanup migration,
  exact hashes of the three existing security functions and postgres-owned RLS tables.
- Revokes TRUNCATE/TRIGGER/REFERENCES from browser/PUBLIC roles in public/private,
  including postgres's corresponding table default privileges.
- Revokes both table and column INSERT permissions for profiles/vendors. Existing
  definer onboarding and row-level read/update policies remain intact.
- Changes no rows, statuses, documents, financial snapshots or payment flags.
- Passed 18 assertions in PGlite and 18 in positively verified native PostgreSQL 17.10.
  This is a narrow grant test, not a full production-schema or concurrency rehearsal.

Production already rejects signup role values outside customer/vendor. Its UPDATE
guards protect privileged fields; no INSERT RLS policy was seen on profiles/vendors.
Do not falsely report staging's old signup vulnerability as currently demonstrated
in production. B still strengthens provisioning/activation and removes residual grants.

### 2. Cross-system manual-payment/legacy-vendor guards

The disposable combined fixture reproduced a legacy `admin_verify_payment` call
marking a manual suborder paid while its manual receipt remained unverified. All
demonstration changes were rolled back in that disposable instance.

Candidate `release/production-candidates/20261027094852_production_manual_legal_transition_guards.sql`:

- Requires manual/B/C/D/E foundations and closed legal/payment installation state.
- Requires strict enrollment, current assignment/acceptance, current independently
  verified compliance/banking and customer legal enforcement for **every new** EFT/
  PayShap order. An old approval exception cannot silently unlock manual payments.
- Preserves existing account/status rows, existing instructions and matching-request
  recovery; immutable original payload validation remains authoritative.
- Matches request → vendor SHARE → commercial-lock ordering. No SHARE-to-UPDATE
  upgrade is introduced during concurrent checkout. Native races remain unverified.
- Rejects collection, quote-based delivery and nonmanual methods through the legal
  wrapper as well as the frontend; old renamed helpers lose client/service EXECUTE.
- Uses a deferred paid-transition constraint requiring verified receipt fields,
  audit event and financial evidence in the same transaction. Legacy admin/direct
  paid transitions fail and roll back, while the actual bank-receipt RPC still works.
- Rechecks creation readiness at commit to catch wall-clock expiry after insertion.
- Explicitly removes raw service-role access to manual evidence tables.
- Passed 25 integrated PGlite assertions, including reproduced/blocked paid bypass,
  commit-time creation denial, retained existing-order receipt confirmation and
  duplicate confirmation without duplicate receivables.

Neither candidate enables a flag, inserts banking, publishes text, accepts terms,
enrolls/activates a real vendor or rewrites historical fees. Both were generated
using Supabase CLI `migration new` and moved outside automatic migration discovery.

## Existing-vendor transition and commercial rules

All ten current vendors would be pre-B legacy records under the untouched B default.
B does not backfill/enroll them; owner transfer enrolls. D requires explicit audited
restoration decisions. The new launch candidate preserves these accounts/statuses
but makes new manual payments depend on strict review. The UI explicitly explains
this effect; no hidden exemption or automatic suspension/enrollment is introduced.

Before launch, a controlled, named inventory must decide each account's transition,
current owner/signer, required evidence, enrollment timing, old orders, approved bank
version and current assignment. The single approved vendor needs the complete real
review before new EFT/PayShap ordering. The nine suspended vendors stay suspended
unless separately reviewed. Preserve fulfilment/refund/support for existing orders.

Approved base economics are **15% platform + 2% transaction-related fee, excluding
applicable VAT**. Production's existing aggregate 0.17 snapshots must be retained;
do not charge another 17% or backfill rates. The source manual ledger records a
commission receivable and excludes vendor-direct proceeds from platform gateway
payout funds. It does not split bank transfers or collect that receivable automatically.

Separate component rounding, product/tax basis, VAT registration/number/effective
date, invoice/credit-note treatment and delivery agency/reimbursement require
verified accounting decisions. No VAT registration or automatic invoicing is claimed.
The end-to-end production commission path is not certified until the minimum
foundations are extracted and rehearsed against the actual production contract.

Optional marketing remains off. Approved additional tiers are flat 5%, 7.5%, 10%
across eligible orders in the defined measurement period, not progressive positions.
Historical progressive corporate source is quarantined test/review input; do not
activate it. Attribution, period/timezone, eligibility, discounts, refunds and
recalculation/invoice rules still need sign-off and implementation.

Settlement remains vendor-direct: the full shown transfer goes to independently
approved vendor instructions. A customer report/proof is not verified receipt.
Refund status records human bank return/reconciliation; it does not send a refund.
No automatic refund, instant settlement, provider split or tax-invoice promise is made.

## Migration manifest and production-specific ordering

See [ordered plan](release/production-rollout-plan.md),
[exact candidate inputs](release/source-provenance.json), and
[changed-file/hash manifest](release/file-manifest.json).

Only the two SQL files in `release/production-candidates/` are newly authored
production-oriented candidates. **There is no approved complete installer.**
`release/source-candidates/` contains unmodified development inputs, including
excluded mixed foundations. Its README prohibits applying them as a production package.

Do not replay local finance/security migrations: production already records
`20261008134310_launch_financial_ledger` and
`20261008134402_launch_account_security_retention`, whereas local versions are
`20261008114505` and `20261008114550`. Production also has cleanup/hardening absent
from a naive historical bootstrap. Staging's singleton `20261021100655` versus local
`20261021094956` is not a missing production delta: manual payments are absent on
production. Match definitions/owners/ACLs/constraints, not names or timestamps alone.

## Verification results and limits

| Check | Result |
|---|---|
| Final production frontend build | PASS, Vite 8.1.5/PWA; no deployment |
| Lint | PASS, nine existing hook/Fast Refresh warnings; no new errors |
| Service payload/session/guest/legal tests | PASS, 15; unsupported collection rejected before RPC |
| Config self-tests | PASS, six; no secret values or requests |
| Local public configuration | BLOCKED as expected: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY absent; no credentials copied |
| Full reference SQL suite | PASS, fresh PGlite; includes manual 110, B 47, C 63, D 54, E 69 and legacy suites. It uses synthetic staging-era foundations, not the production contract |
| Final integrated launch SQL | PASS, 25 new assertions plus B–E/reference prerequisites; legacy UAT gate suites run separately, before this new launch scope changes entry points |
| Grant candidate PGlite/native | PASS, 18 assertions each. Native fixed loopback 55439, freshly initialized exact data directory, unused named disposable DB verified before mutation; server stopped afterward |
| Broad launch browser run | 65 passed, one failed due to missing merged synthetic admin-vendor selector data; not recorded as a clean full run |
| Corrected pending bank/compliance rerun | PASS, all 11; includes the previously failed case and final legacy warning |
| Final manual payment/scope rerun | PASS, all 20; includes unsupported-cash denial and unchanged protected EFT/PayShap/support flows |
| Browser coverage total | 67 distinct launch cases passed across the broad run and targeted corrected/final reruns; not a claim of a single 67-case final run |
| Whitespace/source preservation | git diff --check PASS on tracked release changes; original payment clean, 93 input hashes match |
| Literal credential scan | Zero token/private-key literal pattern findings in scanned changed files; not exhaustive secret/PII certification |
| Full native EFT/legal/compliance concurrency | BLOCKED/not run: production foundation chain/baseline not certified; native grant test does not cover this |
| Hosted REST/Auth/Storage/Realtime, configured public smoke, real devices/screen readers | BLOCKED/not exercised. No hosted test orders, signups, uploads or notification probes |

Earlier failures are retained as findings: an initial premature build saw incomplete
dependencies; selective copying missed two helpers/origin-control removal; legacy
collection/assisted tests were included accidentally and that run was interrupted;
the Message textarea label failed before its component fix; the admin banking mock
omitted its pending vendor; an initial guard fixture selected a booked historical
order and hit its expiry protection. No security check was disabled to pass tests.

## Remaining blockers and owner/evidence

| Priority / owner | Required closure evidence |
|---|---|
| P0 Engineering + production deployment owner | Recover/certify the live source archive or another production-compatible baseline; full source/API/schema difference review. Current origin/main candidate is not certified |
| P0 Database engineering + independent Security reviewer | Extract the minimum ordinary-checkout, disabled gateway, legal and manual foundations; corrected singleton + production-specific checked settings; eliminate excluded feature dependencies; generate/hash exact forward SQL and rehearse it against a sanitized actual production contract. This is unfinished repository work, not an operator attestation |
| P0 Security/database owner | Review the new browser grants and legacy paid-bypass fixes; complete all effective grants/default-owner/role/private-helper/view review. A native grant test does not settle other owners' defaults or full API exposure |
| P0 Native test owner | Concurrent duplicate checkout/receipt, bank revocation/expiry, ownership transfer, assignment/publication, stale settings, restore and cancellation/refund races; complete successful ordinary guest/member manual checkout through strict B–E plus final guards. Preserve historical digests and failed-transaction atomicity |
| P0 Supabase operator/Support | Effective managed PostgREST exposed schemas, hook/pre-config precedence and instance reload; Auth identity/email/SMS/MFA hooks/fallback; Storage/Realtime authorization and service-role consumers. No allowlisted role pgrst settings were returned; that is not runtime evidence |
| P0 Notification/worker/Vercel/provider owners | Complete non-delivery/sink/forwarding/retry inventory and signed isolation attestation before synthetic UAT. No active notification tests authorized here |
| P0 Recovery/service owner | Current usable backup/PITR, accepted RPO/RTO and disposable restore proof; separate Storage bytes/config/Auth/Edge recovery; maintenance/old-client impact and forward containment acceptance |
| P0 Legal/company/privacy owner | Final signed-off six public documents and vendor Agreement/Standards, verified company/legal-notice/Information Officer/retention/transfer details, exact hashes and publication approval; no working drafts |
| P0 Vendor/compliance + independent admin | Actual vendor identity, premises/food/CoA applicability, operations, approved bank receiving capabilities, current vendor-specific schedule, signer authority, acceptance, review and explicit legacy transition records |
| P0 Accounting/payment operations | Verified VAT/invoicing/rounding/fee basis; vendor-direct commission collection, bank receipt/refund/dispute and pending historical payment SOPs; no invented tax treatment |
| P1 Frontend/operator | Approved staging public config pair and key membership, build/deployment host evidence, protected Preview and authorized transport UAT; reproduce the prior environment fetch issue with valid config before claiming resolution |
| P1 Accessibility/operations | Real screen-reader/iOS/Android/print review, notice delivery evidence, expiry/renewal process, private upload malware/byte-integrity/retention controls and staffed reconciliation/support |
| P2 Commercial owner | Flat-period marketing attribution/accounting engine and separately approved provider/corporate features; remain excluded/off |

The earlier EFT operator/support handoff requirements remain open; they are not
closed by fresh catalog access or passing fixtures. Support requests remain unsent.

## GO / NO-GO

| Decision | Status |
|---|---|
| Local diff, evidence and candidate review | GO, with explicit uncertified-baseline/incomplete-installer limitations |
| Claim local production integration complete | NO-GO: baseline and minimum backend foundation package still incomplete |
| Install either/full package on hosted production or staging now | NO-GO; no hosted authorization and no complete certified plan |
| Deploy/test hosted Preview with writes | NO-GO; reviewed dependency installation, config, isolation, transport and separate UAT approval missing |
| Publish legal text / enable customer or vendor assent | NO-GO; final documents/assignments/sign-off and separate rollout required |
| Activate real vendor, EFT or PayShap | NO-GO; all legal/compliance/bank/operational/native conditions and explicit approval required |
| PayFast/Ozow, marketing, split payments, new delivery/booking/corporate acquisition | Excluded; no activation proposed |
| Real-money production launch | NO-GO; 27 October order expectations do not waive blockers |

Stop for review. The next engineering dependency is certification of the production
baseline and the minimum production foundation SQL; no hosted action follows from
this report or from the new branch's existence.
