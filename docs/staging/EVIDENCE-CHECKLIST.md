# Next staging approval gate — 27 October 2026

This is the remaining action list, not authorization to execute it. No hosted SQL,
configuration change, publication, activation, upload or order was performed.

| Action / owner | Source and exact evidence to return | Status / dependency |
|---|---|---|
| DBA: refresh staging preimage after SQL approval | Run `checks/staging-installation-preflight.sql` against independently selected `eyhmarmekioovcjibcbr`; return redacted results. Require exact 54-entry history and 13 guarded function hashes, reviewed object owners/RLS/ACLs, no partial B–E installation, all four gateways disabled. Review schema and default privileges as well as function hashes. | **Pending external execution approval.** Dated captures and reconstructed native baseline are not a current hosted schema dump. Any drift stops installation and requires a revised local delta. |
| Platform administrator: confirm supported policy executor | Dashboard identity plus authoritative confirmation of existing `postgres` policy-only delegation on `storage.objects`, exact restrictive-policy support, supported runner and ledger columns/recording. Use `SUPABASE-POLICY-AND-API-REQUEST.md` if unavailable. | **Pending administrator; Support only if necessary.** No write probe, owner transfer or managed-role grant. Native owner fallback passed; hosted supautils execution remains unverified. |
| API/Auth/Storage administrator: effective service contract | Redacted Dashboard configuration and, where needed, Support confirmation of effective PostgREST schemas/hooks/precedence, JWT handling, Auth redirects/hooks/fallbacks, private Storage behavior. Then sanitized read-only transport probes from runbook §3. | **Pending.** SQL settings alone do not prove effective service configuration. No new signup/OTP/invite before notification isolation. |
| Notification operator: sign non-delivery inventory | Account for SMTP/default email, SMS, push, database triggers/cron/queues, external workers/webhooks and all six active Edge functions in `docs/release/staging-channel-control-plane.json`; record destinations/sinks, retries and fallback handling without secrets. | **Pending.** Edge inventory was refreshed; absence of outbound delivery was not verified. All synthetic writes depend on isolation. |
| Recovery/release owner: accept maintenance and recovery | Current staging backup/PITR evidence, exact restore point, RPO/RTO, named executor/stop owner/window and recovery of Storage bytes/Auth/provider/Edge/Vercel state. Accept reconciliation of obligations after a restore point. | **Pending.** Local cold restore passed for 13 record sets; it cannot certify hosted recovery or external state. Installation needs explicit maintenance acceptance. |
| Owner/legal/accounting: supply final factual inputs and exact text | Approval statement is recorded in `OWNER-APPROVAL-RECORD.json`. Supply verified disclosure facts and complete Vendor Agreement, Operating Standards and vendor-specific schedule; reconcile VAT/invoice treatment. See `DOCUMENTS-AND-EXISTING-VENDOR.md`. | **Approval intent received; completeness pending.** No broad approval is requested again. Working markers and missing text cannot be published or treated as verified facts. Publication requires its own review gate. |
| Vendor-support administrator: verify SHE COOKS BY SNE linkage | After separate SQL approval, run `checks/she-cooks-existing-account-preflight.sql` in the intended project. Return aggregate single-account/link/role/status result, without IDs or banking. Resolve ambiguity manually before changing anything. | **Pending real-account lookup.** Local existing-account reuse passed. Use her existing login/vendor association; do not provision/import a duplicate or infer an EFT/compliance exemption. |
| Frontend operator: establish protected staging target | Independently verify Preview protection and both built/served Supabase host `eyhmarmekioovcjibcbr`; retain sanitized build/runtime evidence. Required public variable names are in runbook §3. | **Pending hosted Preview verification.** Earlier local staging-target build retained; no deployment/environment change authorized here. |

## Locally completed — do not repeat unless the package changes

- Separate staging delta and atomic installation bundles: **54 → 55 → 56**;
  exact dependencies and hashes in `docs/release/staging-installation-manifest.json`.
  All four production candidate hashes remain unchanged. Staging does not replay
  production foundation SQL or repair historical migration IDs.
- **139 native PostgreSQL assertions passed**, including owner restrictions,
  activation/acceptance/banking isolation, order/payment concurrency and containment.
  Ten captured staging function definitions matched reconstructed preimages.
- Three operator SELECT-only query files passed disposable native verification.
  The real vendor was not queried. Existing vendor reuse was tested synthetically.
- Failed-transaction rollback and forward containment preserved historical records;
  cold physical recovery matched all **13 table counts/digests**, closed payment
  flags and 56-entry ledger. Both disposable clusters are stopped.
- Existing 119 production assertions, 69 browser tests and 34 focused regressions
  remain historical evidence. No application source changed in this installation
  handoff. Supautils runtime, hosted APIs and managed backup recovery are not covered
  by native assertions.
- Final handoff validation: nine Node syntax checks, artifact/production hashes,
  sensitive-literal scan and `git diff --check` passed. Lint passed with nine
  existing frontend warnings. The PowerShell recovery launcher was blocked by the
  machine execution policy; the Node recovery orchestrator completed the drill
  without changing or bypassing that policy.

## Exact decisions

| Gate | Decision now | Evidence to change the decision |
|---|---|---|
| Local staging package review | **GO** | Manifest, native results, recovery evidence and proposed operator actions are ready for review. |
| Hosted staging installation | **NO-GO** | Fresh preimage/schema review, supported executor/ledger path, effective API/Auth controls, isolation, backup/maintenance acceptance and explicit installation approval. No legal publication or payment activation is included. |
| Hosted synthetic UAT | **NO-GO** | Successful installation/postflight, protected staging frontend, API/JWT/RLS/Storage probes, signed isolation and separate approval for narrowly scoped synthetic records/test rollout. |
| Legal publication / real-money launch | **NO-GO** | Complete exact approved legal versions/factual inputs and actual vendor schedule; independent banking/compliance verification; real-account transition review; hosted UAT evidence; production-specific preflight/recovery/release approval. |

The next operator action is to review this packet and obtain approval for the
**read-only staging preflight**, not to run an installer. Execution order, expected
results and stop conditions are in `INSTALL-AND-UAT.md`; the unsent minimal provider
request is `SUPABASE-POLICY-AND-API-REQUEST.md`.
