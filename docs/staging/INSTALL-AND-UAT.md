# Staging installation and no-funds UAT

**Target: eyhmarmekioovcjibcbr. Prepared locally; installation/UAT approval pending.**
No hosted SQL was executed in this task. Existing evidence is dated, not silently
refreshed. Production `gfzhdkitdyqftealgqfi` and its four-file installer are excluded.

## 1. Approval packet — stop until every prerequisite is supplied

| Owner | Exact artifact / expected result | Stop condition |
|---|---|---|
| DBA | Separately approved results of `checks/staging-installation-preflight.sql`; 54 history entries, last `20261021100655`, history MD5 `9befc9e98322a4517850501c61be9696`; 13 guarded function hashes match | Any history/definition/owner/RLS/grant drift, enabled method, existing B–E/checked-settings partial install |
| Platform admin | Dashboard project identity; `postgres` policy-delegation path on `storage.objects`; ledger has `version,name,statements` | Unverified supautils path; 42501; unsupported runner or migration ledger |
| API/Auth owner | Effective public-only intended API surface, private-schema restriction, hook/pre-config precedence, real JWT rejection, recovery/redirect/Auth-hook review | SQL GUCs offered as sole runtime evidence; client service key; unknown hook/fallback |
| Notification owner | Signed email/SMS/push/webhook/cron/queue/Edge/worker isolation inventory and sink/no-delivery attestation | Any real recipient, fallback sender, retry/forwarding or unreviewed outbound provider route |
| Recovery + release owner | Current staging backup/PITR availability, exact restore point, RPO/RTO acceptance, separate Storage-byte/Auth/config/Edge recovery, named executor/stop owner/window | Only a database snapshot, no external-state plan; no maintenance acceptance |
| Owner/legal/accounting | `OWNER-APPROVAL-RECORD.json` acknowledged; final verified disclosure values and real document/schedule sources identified | Working markers, missing agreement/standards/schedule, unresolved tax/fee accounting passed off as complete |

Read-only query files are **prepared for a later separately approved SQL session**;
they are not permission to run hosted SQL now. A prior 54-row capture alone is not a
fresh installation preflight. Keep raw tokens, bank details and personal identifiers
out of Git and reports.

## 2. Exact reviewed installation actions — future approval only

The staging-specific manifest is `docs/release/staging-installation-manifest.json`.
Verify SHA-256 of both canonical SQL and installation bundles against that file.
Do not edit a guard, replace a hash with the live value or change flags to make it pass.

1. Approve and run **only**
   `release/staging-candidates/20261027123110_staging_integrated_vendor_legal_payments.installation.sql`
   using the verified staging `postgres` SQL Editor/approved runner. This composes
   B–E, launch/fee guards and checked settings over the existing staging foundations.
   It does not reinstall checkout, finance, manual tables or the singleton fix.
   Expected history **54 -> 55**, new version `20261027123110`; all payment and legal
   rollout values remain closed. Existing users/vendors/orders/receipts stay intact.
2. In a separately approved Storage Dashboard/API action, create **vendor-compliance**:
   private, maximum **5,242,880 bytes**, allowed MIME types exactly
   **application/pdf, image/jpeg, image/png**. No documents/real banking are uploaded.
   A pre-existing bucket with different settings is a stop, not an automatic update.
3. Approve and run **only**
   `release/staging-candidates/20261027123115_staging_compliance_storage_policies.installation.sql`
   through the confirmed `postgres` policy-delegation path. Expected history
   **55 -> 56**, new version `20261027123115`, six exact policies: two scoped
   permissive INSERT/SELECT policies and four restrictive INSERT/SELECT/UPDATE/DELETE
   boundaries. Retain AS RESTRICTIVE explicitly; a permissive replacement is unsafe.
4. Run the separately approved SELECT-only `checks/staging-installation-postflight.sql`:
   history 56 with both exact names; six policies; private bucket configuration;
   intended owners/RLS/ACLs/trigger definitions; all four methods disabled, customer
   and vendor acceptance/publication/acquisition false; original-data digests retained.
   Reconcile uncertain connection results by ledger/object evidence before retrying.
5. Use the platform-supported schema-cache reload only if separately approved, then
   verify the API contract. Physical functions existing is not sufficient evidence
   of PostgREST exposure/cache/reload. Missing optional collection/delivery/assistance
   RPCs remain excluded and are not installation failures.

`.installation.sql` is the canonical SQL plus atomic recording of its **new**
version/name/exact statements in the normal migration ledger before COMMIT. It never
repairs old IDs. Do not execute both canonical and bundled copies, use these bundles
inside another migration runner that also records history, or run blanket `db push`.

If delegated policy execution is unavailable, stop and use
`SUPABASE-POLICY-AND-API-REQUEST.md`. The separately owned fallback was tested locally,
but needs a supported provider executor and ledger coordinator; do not substitute
the owner SQL into the atomic postgres bundle or grant it ledger access.

## 3. Read-only API verification plan — after contract/config approval

Use only a protected Preview whose **built and served** Supabase host is staging.
The retained local build is staging-targeted; no Preview was deployed here. The
required public variables are `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`. Do not copy production credentials or change Vercel
environments as part of this runbook without separate approval.

| Probe / existing identity | Expected evidence | Stop |
|---|---|---|
| REST OpenAPI/GET RPC signature inventory with public key | Essential RPCs exposed with exact arguments; no mutation endpoint called as a read probe | Missing essential RPC, unintended private surface |
| GET `/auth/v1/user` with existing invalid/expired token | 401, no authenticated identity | Invalid token accepted |
| Existing customer token, read admin workspace/compliance | 42501/permission denial; no vendor/admin bank data | Any unauthorized payload |
| Existing vendor A token, read vendor B compliance/schedule | Denial/empty permitted scope; no B schedule/private upload metadata | Cross-vendor evidence |
| Anonymous current legal state / portal | Rollout false; approved public text only; no vendor-specific fee schedule | Draft/scoped text exposed; gate unexpectedly open |
| Current vendor payment-method availability | Closed/empty or false while flags/prerequisites absent; no bank destination | Banking displayed before an eligible order |
| Private Storage public URL/other-vendor object path | No bytes; 400/401/403/404 or permitted empty listing | Public bucket, object read or replacing/deleting evidence |

Do not create tokens by signup/invite/magic-link/OTP to complete these probes until
notification isolation and those Auth actions are separately approved. Capture
sanitized request IDs/status/error codes; redact Authorization, apikey, cookies,
capability tokens and document/bank payloads. Transport checks were not performed here.

## 4. Synthetic UAT — separate write approval, no money

Only after steps 1–3 pass: approve isolated synthetic identities, fictional schedules,
test receiving details that cannot receive funds, private synthetic PDF/JPEG/PNG and
non-delivery channels. Authorize the precise temporary staging-only rollout changes
separately. Installation itself never opens a payment method or acceptance.

1. Pending synthetic vendor uploads evidence/submits a banking version. Verify no
   selling privileges, owner cannot self-approve and another vendor cannot read it.
2. Independent admins assign exact approved synthetic Agreement, fee schedule and
   Standards; verify identity/premises/CoA applicability/operations/bank with expiry.
   Unchecked authority acknowledgement -> Accept & Continue -> immutable same receipt
   on retry. Confirm rejection of stale versions, revocation and expired evidence.
3. Activate only the approved synthetic vendor after all prerequisites. Guest/member
   EFT and PayShap checkout: one vendor, exact current legal review, unique request
   and payment reference, protected post-order instructions, accepted fee snapshot.
   Never transfer funds or submit an external provider callback.
4. “I've paid” must stay unpaid. Independently verify the **synthetic** receipt;
   duplicate verification must create one paid event/receivable. Test wrong amount,
   suspicious/rejected state, cancellation after report, refund evidence and audit.
   No automatic bank refund, provider split, invoice or marketing charge is expected.
5. Exercise keyboard/mobile, account switching, offline/lost response, failed/reloaded
   admin settings and concurrent stale revision. Close test rollout with the approved
   containment procedure; retain every historical record and reconcile test state.

Expected durable evidence: sanitized HAR/screenshots; actual JWT/guest/RLS/Storage
denials; order/acceptance/profile/schedule/fee hashes; one receipt/ledger row under
duplicates; preserved historical digests; all payment flags closed after UAT.

## 5. Recovery / containment

`checks/staging-forward-containment.sql` is prepared, not executed hosted. After
incident approval, replace its incident-reference sentinel with the real approved
reference and use verified DBA execution. It atomically closes new payment initiation,
vendor assent and publication, preserves customer legal enforcement, appends audit,
and retains existing instructions, receipts and authorized reconciliation. It does
not reopen, drop tables, erase evidence or restore old enabled-state snapshots.

Local evidence: **139 staging assertions**, ten captured function fingerprints
matched, three operator query files verified, existing-account reuse tested. The
cold restore restored **13 table counts/digests**, closed flags and the 56-entry
ledger in another disposable native cluster. Both clusters were stopped. This is
not hosted PITR certification, a hosted notification test or Storage-byte recovery.

For an actual restore after transactions, stop new initiation, preserve external
bank/provider/notification evidence, approve the restore point and reconcile every
post-point order/payment/legal obligation. Database-only restore does not restore
Storage bytes, Auth/provider settings, Edge deployments or Vercel environment.

**Next gate:** owner reviews this exact package plus administrator/Support evidence;
DBA supplies a fresh approved preflight. Installation-only and synthetic-UAT approvals
are separate. No hosted action is authorized by creating these files.
