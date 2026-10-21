# Admin payment settings safety: local UI and proposed backend contract

## Scope

Local UI implementation only. No migration, hosted query/write, account, payment, deployment or production change is part of this task. Existing unrelated working-tree changes are preserved. The staging baseline supplied by the operator is all four methods disabled, deadline 15 minutes, threshold R500; this task does not re-attest hosted state.

`ManualSettingsForm` separates a confirmed server snapshot from its editable draft. Successful mutation clears the reason even if the following reload fails. Only a successful settings read updates the confirmed snapshot. Conflicting refreshed values preserve the draft and block saving until the operator deliberately discards it. Controls lock throughout mutation/reload; ambiguous mutation errors require a read-only reconciliation before another save. No automatic mutation retries. Ordinary unchanged saves are blocked; there is intentionally no UI exception for re-auditing unchanged settings. Any such operation requires a separately justified workflow and approval.

The form reports three outcomes: save failed/outcome unconfirmed; save succeeded but reload failed; save and reload succeeded. A failed mutation response is not proof of rollback. After an uncertain result, editable fields remain locked until an explicit read-only reload succeeds. Reload failure preserves the draft and last confirmed state. A successful reconciliation after a confirmed save adopts actual server values; a failed/unconfirmed save retains its draft and raises a conflict if the server changed. The snapshot is session-local, not an authoritative audit ledger or concurrency guarantee across tabs.

UI reason maximum is 500 to match the existing downstream gateway notice limit. The generic vendor/payment workspace actions remain unchanged. Review new files together with the already-uncommitted workspace file; do not stage the whole working tree.

## Backend proposal — not implemented or approved for installation

### Revision and atomic updates

Add a single monotonically increasing revision covering manual settings and both manual gateway rows. Every writer, including `admin_manual_settings` and `admin_update_payment_gateway`, must lock the shared revision row first and increment it exactly once per successful logical operation. Use one private transaction helper, so the combined RPC does not invoke the public gateway RPC twice and create nested revision/request operations. Lock order: shared configuration revision, singleton settings, gateway rows sorted by provider. Stage/version new signatures rather than ambiguously overloading the existing PostgREST RPC names.

The read contract returns revision plus actual enabled/ready/maintenance state, not only derived eligibility flags. Mutation input includes expected revision, idempotency key, intended values and reason. Server compares revision under lock; a mismatch returns a conflict with no configuration, gateway metadata or success-audit changes. Do not invent a revision from browser timestamps or compare only visible fields: an intervening same-value save still changes revision.

### Idempotency and response replay

Use a private request ledger keyed by environment, authenticated actor, operation and UUID request key, with a canonical server-generated payload hash including expected revision, values and reason. Recheck current active-admin authorisation before returning any stored response. Acquire the request lock before the configuration lock, consistently for every entry point. Same key/hash returns the previously committed result/revision without touching configuration or appending another settings/gateway audit event. Same key/different hash is rejected. Concurrent same-key requests wait for one committed result. Store result and configuration/audits in one transaction; rollback leaves neither a successful request entry nor partial gateway updates. Never mark success before commit or cache an unknown client outcome as failure.

Preserve committed key mappings for the supported replay window; reject expired keys rather than silently accepting them as new operations. Clients retain a key for one uncertain logical request and reconcile/read status before a deliberate retry. A new key is required for a new operator-approved operation. Reusing the same reason is not an idempotency mechanism.

### Staging activation interlock

An installation-attested staging-only interlock defaults locked. Both public RPC paths and a defensive manual-gateway trigger enforce it for every false-to-true activation (and, preferably, any request to leave a method enabled while the unlock is invalid). A normal active admin cannot unlock it through these RPCs or direct client table writes. Preserve the existing unconditional PayFast/Ozow marketplace blocks and historical reconciliation.

The separate unlock process must require explicit authorisation and restricted operator privileges, record approver/reason/UAT run/methods/expiry and expected revision, and attest project `eyhmarmekioovcjibcbr`. It must not infer approval from an admin role or a configuration reason. No production installation is implicit. If later adopted elsewhere, design and approve that environment separately.

Effective manual initiation must require an unexpired unlock as well as ordinary enabled/ready/maintenance/vendor/profile eligibility; an expired flag alone must never keep accepting payments. Enforce at method lookup and checkout RPC, including direct requests. Disabling remains possible with the interlock locked. Expiry blocks new initiation without stopping verification, refunds, historical callbacks or reconciliation. Unlock and activation are separate audited actions; no UI-only escape hatch.

### Authorisation, audit and gateway metadata

Retain active-account/admin checks, private table isolation, fixed search paths and narrow EXECUTE grants. Request keys do not grant privileges. Audit records gain correlation key, previous/new revision, before/after values and actor; existing immutable history remains untouched. Keep one settings event and two gateway events for a successful combined save. Replays, conflicts and rejected writes produce no success events. Separate security logging may record rejection without customer data, banking information or credentials.

Successful gateway changes update notice/updated_by/updated_at once; replay cannot update timestamps. Ready flags and unrelated provider maintenance remain unchanged unless explicitly included in an authorised operation. Admin gateway-only writes must share revision/idempotency/interlock enforcement, otherwise they would bypass combined-form protections. No financial/order records are touched by configuration writes.

### Compatibility and recovery

1. Inventory every deployed caller and capture definition/ACL/RLS/configuration baselines. Test recovery locally before installation approval. No SQL is prepared/applied by this task.
2. Add private revision/request/interlock storage and new RPC/read contracts with least privilege. Require separate migration and security review.
3. Migrate both admin clients together. Legacy mutation signatures must fail closed with a clear refresh-required response; do not invent an expected revision or a request key for an old client. Existing read contracts and historical payment processing remain compatible. Old clients temporarily cannot save settings; this is an explicit rollout dependency.
4. Prevent compatibility wrappers or maintenance scripts bypassing the shared writer/trigger. Test same-key parallel calls, revision races across both RPCs, active role revocation before replay, lock/expiry races, and transaction rollback after either gateway update.
5. Recovery locks activation first and preserves disabled state, request mappings, audit history and revisions. UI rollback must retain a fail-closed server response for old writes. Do not restore an unguarded legacy writer while claiming concurrency/idempotency guarantees. A separately approved emergency definition/config restoration must keep activation blocked and reconcile uncertain requests before any further save. Do not delete tables or reverse history automatically.

Remaining risk until separately installed: an active admin or another tab can still overwrite current settings through existing RPCs. UI safeguards reduce accidental submissions; they do not supply server concurrency, exactly-once execution or an activation authorisation boundary. The repeated-save investigation did not establish which browser/session caused the historical events.

## Local validation

Focused browser scenarios cover unchanged-save prevention, success/reset, rapid submissions, pending mutation/reload locks, failed mutation reconciliation, committed-save/read failure, conflict handling and draft preservation after failed reads. All services are synthetic and hosted Supabase traffic is blocked. No hosted UAT claim follows from these local tests.

Executed against final code on 2026-10-21:

- Six focused admin-settings browser tests plus 19 existing manual-payment browser regressions: **25 passed**, two minutes, installed Microsoft Edge. Includes a second reload that must not clear an unresolved conflict. Command: `node node_modules/@playwright/test/cli.js test admin-settings-browser.spec.mjs manual-payments-browser.spec.mjs` with the existing local Node runtime and `PLAYWRIGHT_CHANNEL=msedge`, `PLAYWRIGHT_DISABLE_GPU=1`.
- Browser harness build passed using `checks/vite.browser.config.mjs` and `--configLoader native`.
- `npm.cmd run lint`: exit 0; existing warnings only. Log: `.officebites-local/admin-settings-lint.log`.
- PWA build: exit 0 using `node node_modules/vite/bin/vite.js build --configLoader native`; service worker generated with 125 precache entries. Log: `.officebites-local/admin-settings-pwa-build.log`. Native config loading avoids a sandboxed Windows path-resolution failure in the standard bundled-config invocation; final browser and PWA worker execution used approved local process escalation.
- Targeted tracked diff whitespace checks passed. No commit, push or deployment.

Task file inventory: `src/components/features/ManualSettingsForm.jsx` (new), existing uncommitted `ManualPaymentWorkspace.jsx` (replace only its settings form with the isolated component), `checks/browser-harness.jsx`, `checks/admin-settings-browser.spec.mjs` (new), `playwright.config.mjs`, and this document. No backend implementation or migration added.
