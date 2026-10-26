# EFT checkout and admin settings — local fixes, 26 October 2026

**Local implementation tested; hosted fix unconfirmed. Installation, hosted UAT and
real-money release remain NO-GO. No hosted mutation, banking approval, order,
notification, gateway change, deployment, push or merge was performed.**

Workspace: `officebites`, branch `feat/vendor-direct-launch-payments`, unchanged
HEAD `4cac836a35ef0e75e589a2640772f775ca1a260c`. Prior local changes and legal
worktree retained. This is a fix report; the earlier P0 handoff remains applicable.

## Root causes and evidence

| User-visible issue | Confirmed cause / evidence | Result |
|---|---|---|
| No EFT option/bank details at checkout | Fresh staging SELECT at **14:02:49 UTC / 16:02:49 SAST**: all four methods disabled, bank profiles 0, approved profiles 0, `profile_submitted` events 0. `get_vendor_manual_methods` requires enabled+ready+not-maintenance, approved profile, approved unarchived vendor and active owner. `create_manual_order` independently rechecks eligibility | Correct fail-closed behavior. No option was forced visible. Protected recipient instructions remain on the payment screen after a safely created eligible order, not public checkout |
| Admin settings error is unhelpful | Before-fix browser reproduction: synthetic RPC `42501` rendered only “Save failed or its outcome could not be confirmed. Reload settings before trying another save.” Service discarded the RPC code; form discarded the failure entirely | Preserve machine code and show allowlisted permission, stale-state, backend-readiness, validation or activation guidance. Raw SQL/network diagnostics are not displayed |
| Newer admin changes can be overwritten | Before-fix browser reproduction: admin drafts R600, server moves to R800 before save; old form reports “Save and reload succeeded” and overwrites newer state. Client conflict detection ran only on reload; setter had no expected version | New atomic checked setter locks settings/manual gateways, compares server revision and rejects stale saves with `40001` before mutation. UI retains draft and requires read-only reconciliation |
| Admin cannot initiate existing assisted banking process | Admin workspace previously displayed profiles/approval but no submission form. Pending owners are denied by existing `private.manual_operator`; approved owners can submit via vendor settings | Added admin-assisted vendor selection/submission. Result remains pending, with a different administrator required for approval. No seller activation or pending-owner permission workaround |
| Busy state can survive account switching | Busy state lived in parent workspace while settings form was keyed by account; old completion correctly avoided new-account updates but left parent busy | Reset workspace transient state on account/vendor scope changes and use operation tokens so late completion cannot unlock a newer operation |

**The operator's original hosted save failure has not been attributed to a particular
request.** A read-only unified-log query failed with “Failed to get project's logs”.
No live settings RPC was invoked to reproduce it. Fresh function inspection shows
the corrected singleton update (`WHERE singleton=true`, exact row-count check),
postgres owner, authenticated/service-role grants and active stored-admin checks;
one singleton row exists. Do not claim the old singleton bug is still present or
that these local fixes establish a successful Preview save.

The exact original hosted status/code/session or network failure remains evidence
to collect from an **existing failed request**, without retrying a hosted save.
The reproduced `42501` is a controlled local fixture, not a claimed live log.

Zero retained profiles plus zero submission audit events establish that no completed
auditable submission exists in this staging baseline. They do not establish whether
a human never submitted, was blocked while pending, or experienced a transport
failure. No fictional banking or assumed operator actions were used as evidence.

## Implemented behavior

- `ManualSettingsForm` sends the confirmed server version, preserves dirty drafts,
  locks duplicate requests, distinguishes failed save from failed reload, blocks
  uncertain resubmission, handles offline/account switching, and explains banking
  eligibility independently of method settings.
- `manualPaymentService.settings` calls `admin_manual_settings_checked` with numeric
  values and `p_expected_revision`; errors retain their machine code. No silent
  fallback to an unchecked write. If the reviewed backend revision is absent, the
  form explicitly stays read-only. Backend must precede the corresponding UI release.
- Admin banking form uses existing vendor reads and `submit_vendor_payment_profile`;
  lists pending/approved, unarchived vendors; stores no banking data in localStorage.
  Own submitted versions cannot be approved in the UI; the original RPC independently
  rejects submitter/vendor owner and derives reviewer identity/time on the server.
- Existing vendor submission, immutable approved versions, historical order recipient
  snapshots, RLS/ownership, receipt confirmation and checkout pricing were retained.
  Pending-owner self-service remains Phase D work, not duplicated here. Admin-assisted
  pending submission does not change the vendor status or confer selling powers.
- Customer “I've made payment” still only reports payment. SQL tests verify unpaid
  status until independently verified receipt, exactly-once receivables/commission,
  protected guest token access and refund/cancellation rules. No automatic bank refund,
  provider split or settlement promise was introduced.

## Forward-only SQL candidate and compatibility

`checks/manual-settings-concurrency-candidate.sql` is **not installed, approved or
in the automatic migration directory**. It adds:

1. Owner-only settings revision column and update trigger, including legacy writes.
2. Private opaque revision helper binding settings and manual gateway records.
3. A workspace wrapper returning the revision only to admins, retaining original
   role/scope checks and authenticated/service-role workspace access. The renamed
   internal workspace loses direct client EXECUTE.
4. Authenticated-only checked setter with active stored-admin checks, input validation,
   locked revision comparison and delegation to the existing singleton/audit/activation
   setter. No new acceptance table, actor, bank profile, unlock or payment flag.

Legacy setter remains for compatibility and still advances revision. A stale legacy
client can intentionally use that authorized API without a version; the new UI does
not. Coordinating all admin clients remains part of release review. Duplicate checked
calls with the old version reject without a second mutation/audit event; uncertain
responses require read-only reload, not automatic retries.

**Current dependency sequence, conditional on separate approval:**

1. Reconcile real hosted history/schema and P0 service/notification/backup/maintenance
   evidence. Manual payments already installed under `20261020100740`; singleton fix
   already under `20261021100655`, not local timestamps `20261020090841` /
   `20261021094956`. Do not replay them or repair the ledger blindly.
2. If the reduced R0 collection scope is selected, original EFT-only installer remains
   `security → booking → atomic`, exact request in
   `supabase/staging-release/20261026-eft/apply-migration-request.json`.
   SHA-256 remains `b80909ae1978d57323bce1093761197ad582d33384ee28016935286989cc9e4b`.
3. Review this checked-settings candidate **after** that installation, before the new
   UI. Disposable rehearsal verifies its DDL/ACLs and unchanged gateway records on the
   exact locally rehearsed EFT package. Settings candidate SHA-256:
   `453bddc5adc15a471877adc9fdeb101a28313296574d8b5fae0894c6c32f1110`.
   Target-marker SQL is not independent project identity proof.
4. These extra functions intentionally change the original package's frozen function
   fingerprint: its retry now rejects drift. Installing the settings candidate first
   would also invalidate the original baseline. A reviewer must approve the complete
   forward sequence/current fingerprints and recovery evidence; never rerun/bypass
   the old installer after patching. The old package/manifest were not silently rebuilt.
5. B–E still requires a separately reviewed integration artifact and native rehearsal.
   Do not layer a frozen installer over B–E, merge that worktree here, erase legal
   acceptance gates, approve draft schedules or broaden existing-vendor exceptions.
   The broader assisted/cash/custody package remains an alternative, not an extra step.

Existing backend methods and profile approval are already installed; settings save
does not create banking records, approve a vendor, attach Auth hooks or open the
collection policy/TTL. The new checked backend is absent on staging at this observation.

## Validation

All mutating SQL ran only in verified **fresh in-process PGlite**, with adapter
overrides rejected and `instanceof PGlite` checks. No native/hosted database was reset.

| Check | Result |
|---|---|
| Before-fix UI reproduction | Both targeted cases failed with the old generic error / stale overwrite; evidence described above |
| Settings SQL | **24 passed**: save/read, stale/duplicate rejection, validation, anon/non-admin denial, legacy revision, activation rejection/rollback, pending-owner denial, admin submission and different-admin approval without vendor activation |
| Post-EFT candidate compatibility | **4 passed**: installation without gateway mutation, anon/authenticated RPC ACLs and expected old-installer retry rejection |
| Existing SQL chain | Checkout 38; Ozow 50; delivery 59; legal/commercial 103; repair 20; manual payments **110**; booking 54; atomic collection 67; custody 62; assisted/cash 64; recovery 59; security 43 — passed in disposable runs |
| Original EFT package regression | **19 passed**; original sources/artifact preserved |
| Actual service contract / safe error mapping | **15 passed**, mocked RPC only; checked name/arguments, numeric conversion and preserved error code |
| Browser | **61 passed** in the final run: settings, profile, manual EFT and checkout suites; local harness with hosted Supabase requests blocked |
| Lint | Exit 0, same nine existing hook/fast-refresh warnings |
| Build | **PASS** final Vite/PWA production build (128 precache entries); local harness build also passed |
| Hosted save / orders / bank submissions / notifications | Not run; prohibited. Original save request diagnosis remains open |

Early local failures were not suppressed: an ineligible methods result can be either
an empty object or explicit false booleans after the collection wrapper; the test now
asserts no eligible method. A fixture precedence error returned the wrong vendor list;
that fixture was corrected. After account switching, private workspace details
intentionally remount closed; the test reopens profile history before approval.
Sandbox process-spawn EPERM required permitted local Edge/build execution. These are
distinct from the unresolved historical Preview fetch failure.

Native concurrent Supabase/PostgREST/Auth/Storage/Realtime and all-channel notification
isolation remain unverified. Browser mocks plus sequential PGlite do not establish them.

## Exact files changed in this task

Runtime modified:

- `src/components/features/ManualSettingsForm.jsx`
- `src/components/features/ManualPaymentWorkspace.jsx`
- `src/services/manualPaymentService.js`

Runtime added:

- `src/components/features/AdminPaymentProfileForm.jsx`
- `src/utils/manualSettingsError.js`

Tests modified (prior checks retained):

- `checks/admin-settings-browser.spec.mjs`
- `checks/manual-profile-browser.spec.mjs`
- `checks/manual-payments-database.mjs`
- `checks/browser-harness.jsx`
- `checks/checkout-database.mjs` (preserves previous EFT opt-in; adds settings hook)
- `checks/uat/eft-installation-package.test.mjs` (optional post-install callback;
  original 19 checks retained)

Added:

- `checks/manual-settings-concurrency-candidate.sql`
- `checks/manual-settings-database.mjs`
- `checks/manual-settings-local.mjs`
- `checks/manual-settings-service.mjs`
- `docs/eft-checkout-settings-fix-20261026.md`

No checkout, receipt, payment-pricing, gateway configuration, existing migration,
legal-worktree or previously prepared installer source was rewritten. Prior release
notes, untracked preflight/script, operator/support/dependency handoffs remain intact.
Generated logs/screenshots/build output stay in ignored local directories.

Closeout SELECT at **14:20:06 UTC / 16:20:06 SAST** again confirms all methods
disabled, bank/approved profiles both zero, 15 minutes/R500, checked setter absent.
Preservation hashes match the prior reports for original release notes, untracked
preflight/preparation script, both readiness reports and frozen installer.
`git diff --check` passes; HEAD/branch unchanged. No outstanding final local test
failure; earlier fixture/sandbox failures are disclosed above.

## Shortest route to a working release / next operator action

1. **Now:** review these local fixes and exact SQL; obtain the existing failed Preview
   request's RPC name, HTTP status, error code and correlation ID without retrying a
   save. Exclude JWTs/keys/request bodies. This closes the original live-save diagnosis.
2. Close the existing named P0 service/notification/backup/maintenance/PayFast-provenance
   items and exact combined migration/native compatibility review. The
   [operator runbook](eft-operator-runbook-20261026.md) lists owners/evidence.
3. Separately authorize/install the reviewed staging sequence, keep flags/gates closed,
   verify protected transport/recovery, then release the corresponding reviewed UI.
   Defining a gate/sink is not attaching or verifying it.
4. Under separate controlled authorization, existing vendor supplies actual verified
   banking through the secure vendor route if eligible, or admin-assisted pending
   submission with a different independent approver. Complete legal/compliance and
   vendor activation prerequisites independently; no approval just to unlock banking.
5. Separately authorize bounded, non-routing, synthetic no-funds R0 Eduvos UAT:
   staff/window/capacity/cutoff, actors/TTL/unlock, role denials, guest replay,
   independent simulated receipt, snapshots, refund/cancel and closed closeout.
6. Only after acceptance of production-specific legal/banking/compliance/accounting/
   operating/security evidence, obtain explicit EFT-only production activation.
   Keep PayShap/PayFast/Ozow, marketing, cash and R10/R15 delivery excluded.

**GO:** local fix review. **NO-GO:** staging installation, hosted UAT, real-money
launch. The expected 27 October order date does not change those evidence gates.
Stop for review before hosted execution.
