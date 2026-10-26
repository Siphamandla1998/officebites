# Vendor-direct EFT — P0 resolution review

**26 October 2026. Installation: NO-GO. Hosted UAT: NO-GO. Real-money launch: NO-GO.**

Continued the existing payment implementation on `feat/vendor-direct-launch-payments`,
HEAD `4cac836a35ef0e75e589a2640772f775ca1a260c`, in
`C:/Users/Siphamandla.Khumalo/Documents/officebites`. Read the preceding readiness
report completely, including its owner checklist, security and migration sections.
This report supplements, and does not overwrite, `eft-readiness-readonly-20261026.md`.

Fresh hosted metadata/SELECT evidence: approximately **13:20–13:36 UTC / 15:20–15:36
SAST**. Last payment/history query: **13:36:03.908424 UTC**. No hosted SQL writes,
migrations, configuration changes, deployment, push, merge, banking changes,
orders, funds or notification tests. No production project or secret values read.
The legal worktree was inspected read-only; nothing there was changed or merged.

## What progressed

The repository-side absence of a reduced EFT installer is addressed with a
**local, unapproved candidate**, exact request/manifest, executable baseline
comparisons and forward containment. Nineteen new disposable database assertions
pass, alongside the existing payment/collection/security suite. No application
runtime or historical migration was changed. Artifact preparation does not resolve
service configuration, operator attestations or integration approvals.

## Fresh target, exposure and isolation evidence

| Check | Fresh observation | Limit / decision |
|---|---|---|
| Supabase identity | `officebites-staging`, `eyhmarmekioovcjibcbr`, ACTIVE_HEALTHY, eu-west-1, PostgreSQL 17.6.1.166 | Correct control-plane target; does not prove any browser uses it |
| Vercel identity | `officebites`, `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71`, team `team_kKRzCLk1pNHoIA4sV1M0ciSg` | No deployment or env change |
| Latest Preview re-read | READY `dpl_3GkXn3xL5nWA9NNER2YWDxTDp2ej`; branch/commit equal current payment HEAD; `target=null` | `https://officebites-pfqlvecyc-sp24tg-6983s-projects.vercel.app`; served bundle and transport not verified |
| Preview protection | Project metadata explicitly has SSO enabled for Preview; password protection and trusted-IP controls report disabled | SSO metadata is partial evidence; not a successful protected browser/API denial test |
| Public backend mapping | Re-read Preview `VITE_SUPABASE_URL`: `https://eyhmarmekioovcjibcbr.supabase.co`; Preview publishable-key variable exists; branch-filtered env result empty | No key value read. Key membership, built bundle host, custom/build-time behavior not proven |
| PostgREST | Queried role/database settings for relevant pgrst config: no entries | **Effective configuration UNKNOWN**. SQL settings do not prove process env, exposed schemas, pre-request hook, config precedence or successful reload |
| SQL exposure | anon/authenticated/service_role have private-schema USAGE; inspected commercial tables owner-only with RLS; client-callable helper/RPC grants exist | USAGE does not itself grant rows, but RPC grants matter. Effective REST schema exposure and invoker/definer behavior need transport evidence |
| Notifications in database | No inspected pg_cron/pg_net/http/pgmq extension or native cron/network queue; messages/support notification triggers exist | Narrow catalog evidence only. Does not exclude Edge Functions, Auth delivery, Realtime, external workers or providers |
| Vercel webhooks | Read-only list request returned **403 forbidden** | Unverified, not an empty inventory. Owner with access must supply redacted evidence; no access bypass attempted |
| Integrations | Empty result for queried project-view integration configurations | Not a global automation or notification inventory |
| Auth/other delivery | No effective Auth hook/provider routing or all-channel non-delivery attestation obtained | Operator/Support blocker; no test email, signup or order was triggered |

Required effective-service evidence: timestamped redacted PostgREST exposed schemas,
`db_pre_request`, `db_config`/`db_pre_config` and config precedence/reload state;
Auth signup/email/SMS hooks and provider routes; Storage and Realtime exposure;
service-role bypass inventory; denied/allowed transport matrix tied to the exact
target and Preview. Prefer a disposable native Supabase stack for active probes.
If control-plane access cannot supply these, request Supabase Support confirmation.
Do not set SQL values and call them verified effective configuration.

Required notification attestation: a named owner inventories Auth email/SMS,
application email/SMS/WhatsApp/push, browser service-worker push, Realtime,
database triggers/outbox/cron, Edge Functions, Vercel webhooks/integrations,
external workers and provider dashboards; records sink/non-routing destinations,
disabled forwarding/retries, retained queues, access controls and recovery.
In-app rows or salted email capture alone do not prove external non-delivery.

## Settings and hosted objects

| Provider | enabled | ready | maintenance |
|---|---|---|---|
| manual_eft | false | true | false |
| manual_payshap | false | true | false |
| payfast | false | true | false |
| ozow | false | false | true |

Unchanged at final query: manual deadline **15 minutes**, review threshold **R500**;
delivery **off**, paid fee **R15**, revision **2**. No maintenance, ready, unlock or
payment setting was changed. Ready is not an authorization to enable a provider.
R10 delivery and R15 legacy delivery activation are excluded. Only the closed R0
Eduvos collection candidate is prepared; no destination/window/capacity/cutoff was
created or approved. Staffing, future windows, capacity and cutoff sign-off remain
operations prerequisites before bounded UAT.

The Phase E report recorded PayFast maintenance true earlier; current repeated
reads return false. The discrepancy is **not resolved** by adopting the current
value or changing it back. Operator must produce dated audit/provenance, confirm
intended state and approve any separate remediation. The candidate binds the
observed false value solely to reject further drift, not to ratify its provenance.

54 hosted migration entries remain, latest `20261021100655`. UAT security,
collection RPC, full release ledger and legal B–E roots are absent. New EFT ledger
also absent at final query. Baseline counts: orders/suborders/items 15 each,
manual events 18, manual payments 0, bank profiles 0. Counts are not full data
fingerprints; no row or banking contents were downloaded.

### Migration identity reconciliation

| Semantic migration | Repository version | Hosted version |
|---|---|---|
| checkout_recovery_mobile_delivery_gateways | 20261016074256 | 20261016080056 |
| booking_mobile_validation | 20261016081336 | 20261016081551 |
| ozow_attempts_subscription_approval | 20261016083644 | 20261016084712 |
| central_hub_vendor_origin_approval | 20261016090258 | 20261016091616 |
| central_hub_display_name_encoding | 20261016091839 | 20261016092052 |
| delivery_unenforced_order_snapshots | 20261016092359 | 20261016092635 |
| legal_corporate_framework | 20261016094201 | 20261016095620 |
| commercial_reporting_contract_locks | 20261016100142 | 20261016100710 |
| repair_order_policy_helper_access | 20261016101707 | 20261016103515 |
| vendor_direct_manual_payments | **20261020090841** | **20261020100740** |
| fix_admin_manual_settings_singleton | **20261021094956** | **20261021100655** |

Fresh history confirms the hosted counterparts, not missing local timestamp IDs.
The singleton admin function's current definition is bound in the new baseline
(MD5 `7c0a398be18ece9e1940840fe692ea6c`). Names do not establish byte-identical
historical SQL. Never replay the old manual/singleton migrations or insert fake
history rows. No blanket `db push`, automatic repair or renaming is justified.
Full catalog/export comparison and a reviewed migration-history plan remain needed.

### RLS, owners, functions and authorization

The ten captured checkout/manual/account functions are owned by `postgres`,
security-definer, with explicit ACLs. Inspected private commercial tables have RLS
and owner-only table ACLs. Orders have authenticated SELECT; profiles/vendors have
authenticated SELECT/UPDATE, vendors also anon SELECT. Fresh column inspection
finds no client INSERT grants on profiles/vendors, and UPDATE privileges including
privileged fields. Existing enabled privileged-field triggers therefore matter:
`guard_profile_privileged_fields`, `guard_vendor_privileged_fields`, account write
guards and vendor legal-application trigger are present. Owner-update RLS alone
does not permit all field changes; do not report an untested UPDATE exploit.

Fresh policy definitions show self/admin profile access and owner/admin vendor
update predicates, active-account restrictions and approved/orderable catalog
policies. No private-table policies were returned for the inspected owner-only
commercial tables (default deny for non-bypass roles). Table ACLs/RLS do not replace
review of definer functions or BYPASSRLS actors. Pending banking submit and bank
approval RPCs are postgres-owned with service_role/authenticated EXECUTE; identity,
independence and status checks reside inside the RPCs, not those ACLs alone.

`private.create_order_core` retains owner-only execution and `search_path=public`;
the inherited path remains a security review item. No grant was broadened to make
tests pass. Existing `handle_new_user` trigger/function is present, but the Phase B
signup-metadata remediation is not installed. A closed payment/UAT package is not
a substitute for B's privilege and vendor-activation protections.

New baseline checks cover ten function definitions/config/owner/ACLs, seven table
ACL/owner/RLS records, counts and settings. They do **not** exhaustively bind all
columns, policies, triggers, default privileges, memberships, extensions or hosted
service configuration. Fresh full-schema comparison/advisors and native permission
tests remain installation review prerequisites. Additional trigger/policy/column
metadata is retained separately as evidence, not silently treated as installer checks.

## Preserved historical helpers — safety review

`checks/manual-payments-staging-preflight.sql` is SELECT-only: no SQL mutations,
order creation or notification calls. It is obsolete for this baseline: expects
manual tables absent, an old public delivery signature and historical function
insertion text. Hard regprocedure/regclass casts can error on missing objects;
function existence and text-position checks do not establish authorization or
semantic equivalence. Do not treat its success/failure as release authority.

`checks/prepare-manual-staging-release.mjs` has no hosted calls or deployment step,
but performs **local filesystem writes**. It copies current working source,
including uncommitted changes, not pinned committed blobs; selects the already
installed manual migration; hashes a local schema-preimage file without validating
live schema; writes candidate files before loading that preimage, allowing partial
output on failure. It checks source links but not destination ancestor links or
unexpected pre-existing output files, so destination links/stale contents need
operator review. Its generated Vercel linkage/ignore files and file allowlist are
not environment/key/transport validation or a complete secret scan. It was not run
or changed. Do not use the historical helper as the new package or deploy its output.

SHA-256 preservation checks passed for all four original local changes:

| File | Preserved SHA-256 |
|---|---|
| OFFICEBITES-PREVIEW-RELEASE-20261016.md | BFF59A97F6217077E2106AD3C60C867D7193781359970B295246E9305432E5BB |
| checks/manual-payments-staging-preflight.sql | 9673E0F5A90BD0B2E39476DBB6DA3CE34A933F82AE7486BB071E99AC660DD499 |
| checks/prepare-manual-staging-release.mjs | 2130BA5982DEDFFF645CD86DFA4036F71F2B5EE60B7FBA29F997A1B5F3715368 |
| docs/eft-readiness-readonly-20261026.md | C756C32F5A23A4BAD74D669F9EABD516212D75EF8EF276EED45BE0114EC8C94E |

## New forward-only candidate and installation sequence

Directory: `supabase/staging-release/20261026-eft/`. Proposed single migration name
`officebites_staging_eft_locked_20261026`; `manifest.notApproved=true`.
Installer SHA-256:
`b80909ae1978d57323bce1093761197ad582d33384ee28016935286989cc9e4b`.
Logical payload digest:
`0f65603281048631d437ef436272762b232763d1af57dabf094a97ae6f22deac`.
Request SQL exactly matches `install.sql`. Manifest binds builder, baseline,
three source files and all seven generated SQL artifacts. Link checks protect
the known builder/source/baseline/output paths. Hashes establish integrity, not
external sign-off. Preserve manifest/request together; do not copy fixture scripts
into hosted SQL Editor.

The exact minimal sequence, **conditional on closing installation blockers**, is:

1. Independently verify project/Preview, backup/recovery, maintenance impact and
   effective service/notification isolation. Export full schema and reconcile
   history/owners/RLS/grants/defaults/triggers; select reduced versus broad versus
   future combined legal package. Obtain independent native rehearsal and owner
   installation-only approval of exact hashes. This step is not complete.
2. Run SELECT-only `readiness.sql`; every function/table/count/settings comparison
   must match. Inspect root/history prerequisites separately; `preflight.sql`
   embeds their non-writing assertions for future approved transaction use.
   Re-capture/re-review changed baselines, never weaken checks to pass.
3. In **one approved migration transaction**, security → booking → atomic collection.
   Control-plane project ID must equal `eyhmarmekioovcjibcbr`; the SQL setting is
   only a guard. Wrapper uses advisory lock, 5s lock/60s statement timeout, locks
   historical tables including delivery settings, rechecks baseline under lock,
   compares before/after protected historical row fingerprints and records an
   immutable owner-only RLS ledger plus function/ACL fingerprint. No hosted step
   in this sequence has been executed.
4. Verify post-install closed state and real transport denial. The package leaves
   all payment flags/ready/maintenance/settings unchanged, no actors, UAT window/
   capability closed, collection EFT expiry null, policy off, R0 fee and no delivery
   settlement approval. Its Auth email sink **definition does not configure Auth**;
   service isolation needs a separately approved configuration plan.
5. Stop for installation acceptance. Synthetic actor/bank/document provisioning,
   UAT unlocks and orders require separate explicit authorization and isolation
   evidence. Current permission authorizes none of those actions.

Installing the security component changes the shared active-account helper and
closes existing authenticated access. Owner must approve that maintenance impact.
Retries require the same digest, function/ACL fingerprint and closed state;
uncertain commit means read-only ledger reconciliation before any retry.

Before commit: rollback the transaction. After commit: separately approved
`forward-containment.sql`, then `post-recovery.sql`. Containment is digest-bound,
closes policy/collection expiry/UAT expiry+capability and retains actor/history
evidence; it intentionally does not rewrite gateway/ready/maintenance settings,
restore a vulnerable helper or undo hosted service configuration. Settings drift
causes a stop, including an already enabled gateway; a separately approved audited
method-closure/recovery plan is then required. No destructive schema rollback.

The older `20261023` package and its hashes are preserved and verified. It includes
assisted/cash/custody and remains unapproved. Do not layer it over this reduced
package, install both unchanged, or use either after B–E without regeneration and
review. The new candidate explicitly rejects known existing broad/legal roots.

## Legal/compliance integration boundary — unresolved by design

Read-only comparison used reports and actual candidate SQL in `officebites-legal`:

| Phase | Candidate migration | Payment dependency / conflict |
|---|---|---|
| B | 20261026073911_phase_b_vendor_security_activation.sql | Metadata privilege remediation; forced pending/default vendor creation; activation prerequisites and explicit legacy scope. Absent hosted; minimal EFT package does not supply it |
| C | 20261026091408_phase_c_vendor_agreement_assignments.sql | Version/hash/vendor-bound assignment and immutable acceptance, no draft publication or enabled rollout. Assignment/acceptance evidence must feed activation |
| D | 20261026101346_phase_d_vendor_compliance.sql | Replaces banking submission permissions; pending owner can submit privately without selling privileges, independent review remains. Storage, compliance events, expiry/revocation, restoration and method eligibility affect payment/collection behavior |
| E | 20261026112602_phase_e_legal_publication_checkout_evidence.sql | Approved publication and customer/order-linked evidence, guest and optional collection integration; interacts with checkout wrappers and current function fingerprints |

Current payment-branch banking access requires an approved vendor (or admin);
pending owner cannot self-submit. **Do not activate a vendor to solve banking**.
D is the existing local solution: scoped pending submission, no self-approval,
independent admin verification and B/C/D activation gate. Admin-assisted submission
with a different approver is an existing alternative, but no real or staging
bank record creation is authorized here. No duplicate pending-bank RPC was added.

B–E change shared functions/privileges and introduce gates the frozen payment
installers do not anticipate. There is no justified combined hosted ordering yet.
Prepare an integrated artifact on a separately authorized integration branch after
review; rehearse B → C → D → E dependencies, Storage policies, owner transfer,
revocation/expiry, collection checkout, guest receipts and independent bank review
on native disposable Supabase. Recompute frozen fingerprints, do not broaden legacy
exceptions. Existing vendors' transition exceptions must remain explicit and visible.

Legal publication, acceptance rollout, compliance verification, bank approval,
vendor activation and method activation remain distinct approvals. No working draft
is binding. Fees remain approved 15% + 2%, exclusive of applicable VAT; additional
flat marketing tiers 5/7.5/10% still require period/attribution/accounting completion
and remain disabled. Vendor-direct EFT/PayShap wording must describe human receipt/
refund work: no automatic splits, instant settlement, bank refunds or invoicing
claim. These are production blockers, not implementation details to fill in here.

## Tests and limitations

| Check | Result |
|---|---|
| New and existing offline package/source/target/request verification | PASS; old artifact unchanged |
| `node checks/eft-package-local.mjs` | PASS: **19 new** baseline rejection/readiness, atomic install failure rollback, retry, immutable ledger, table ACL/function ACL/settings/digest drift, repeated containment, retained actor evidence and rollback assertions |
| Existing suites in same disposable run | PASS: checkout 38; Ozow 50; delivery 59; legal/commercial 103; repair 20; manual payments 109; booking 54; atomic collection 67; custody recovery 62; assisted/cash 64; UAT recovery 59; staging security 43 |
| Preparation/provision-core tests | PASS: 28 + 44 assertions; mocked APIs, no hosted writes. Test process spawning initially hit EPERM; `--test-isolation=none` passed |
| Checkout rules | PASS: 44; provider HTTP mocked |
| Lint | PASS exit 0, nine existing hook/fast-refresh warnings; no new application files changed |
| Vite build | PASS, 233 modules; initial sandbox spawn EPERM, rerun with local process permission passed; PWA output local only |
| Generated SELECT readiness on staging | PASS: functions, tables, counts, gatewayFlags, manual, delivery all true |
| Hosted migrations / orders / notifications / banking / unlocks | NOT RUN, prohibited |
| Native Supabase transport, concurrency, Storage/Auth/Realtime isolation, provider non-delivery | BLOCKED / not established in this task |
| Environment-dependent Preview fetch issue | Not reproduced or fixed; earlier failure is not claimed resolved by metadata or build |

Runner explicitly rejects native/external module overrides and checks a PGlite
instance. All mutating tests ran only in fresh in-process disposable PGlite. The
positive installation rehearsal substitutes freshly captured **fixture metadata
only in memory**; all DDL, authorization, drift checks and rollback logic execute.
Hosted-bound unmodified SQL rejects the fixture baseline. The local setup's synthetic
migration ledger never touches hosted history. These tests do not establish native
Supabase/REST correctness or approve any hosted target.

## Remaining P0 actions — owner, evidence and stop conditions

| Blocker / classification | Owner | Dependencies and required evidence | Safe resolution / stop |
|---|---|---|---|
| Effective REST/Auth exposure — external | Supabase operator + Support | Exact staging identity; redacted effective schema/hook/config precedence/reload evidence; role/capability transport matrix, service-role inventory | Read-only control-plane/Support confirmation first. Stop on unknown config, exposed private RPC or undocumented bypass; separate authorization before configuration changes |
| All-channel notification isolation — external | Operations/notification owner + Vercel team admin | Complete channel/provider/worker inventory, webhook access (current 403), Auth routes, queue/retry/sink controls and signed non-delivery attestation | Supply redacted exports and owner attestation; no test orders or notifications now. Stop on forwarding, real destinations or unknown channels |
| Backup/recovery and account outage — external | Database operator + service owner | Tested backup/PITR restore evidence, historical baseline, maintenance window, global active-account lockout acceptance and recovery owner | Review restore rehearsal and forward containment. Stop if retained financial/legal evidence or restoration cannot be guaranteed |
| PayFast maintenance provenance — external | Payment/configuration owner | Dated actor/change/reason evidence explaining earlier true versus fresh false and approved intended state | Audit read-only; no silent reset or enabling. Unexplained drift remains a stop |
| Reduced artifact absence — repository gap locally addressed; approval open | Engineering + independent Security reviewer + owner | New exact hashes/request/closed-state rehearsal; choose reduced, broad or combined scope; native full-schema comparison | Review candidate. Stop on scope mismatch, table/function/default-ACL drift or unknown commit; do not run both old/new installers |
| History/schema compatibility — mixed | Database engineering + reviewer | Full export/defaults/triggers/RLS/owners/grants/extensions, semantic ID map, function definitions and native rehearsal | Reconcile definitions, preserve original ledger. Stop on duplicate semantic migration or unsafe history repair; no blanket db push |
| B–E banking/security/compliance integration — repository + Legal/owner decision | Payment engineering + legal/compliance engineering + Legal/Security | No-merge comparison, native combined artifact review, pending-bank isolation, explicit legacy inventory and approved-document prerequisites | D supplies pending submission; B/C/D gate stays intact. Stop if activation is proposed merely to permit banking, drafts become approved, or frozen fingerprints are bypassed |
| Installation authority — owner approval | Workspace/project owner | All installation P0 evidence above, named exact artifact/target, separate authorized execution scope | Current authorization is local-only. No hosted action follows this report |

Shortest remaining sequence: operator/Support service evidence + notification and
backup/maintenance attestations → explain PayFast state → choose package/integration
scope → full native schema/transport/recovery review → separate installation review.
Each stage stops on missing evidence; repository edits cannot manufacture attestations.

P1 after installation acceptance: a separately approved no-funds plan with synthetic
actors/non-routing bank instructions, independent simulated compliance/bank evidence,
approved R0 destination/window/capacity/cutoff, bounded auditable TTL/unlock, outsider
denials, guest/member atomic replay, receipt/refund/cancel/snapshot/race cases and
closed closeout with exact test-only deltas. No real bank transfer or notifications.
The prior report's no-funds plan remains applicable; nothing was provisioned now.

P2 before real funds: Legal/Finance/Operations approve signed vendor schedules,
tax/disclosures, fee/refund/accounting SOPs, verified banking and legal acceptance,
operating capacity and customer notices, resolved legacy exceptions, production
artifact/recovery and explicit EFT-only activation. Marketing and other methods
remain excluded and disabled pending their own readiness/approval.

## Exact local file inventory

Modified: `checks/checkout-database.mjs` — one opt-in test hook only.

Added:

- `checks/eft-package-local.mjs`
- `checks/uat/eft-installation-package.test.mjs`
- `checks/uat/prepare-eft-installation-package.mjs`
- `checks/uat/fixtures/eft-staging-baseline-20261026.json`
- `checks/uat/fixtures/eft-p0-readonly-evidence-20261026.json`
- `supabase/staging-release/20261026-eft/baseline-capture.sql`
- `supabase/staging-release/20261026-eft/readiness.sql`
- `supabase/staging-release/20261026-eft/preflight.sql`
- `supabase/staging-release/20261026-eft/install.sql`
- `supabase/staging-release/20261026-eft/post-install.sql`
- `supabase/staging-release/20261026-eft/forward-containment.sql`
- `supabase/staging-release/20261026-eft/post-recovery.sql`
- `supabase/staging-release/20261026-eft/manifest.json`
- `supabase/staging-release/20261026-eft/apply-migration-request.json`
- `supabase/staging-release/20261026-eft/README.md`
- `docs/eft-p0-resolution-20261026.md`

Ignored local helper scripts and build/test output were generated only in the payment
workspace/runtime. No prior untracked file was deleted or replaced. HEAD unchanged;
all new work remains local and uncommitted for review.

## Decisions

| Boundary | Decision | Evidence still required |
|---|---|---|
| Local candidate review | **GO, completed** | Exact artifacts/tests available; independent review remains |
| Staging migration installation | **NO-GO** | Effective service/isolation, notification attestation, backup/maintenance acceptance, state provenance, full native schema/history review, scope and execution approval |
| Hosted no-funds UAT | **NO-GO** | Installation acceptance plus protected transport, all-channel non-delivery, integrated security/activation requirements, synthetic readiness and bounded actor/unlock authorization |
| Real-money EFT launch | **NO-GO** | Successful UAT, production security/legal/compliance/banking/accounting/operations and explicit launch approval |
| PayShap/PayFast/Ozow, marketing, R10/R15 delivery, cash | **Excluded / NO-GO** | Separate readiness and authorization |

Stopped for review before all hosted changes.
