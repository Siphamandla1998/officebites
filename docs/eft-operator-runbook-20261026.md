# EFT P0 operator handoff — 26 October 2026

**Installation NO-GO · hosted synthetic UAT NO-GO · real-money launch NO-GO.**

Read both [P0 resolution](eft-p0-resolution-20261026.md) and
[read-only readiness](eft-readiness-readonly-20261026.md) reports completely.
The earlier report's missing reduced artifact is superseded by the prepared,
unapproved EFT-only candidate. Its existence is not an unresolved implementation
task; independent review and scope approval remain open. Completed tests were
not rerun. Only documentation is added in this handoff.

Workspace/branch: `C:/Users/Siphamandla.Khumalo/Documents/officebites`,
`feat/vendor-direct-launch-payments`; HEAD `4cac836a35ef0e75e589a2640772f775ca1a260c`.
Target is **officebites-staging / `eyhmarmekioovcjibcbr`**.
Vercel project: `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71`.
Last recorded Preview: `dpl_3GkXn3xL5nWA9NNER2YWDxTDp2ej`.
Those identity/Preview details are inherited evidence, not fresh control-plane reads
in this handoff. Refresh before a future decision. No legal-worktree changes.

## Collection rules

Use existing authorized project-admin access. Inspection only: do not click Save,
Enable, Restore, Send test, Invite, Resend, Invoke or Run on a mutating query.
Do not authenticate a new test account, create orders or probe a webhook/provider.
Read existing logs without retry/replay. Do not collect keys, tokens, passwords,
SMTP credentials, bank details, customer bodies or raw environment/config dumps.

Each artifact needs project/deployment ID, UTC observation time, operator name/role,
read-only source/filter, redacted capture or restricted evidence reference, SHA-256,
reviewer and decision. A screenshot of a setting is **declared configuration**;
effective runtime and successful isolation are separate evidence. Use statuses
OPEN / PARTIAL / VERIFIED / N/A-with-reviewed-proof; silence or 403 means OPEN.
Store sensitive originals in controlled operator storage; repository contains only
redacted summaries/references. Evidence collection does not authorize remediation.

## Minimal evidence register — every unresolved P0

No row below is closed by this handoff. Assign named people to the owner roles.

| ID / owner | Source → expected artifact | Status | Blocking dependency / exact closure requirement |
|---|---|---|---|
| P0-01 Supabase operator + Support; Preview owner | Dashboard Data API/Auth, role/config catalogs, existing REST/Auth/Storage/Realtime logs, Vercel deployment/build evidence → `service-exposure` bundle | PARTIAL | Exact current target/Preview and served backend host/key membership; effective exposed schemas, PostgREST version/config precedence/pre-request/pre-config/all-instance reload; Auth signup/email/SMS/MFA routes and failure behavior; Storage/Realtime controls; service-role inventory; reviewed denial/allow matrix. SQL settings alone insufficient |
| P0-02 notification owner + Vercel team admin | Auth/Edge/DB hooks/cron/queues, Vercel webhooks/integrations/log drains, provider/worker consoles → signed `channel-isolation` inventory | OPEN | One row per reachable path: absent / accepted non-forwarding sink / approved block, owner, routing, retry/forwarding control, recovery and evidence. Prior Vercel webhook 403 and unknown channels must be resolved; no live notification tests |
| P0-03 DB operator + service owner | Database Backups/PITR, controlled restore-rehearsal records, Storage/config recovery inventories → `recovery-and-maintenance` acceptance | OPEN | Usable recovery point/coverage and retained history; actual disposable restore evidence with accepted RPO/RTO; separate Storage object/config/Edge/Auth recovery; named recovery owner, window, account-lockout impact and containment limits accepted |
| P0-04 payments/config owner + Phase E evidence owner | Gateway row + filtered business audit + original Phase E observation/change records → signed `payfast-provenance` reconciliation | PARTIAL | Identify authorized actor/change/reason, before/after and original conflicting query time/target; approve intended maintenance state. Fresh event is correlation, not approval; no reset |
| P0-05 engineering + independent Security reviewer + owner | EFT manifest/request/SQL and alternative broad package → signed `artifact-scope-review` | PARTIAL | Choose reduced closed install, broad or future integrated scope; exact SQL/hash/target/request and forward containment independently accepted; native disposable rehearsal tied to exact artifact and complete baseline, beyond existing PGlite evidence |
| P0-06 DB engineering + reviewer | Migration history and full schema-only/catalog capture → `history-schema-diff` | PARTIAL | Reconcile semantic IDs/definitions, columns/defaults/constraints/triggers/policies/RLS/owners/ACLs/default privileges/memberships/extensions, inherited public search paths and advisor findings; preserve historical data. Ten-function/seven-table baseline is not exhaustive |
| P0-07 payment + legal/compliance engineers, Legal/Security | Separate B–E source/reports + [matrix](eft-legal-dependency-matrix-20261026.md) → signed integration boundary/forward-artifact plan | OPEN | Pending-owner banking without activation; independent bank verification; B/C/D activation and explicit legacy inventory; E guest/order evidence and commercial lock order. No combined ordering certified. Any combined artifact must be separately prepared/reviewed; no draft publication |
| P0-08 project/workspace owner | Accepted P0-01…07 evidence + exact artifact → dated installation-only authorization | OPEN | Explicit project, SQL/hash/name, executor, window, stop/recovery owner and permitted scope. Local preparation permission does not authorize installation, config changes, UAT or launch |

## Read-only operator checklist

### 1. Effective Supabase PostgREST / Auth / Preview — P0-01

- [ ] Confirm project header/name/ref in **Project Settings → General**, public API
  URL in Data API; record current deployment ID/commit and public backend mapping
  in Vercel. Privately confirm publishable-key project membership without recording
  its value. Capture served bundle/backend-host evidence using an already-authorized
  protected Preview session without submitting forms or creating a session/account.
  Redact HAR credentials; an earlier failed fetch remains unresolved.
- [ ] Open [Data API settings](https://supabase.com/dashboard/project/eyhmarmekioovcjibcbr/integrations/data_api/settings).
  Record Data API enabled state, every exposed schema, extra search path if shown,
  and automatic new-object exposure setting. Capture only, do not toggle. Use
  Database → Functions / Policies and read-only catalogs for actual object grants,
  owners, security-definer paths, RLS and defaults. Declared exposure, grants and
  row authorization are different controls. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)
- [ ] Inspect [Authentication → Hooks](https://supabase.com/dashboard/project/eyhmarmekioovcjibcbr/auth/hooks):
  enabled state/type and redacted SQL target or HTTP host/path for Send Email,
  Send SMS, before-user-created and custom-access-token hooks, plus any other
  configured hooks. Record absent entries explicitly. Never reveal hook secrets.
  Database function existence does not prove attachment. [Auth Hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [ ] Inspect Authentication → Sign In / Providers (UI label may vary), Email,
  Phone, anonymous sign-in, MFA, URL configuration and
  [SMTP](https://supabase.com/dashboard/project/eyhmarmekioovcjibcbr/auth/smtp).
  Record signup/confirmation/provider states, redirect hosts, sender/provider route
  classifications and MFA SMS paths; omit secrets and recipient addresses.
  Custom SMTP off is not suppression: default Auth email can still send.
  [SMTP behavior](https://supabase.com/docs/guides/auth/auth-smtp)
- [ ] Inspect existing API/Postgres/Auth logs with project/time filters; record
  correlation IDs and non-sensitive outcome metadata. Compare role/database pgrst
  settings with Dashboard declarations; do not dump all settings or run NOTIFY,
  ALTER ROLE, set_config, diagnostic RPCs or restart/reload controls.
- [ ] Inspect Storage bucket visibility/policies and Realtime publication/channel
  authorization settings separately. PostgREST's pre-request hook does not secure
  Storage or Realtime. Inventory service-role holders/consumers without their keys.
- [ ] If Dashboard/read-only catalogs cannot establish the effective service
  values, precedence, hook fallback or all-instance reload, use the
  [unsent Support draft](eft-supabase-support-draft-20261026.md). An ordinary admin
  can inspect declared settings and permitted catalogs/logs; cannot certify hidden
  managed-process configuration. Support supplies platform evidence, not app approval.

Future transport denials/allow tests need an isolated native environment and a
separately approved plan. Existing sanitized logs can support a review but are not
a substitute for missing role/capability coverage. Do not run active hosted tests now.

### 2. Notification isolation — P0-02

- [ ] Inspect Database → Webhooks, Database → Extensions/Cron (where available),
  Edge Functions deployed list/details/logs, existing queue/outbox consumer config,
  Storage/Realtime subscriptions and Auth routes. View only; never invoke/replay.
- [ ] Have the Vercel team admin inspect project/team webhooks, Cron Jobs,
  integrations and log drains. The previous connector's 403 requires authorized
  owner evidence, not a bypass. Obtain provider-console and external-worker
  inventory from their owners; Supabase Support cannot attest these systems.
- [ ] Complete one signed row per email, SMS, WhatsApp, push/PWA, Realtime,
  in-app/outbox-to-worker, Edge callback, cron, webhook and operational route:
  source → consumer → destination classification → forwarding/retries → existing
  sink/block evidence → owner → recovery. “No code found”, `.invalid` recipients,
  zero queue count or disabled payments are not non-delivery guarantees.
- [ ] Separate application/customer egress from platform security/billing/operator
  alerts. Preserve essential security alerts; document accepted operator routes.
  Any unknown reachable customer/provider egress blocks provisioning/UAT.

### 3. Backup recovery and maintenance acceptance — P0-03

- [ ] View [Database → Backups](https://supabase.com/dashboard/project/eyhmarmekioovcjibcbr/database/backups/scheduled)
  and its Point in Time tab if offered: plan, latest successful backup, recovery
  window/timezone, availability and retained history. Do not press Restore or
  enable an add-on. Missing/failed/ambiguous coverage goes to operator/Support.
- [ ] Supply an existing restore-rehearsal report from a verified disposable target:
  backup ID/time, isolation, restored schema/history/financial/legal checks, measured
  recovery time and accepted data-loss window. If none exists, mark OPEN and seek
  separate authorization; do not restore staging in this handoff.
- [ ] Inventory separate recovery for Storage object bytes, service/Auth/SMTP config,
  Edge code/config and external worker/sink routing. Database backups include Storage
  metadata, not object bytes. Dashboard backup presence is not restore proof.
  [Backup coverage](https://supabase.com/docs/guides/platform/backups)
- [ ] Service owner signs a maintenance window and impact statement: the proposed
  security component closes existing authenticated access via `active_account`.
  Accept 5s lock/60s statement limits, uncertain-commit read-only reconciliation,
  transaction rollback before commit and separately approved forward containment.
  Containment does not change gateways, repair drift or restore managed configuration;
  a drifted/enabled gateway needs a separately authorized audited recovery plan.

## PayFast provenance — P0-04

Fresh read-only queries **13:44:27–13:44:42 UTC / 15:44 SAST, 26 October**:

| Provider | enabled | ready | maintenance |
|---|---|---|---|
| manual_eft | false | true | false |
| manual_payshap | false | true | false |
| payfast | false | true | false |
| ozow | false | false | true |

PayFast `updated_at=2026-10-26 11:56:55.302114+00`, recorded actor present.
Filtered `private.business_audit` has a `gateway_settings` event at
`11:56:55.297245+00` with provider PayFast, enabled false, maintenance false,
actor and reason present. The source RPC writes a generic “Administrator
configuration” reason, so reason presence does not prove substantive approval.
No actor identifiers, free text or banking values were collected.

The event narrows the investigation; it does not establish the preceding value,
human authorization, complete change history or why Phase E recorded true. Owner
must correlate actor privately with a change/approval record and the original Phase E
query/time/target. Historical audit also contains earlier enabled=true entries:
these are not current flags or proof that funds moved. Do not restore historical states.
If audit coverage is incomplete, record the gap and escalate; do not invent a cause.

The two SELECTs used only gateway state/update metadata and filtered audit
timestamp/action/whitelisted provider booleans plus actor/reason-presence booleans.
No mutations, notifications or provider calls. All four methods remain off at this
observation; ready/maintenance/unlock settings were left untouched. Future drift
requires a new review. Preserve 15-minute/R500 and off/R15/revision2 baselines;
these latter values are inherited from the prior report, not re-queried here.

## Separate decision gates

| Boundary | Exact evidence needed for GO | Current |
|---|---|---|
| Installation-only | All P0 rows accepted by named reviewers; current target/service/isolation/backup/maintenance/provenance evidence; full schema/history/native exact-artifact review; chosen scope and compatibility boundary; exact SQL/hash/request; explicit installation-only authorization | **NO-GO** |
| Hosted synthetic UAT | Accepted install + post-install read-only closed-state/ACL/history evidence; separately approved effective hook/sink/config plan and successful isolated transport review; complete channel non-delivery; B–E/security boundary accepted without bypass; synthetic-only classification/non-routing instructions, independently simulated banking/legal/compliance, R0 Eduvos staffed windows/capacity/cutoffs; named actors, TTL, auditable unlock, test deltas, stop/closeout owner and separate no-funds UAT authorization | **NO-GO** |
| Real-money EFT | Successful authorized UAT and closed closeout; production-specific security/backup/artifact/transport evidence; verified independent banking/compliance and explicit legacy exceptions; signed approved vendor schedules/customer disclosures; tax/fee/refund/invoicing/settlement SOPs; operating capacity; separate production/legal/acceptance/vendor/EFT approvals | **NO-GO** |

Installation evidence is pre-install review/rehearsal. Post-install attachment and
actual target transport acceptance are later gates, not facts we can collect before
installation. No approval is automatic or implied by completing a checklist.
PayShap/PayFast/Ozow, marketing fees, cash and R10/R15 delivery activation remain
excluded. Existing local tests remain referenced in the prior reports, not repeated.

Next handoff: assign owners → collect P0-01…04 external artifacts → close scope,
schema and integration decisions P0-05…07 → request P0-08 installation review.
Any required change gets its own authorization; this runbook authorizes none.
Support draft remains unsent. Stop before hosted changes.
