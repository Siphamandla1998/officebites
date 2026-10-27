# Final staging installation gate — 27 October 2026

**Decision: NO-GO. No hosted installation is authorized.** Worktree remains
`release/vendor-eft-legal-launch`. The OfficeBites release owner has explicitly
confirmed that administrator service/recovery records have not been provided and
no maintenance window or RPO/RTO has been accepted. Those items remain UNKNOWN.

The completed 15:01–15:04 SAST preflight is retained, not rerun. New work comprises
current official documentation review, source inspection of all six deployed Edge
Function bundles without invocation, one SELECT-only channel/publication inventory
at **15:16 SAST**, and local evidence/approval templates. No application source or
installer changed; no notification, hosted write, restore, deployment, account or
order action occurred. No completed database/browser tests were repeated.

## Single installation decision table

| Requirement | Result | Responsible owner | Evidence / precise remaining action |
|---|---|---|---|
| Staging identity, 54-history/13-function preimage, owners, inspected grants/RLS, disabled gateways | **PASS** | DBA | Retain `PREFLIGHT-20261027-1504.md`; dated evidence is not a guarantee against later drift. Recheck immediately in the approved execution window. |
| Supported postgres Storage policy mechanism | **PASS** | Platform administrator / DBA | Registered policy_grants includes postgres → storage.objects; session preload declares supautils. Official upstream documentation supports policy-only CREATE/ALTER/DROP without ownership. SQL Editor as postgres is the supported path. Actual execution remains untested; no managed-role grant or ALTER TABLE is needed. |
| Named supported executor / actual policy execution | **UNKNOWN** | Platform administrator | Record chosen SQL Editor/runner and postgres identity in admin template. No DDL probe now. If supported delegation later fails, stop and use the existing unsent Support request; do not weaken policies or change ownership. |
| Effective PostgREST surface/configuration | **UNKNOWN** | API administrator | Capture redacted Dashboard Data API settings and supported service-config response; identify exposed schemas, extra search path, hooks and precedence. Perform T1–T3 below using valid public-key controls. Private must not be exposed to clients. Catalog GUCs are insufficient. |
| Effective Auth and Storage configuration/access | **UNKNOWN** | Auth / Storage administrators | Capture providers, anonymous sign-in, redirects, send hooks/fallbacks, JWT policy and Storage config/bucket visibility. T4–T8 require existing identities and approved fixture paths. No signup, OTP, login-token refresh, signed-URL creation or upload to acquire evidence. |
| Auth email/SMS delivery isolation | **UNKNOWN** | Auth + notification operator | Review SMTP/default delivery, SMS provider, email/SMS send hooks, hook failure/fallback and all other Auth notification hooks. Supply signed non-delivery evidence; absence of custom SMTP or hook is not isolation. |
| Edge Function / provider isolation | **UNKNOWN** | Edge / payment operator | All six ACTIVE bundles reviewed. PayFast notify performs external validation POST; Ozow handlers can obtain tokens/create/query payments; account-removal mutates Auth when invoked. Confirm effective runtime flag/mode values and destinations without secret values, plus schedules/callbacks/retries. Do not invoke them. Disabled database gateway flags do not prove every Edge path is inert. |
| Realtime / in-app notifications | **UNKNOWN** | Realtime / application operator | Confirmed messages and notifications in supabase_realtime publication; frontend subscribes and displays toast/vibration. Database notification producers exist. Provide synthetic-recipient isolation and non-test-client separation; no broadcast, presence or write probe now. |
| Database triggers, queues / workers / external integrations | **UNKNOWN** | DBA + infrastructure operator | Captured nine channel-review functions; enabled chat/support producers from prior preflight. No listed pg_cron/pg_net/http/pgmq extension or matching queue other than notifications was found. Six DDL event triggers include PostgREST cache watchers. No proof of absent external workers, provider callbacks, webhooks, log drains or integration forwarding. Supply complete signed external inventory. |
| Actual staging backup/PITR and external-state recovery | **UNKNOWN** | Recovery administrator | Supply successful backup status/time/retention, PITR enablement and recoverable range, selected restore procedure/point, Storage-byte and Auth/Edge/provider/Vercel recovery. Connected tools lack these read endpoints; no local management token is available. Local 13-record-set recovery is rehearsal only. |
| Maintenance window / accepted recovery targets | **UNKNOWN** | OfficeBites release owner (user) | Complete maintenance template with executor, stop owner, SAST window, accepted RPO/RTO, evidence references and explicit installation-only approval. Owner designation alone is not acceptance. |
| Leaked-password protection | **FAIL** | Auth owner + release owner | Prior fresh advisor says disabled. Proposed change: Authentication → Email provider → password security → enable prevention of leaked passwords. Pro-plan-or-above eligibility must be verified; do not assume a plan or upgrade. Obtain separate setting-change approval; no change performed. This is an Auth control, not an SQL migration dependency. |
| Separate staging delta, installation/postflight plan | **PASS** | Release engineer / DBA | Two exact bundles and bucket step below; production candidates are excluded. New ledger readback compares stored canonical statement hashes. No optional delivery/collection/booking/provider feature installation. |
| Immediate execution-window guard recheck | **UNKNOWN** | Executing DBA | No execution window exists. Recheck all applicable guards at each step as below; stop on drift rather than substituting live hashes or repairing historical IDs. |
| Explicit hosted installation approval | **UNKNOWN** | OfficeBites release owner | Only after technical evidence review and maintenance acceptance. Approval does not include UAT writes, acceptance/publication, payments or production. |

## Supported Storage mechanism and administrator evidence

[Upstream supautils policy delegation](https://github.com/supabase/supautils#manage-policies)
documents CREATE/ALTER/DROP/COMMENT POLICY for configured nonowners. The current
project's registered policy_grants contains storage.objects for postgres; existing
Storage owner/RLS remain intact. The official
[managed-policy troubleshooting guide](https://supabase.com/kb/troubleshooting/realtime-must-be-owner-of-table-messages)
describes SQL Editor execution as postgres and distinguishes allowed policy DDL
from forbidden ALTER TABLE. Its example concerns Realtime; application to Storage
here is supported by the actual configured Storage delegation and upstream generic
policy mechanism. This establishes a supported path, not a completed installation.

**Ordinary administrator checks, with staging selected visibly:**

1. **Integrations → Data API → Settings**: exposed schemas, extra search path and
   API enablement. Capture only non-secret values. Ask Support for effective
   pre-request/pre-config hooks, override precedence or cache state not shown.
2. **Authentication → Sign In / Providers → Email**, **URL Configuration**, and
   **Auth Hooks**: record enabled providers/anonymous access, site and redirect
   origins, SMTP/default delivery, SMS/send hooks and failure behavior. Never export
   provider secrets, passwords, signing keys, JWTs or personal users.
3. **Storage → Settings / Buckets / Policies**: global limits, current private
   compliance-bucket absence, policy delegation/executor evidence. Future approved
   bucket must be private, 5,242,880 bytes, MIME pdf/jpeg/png exactly. Do not create it now.
4. **Database → Backups**, including PITR: record latest successful backup and
   recoverable range/retention, not just subscription entitlement or project health.
   Do not press Restore, create a recovery project or enable paid PITR. Database
   backups exclude Storage object bytes; document their separate recovery.
5. **Edge Functions**, **Realtime**, Database webhooks/Cron, **Project Integrations**
   and infrastructure/provider consoles: enumerate destinations/schedules/retries
   and recipient separation. Do not reveal secret values or press Test/Retry/Send.

An administrator with an existing appropriately scoped management session can use
these **GET-only** endpoints under `https://api.supabase.com`; none were called here:

- `/v1/projects/eyhmarmekioovcjibcbr/postgrest`
- `/v1/projects/eyhmarmekioovcjibcbr/config/auth`
- `/v1/projects/eyhmarmekioovcjibcbr/config/storage`
- `/v1/projects/eyhmarmekioovcjibcbr/config/realtime`
- `/v1/projects/eyhmarmekioovcjibcbr/database/backups`

The new [v2 project-config GET](https://supabase.com/docs/reference/api/v2-get-project-config)
also documents effective service defaults and live Storage configuration; it is
**Alpha**, not a required dependency. Redact before saving any response: v1 Auth
configuration can contain secrets. Return only the template's allowlisted facts;
never paste raw responses or access tokens into chat/Git. If unavailable, provide
Dashboard records or Support confirmation; do not extract connector credentials.

## Exact read-only transport tests — prepared, not executed

Base host is **eyhmarmekioovcjibcbr.supabase.co** only. Use a valid publishable key
in apikey and an existing scoped user's token only for authenticated cases. Never
use service_role, a secret key or production credentials. Capture sanitized status,
error code/request ID/time, not response bank/document/customer contents.

1. **T1 anonymous API control:** GET `/rest/v1/`, Accept `application/openapi+json`,
   public profile. Expect a functioning public API control and intended RPC metadata.
   Repeat with an existing customer JWT; metadata visibility alone proves no RLS behavior.
2. **T2 private-schema exclusion:** repeat the valid T1 control with
   `Accept-Profile: private`, anon and authenticated. Expect schema rejection
   (normally 406/PGRST106) and no private API metadata. Authentication failure is
   not a substitute for a working control or schema rejection.
3. **T3 invalid JWT:** GET `/auth/v1/user` with valid apikey plus deliberately invalid
   bearer value; expect 401/no identity. Existing expired token may be tested if
   already available; do not refresh/sign in to obtain one.
4. **T4 admin denial:** POST `/rest/v1/rpc/manual_payment_workspace`, JSON
   `{"p_test_only":true}`, anon then existing non-admin customer token. Expect
   authorization denial (401/403, 42501 where applicable), no workspace payload.
   This RPC is selected for read behavior, not because POST is inherently safe.
5. **T5 cross-vendor denial after installation:** POST
   `/rest/v1/rpc/get_vendor_compliance`, `{"p_vendor":"<approved synthetic vendor B UUID>"}`,
   with customer or vendor A JWT. Expect denial/no B evidence. Vendor B's own read
   is the positive control, after fixture/identity approval. Do not invent an ID and
   treat not-found as isolation proof or read real banking for screenshots.
6. **T6 agreement state after installation:** POST
   `/rest/v1/rpc/get_vendor_agreement_state` with `{}` and the existing scoped vendor
   token. Expect only that vendor's state, rollout closed/no invented acceptance;
   customer token must not receive vendor assignments.
7. **T7 public legal state:** POST `/rest/v1/rpc/get_legal_portal` and, after
   installation, `/rest/v1/rpc/get_customer_legal_state`, `{}`, anonymous. Expect
   closed rollout/no unapproved or vendor-specific content. No document is published
   to make a positive-content test pass.
8. **T8 Storage read boundary after installation:** GET
   `/storage/v1/object/public/vendor-compliance/<approved synthetic object path>`
   must never deliver bytes. GET the authenticated-object path as anon/customer/
   vendor A must not deliver B bytes; scoped vendor B provides positive control.
   A missing bucket/object 404 before fixture creation is not proof of isolation.
   Signed-URL creation, upload/replace/delete and Realtime delivery tests require
   separate synthetic-UAT approval and are not part of this read-only gate.

Before any RPC probe, reviewer must confirm the deployed function is the audited
read-only definition. GET-only RPC requests may return 405 for VOLATILE functions;
405 does not prove authorization. Never probe create_manual_order, acceptance,
admin_commercial_action, admin_vendor_compliance, settings updates, report/verify
payment or Edge handlers as a connectivity test. No tokens/fixtures have been
provided for these probes, so runtime results remain UNKNOWN.

## Installation order — execute only after the gate and explicit approval

1. Release owner signs the technical packet and maintenance template; administrator
   completes service/isolation/recovery evidence. Review optional Auth setting change
   separately. Confirm no competing settings/schema operation during the window.
2. DBA selects staging, verifies executor postgres, hashes against
   `docs/release/staging-installation-manifest.json`, and runs approved SELECT-only
   `checks/staging-installation-preflight.sql` **immediately before step 3**. Require
   history 54/MD5 `9befc9e98322a4517850501c61be9696`, all 13 preimage hashes, expected
   owners/RLS/grants, registered delegation, no partial B–E, all four methods disabled
   and commercial rollouts closed. Capture approved historical-record preservation
   evidence privately. Stop on any discrepancy; do not alter a guard to pass.
3. Run only
   `release/staging-candidates/20261027123110_staging_integrated_vendor_legal_payments.installation.sql`.
   Embedded preimage guards re-evaluate inside execution; expect history **55**.
   Verify exact new ledger identity/statement hash before any continuation. Lost
   connection is an uncertain outcome: inspect ledger/objects before retrying.
4. Separately approved Dashboard/API action creates the private vendor-compliance
   bucket with exact size/MIME limits. No evidence upload. Immediately before step 5,
   recheck target/executor/delegation, unchanged disabled gateways/legal rollout,
   history 55 with exact step-3 artifact, integrated compliance foundation,
   six policy-name collisions absent, Storage owner/RLS and exact bucket config.
   Do **not** rerun the old 54/pre-B–E guard against this intentionally changed state.
5. Run only
   `release/staging-candidates/20261027123115_staging_compliance_storage_policies.installation.sql`
   as the supported postgres executor. Its foundation/bucket guards run again.
   Expect history **56** and six exact policies, retaining four AS RESTRICTIVE
   boundaries. Do not also execute canonical files, blanket db push or production SQL.
6. Run `checks/staging-installation-postflight.sql` and
   `checks/staging-installation-ledger-readback.sql` (prepared SELECT-only). Require
   history 56, two exact NEW versions/statements, policy definitions/types, intended
   private RLS/ACLs, RPC owners/signatures/grants and trigger guards, preserved
   historical records, all payment/legal/acquisition rollouts closed. The latter
   compares canonical-statement MD5s; SHA-256 manifest remains package identity.
7. Verify effective API cache/service contract with read-only T1–T8 as applicable.
   Cache reload, if needed, is a separate approved action; do not assume DDL watchers
   guarantee it. Stop if essential RPCs are absent or denial/visibility differs.
   UAT writes, frontend deployment, real vendor changes, publication and payments
   remain separate approvals. No automatic rollback or reopening is permitted.

## Templates and remaining approval

- `ADMIN-EVIDENCE-TEMPLATE-20261027.json`: unfilled redacted technical evidence and
  full Auth/Edge/email/SMS/Realtime/worker/trigger/external-channel attestation.
- `MAINTENANCE-ACCEPTANCE-TEMPLATE-20261027.json`: release owner assigned; all
  acceptance/write-approval fields remain false/null, no invented recovery targets.
- `FINAL-GATE-CHANNEL-EVIDENCE-20261027.json` and corresponding SELECT file:
  new source/catalog evidence only; no claim of effective runtime isolation.

The release owner must receive administrator evidence and accept actual recovery
targets/window before installation approval can be requested meaningfully. An
installation approval must name the exact two bundle hashes and the bucket action;
it does not authorize any payment flag, Auth change, legal publication or hosted UAT.
No support request was sent. New prepared ledger readback was inspected locally,
not executed against hosted or disposable databases; prior regression results are
unchanged. Existing payment/legal worktrees were not altered.

Current primary references: [Auth service configuration](https://supabase.com/docs/reference/api/v1-get-auth-service-config),
[Storage configuration](https://supabase.com/docs/reference/api/v1-get-storage-config),
[PostgREST configuration](https://supabase.com/docs/reference/api/v1-get-postgrest-service-config),
[backup inventory](https://supabase.com/docs/reference/api/v1-list-all-backups),
[backup scope and Storage-byte exclusions](https://supabase.com/docs/guides/platform/backups),
[leaked-password prevention and plan eligibility](https://supabase.com/docs/guides/auth/password-security).
