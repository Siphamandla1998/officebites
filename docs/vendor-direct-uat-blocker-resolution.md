# OB-UAT-20261020: operator procedure and proposed blocker resolution

Local implementation follow-up: [security controls, focused test results and exact operator installation sequence](vendor-direct-uat-security-local.md). Nothing has been installed on hosted staging; the conditional UAT approval remains subject to its original prerequisites.

Preparation only. No provisioning, hosted configuration, migration, deployment, activation or message delivery was performed. The fixture/test limits in `vendor-direct-uat-OB-UAT-20261020.md` and the approved 12-order plan remain binding. All four methods were read and remain disabled; migration `20261020100740` is still latest.

## 1. Operator-only Auth provisioning

Recommended: one-time local operator workflow using the existing pinned-lockfile Supabase client and supported `auth.admin.listUsers`, `getUserById`, `createUser` APIs. Dashboard Auth Users > Add user (not Invite) is an alternative, but the local workflow makes reconciliation after partial failure more reliable. Never insert rows directly into auth.users or identities. No new public provisioning endpoint is needed.

Documentation: https://supabase.com/docs/reference/javascript/auth-admin-createuser . `createUser` is server-only; use `email_confirm:true` for these synthetic users and never call invite, resend, signup or password recovery as provisioning shortcuts. Hosted hooks must be audited/suppressed first: an Admin API call is not proof that no custom hook sends a message.

Before writes, the operator must:

1. Open the dashboard for **eyhmarmekioovcjibcbr**, verify name `officebites-staging`, healthy status, migration `20261020100740`, all four methods disabled, zero run accounts/manual profiles/orders, and the exact target API URL `https://eyhmarmekioovcjibcbr.supabase.co`.
2. Obtain only that project's server credential through their existing secret manager/dashboard. Load into the local process through secure input or secret-manager integration; never command arguments, chat, browser/VITE variables, terminal transcripts or committed files. No credential retrieval or creation was performed during preparation.
3. Use a target constant, not an operator-selectable arbitrary URL. Refuse redirects or alternate hosts for Admin requests. Validate authenticated `listUsers` against the fixed endpoint before creation. For a legacy JWT additionally check its ref/role; do not rely on decoding opaque new keys. A matching credential alone does not replace dashboard project identity verification.
4. Require the reviewed notification-isolation evidence below and record its timestamp. Abort if absent.
5. Establish a single operator lock for this run and a secure local vault entry. Generate each password with a cryptographic RNG (at least 32 random bytes, encoded), save it encrypted **before** its create call, then atomically checkpoint each returned UUID. On Windows use a user-bound DPAPI/credential vault and a directory ACL granting only the operator; gitignore is not encryption. Do not use plaintext JSON password files. Do not print full Auth responses, tokens or request headers.

Exact identity specification:

| Fixture key | Name | Email | Initial application role |
| --- | --- | --- | --- |
| vendorA | OB-UAT-20261020 Vendor A | vendor-a@officebites-uat.invalid | vendor |
| vendorB | OB-UAT-20261020 Vendor B | vendor-b@officebites-uat.invalid | vendor |
| customer | OB-UAT-20261020 Customer | customer@officebites-uat.invalid | customer |
| admin | OB-UAT-20261020 Admin | admin@officebites-uat.invalid | customer, then privileged promotion |

For each creation use `email`, generated `password`, `email_confirm:true`; `app_metadata:{uat_run:'OB-UAT-20261020',uat_fixture:<key>}`; `user_metadata:{name,role,building:'OB-UAT-20261020 Synthetic office'}`. Vendor metadata also requires `business_name` matching its labelled name and `business_category:'UAT synthetic meals'`. The existing trigger creates the profile, pending vendor storefront and vendor link. User metadata selects only permitted customer/vendor registration; it is never the authority for admin access.

Idempotency protocol: paginate all Auth users, compare exact case-normalized email, run/fixture app metadata and saved UUID. Zero matches permits creation; one matching user permits reconciliation without password reset; duplicates, foreign markers, inconsistent UUID/profile/storefront or a missing local vault entry stop the workflow. After timeout or ambiguous creation, list/reconcile before retrying. Never adopt a real user, reset a pre-existing password or reactivate the older suspended synthetic identity. Check trigger-created records instead of separately inserting duplicates.

The nonsecret manifest must record run/ref/migration/Preview deployment ID; creation timestamps; each email/Auth UUID/profile UUID/vendor UUID; expected/actual role and status; meal UUIDs; A1/A2/B1 profile UUIDs; order IDs and classification versions; configuration checkpoints; evidence file hashes; closeout status. UUIDs are generated by supported creation, not assigned now. Keep password-vault references only in the manifest. Initially the manifest is a specification with empty IDs, never a claim of existing fixtures.

Admin promotion is operator-only in the staging SQL Editor, after independently checking the generated Auth UUID and matching app metadata. Use a transaction with explicit assertions for exactly one matching Auth user/profile, exact email/run/fixture, customer role, active account and no vendor ownership. Change only that UUID's `public.profiles.role` to admin, assert exactly one row changed, and commit. Reruns validate an already-correct admin instead of repeating unrelated writes. Do not grant SQL roles, mutate public-signup metadata to admin, or broaden profile-update policies. Record the UUID-scoped statement/result without secrets. Verify the new admin through its actual application session before approvals. This promotion and provisioning remain unexecuted.

The two meals remain R70; A1 approved by the independent admin, A2 pending until the snapshot test, B1 unapproved. Use the existing synthetic destinations and clearly simulated evidence. No real bank capability is asserted.

## 2. Preview protection and backend restriction

Current project `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71` has password, SSO and IP protection disabled; the existing Preview remains READY. Connected team metadata did not expose billing entitlement. Official documentation nevertheless makes Vercel Authentication available on all plans and explicitly supports Preview-only selection:
https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication

Smallest proposed UI change, after separate approval: project Deployment Protection > Vercel Authentication > **Only Preview Deployments**. API equivalent on the exact team/project is the partial project update body `{"ssoProtection":{"deploymentType":"preview"}}`. Do not select Standard Protection (`prod_deployment_urls_and_all_previews`) or All Deployments. Preview-only protects every Preview of this project, including the existing UAT deployment, rather than one URL alone. It leaves production URLs outside that protection scope; compare production alias and configuration before/after. If the account UI/API rejects the option, stop rather than silently substitute a broader mode or paid upgrade.

Use existing authorised Vercel login in separate browser profiles; do not click Request access (it can email branch authors), create share links, use bypass query parameters or invoke the authenticated URL-fetch helper. Inventory existing bypass exceptions and access permissions read-only before asserting restricted access; removal of any pre-existing link/exception requires separate approval.

**Vercel protection does not restrict Supabase's direct API.** CORS/origin checks and secret URLs are insufficient. Until a backend restriction is implemented and negatively tested, the activation condition is unsatisfied even with Preview protection enabled.

Smallest proposed backend control for the existing direct-client application: a staging-only PostgREST pre-request gate, combined with a run-account allowlist. Require an expiring, randomly generated UAT capability header for all browser Data API requests, including anonymous guest requests, and additionally require authenticated callers to be exact run UUIDs. Store only the capability hash privately; do not put it in Vite build variables, public tables, URLs or logs. Supply it to testers out of band and use an audited browser/header-injection setup scoped exclusively to `https://eyhmarmekioovcjibcbr.supabase.co/rest/v1/` (or origin-scoped Playwright headers). This permits the existing Preview artifact without a frontend deployment. Confirm custom-header CORS compatibility before adoption; otherwise stop and design a separately reviewed proxy/client change.

This is a design, not prepared executable migration SQL. First inspect/compose any existing pre-request hook, current privileges, schema reload behavior and recovery procedure. Preserve service-role historical provider callback/reconciliation behavior; do not install a blanket denial that breaks them. Negative tests must cover the API directly, not only UI routes.

PostgREST gating does **not** cover Auth, Storage, Realtime or Edge Functions. Review their existing RLS/authorization independently; disable new public signups on staging if approved, audit/remove uncontrolled access through explicit scoped changes, prohibit non-run writes and external communications, and ensure no alternate exposed RPC can bypass the gate. Guest REST rejection without capability and unrelated-user denial are mandatory. An isolated access-controlled gateway/VPN with the upstream API made inaccessible to outsiders is an alternative if these controls cannot be verified; a gateway that leaves the public upstream writable is not a solution. Supabase database network restrictions alone must not be assumed to protect the REST/Auth endpoints.

Reference: https://supabase.com/docs/guides/database/debugging-performance (pre-request coverage limitations). Additional backend-control implementation/review is required; provisioning alone cannot resolve this blocker.

## 3. Notification audit and suppression proposal

| Path | Evidence / limit |
| --- | --- |
| Auth email | `src/services/authService.js` signup and password-reset calls can request email. Hosted SMTP, security notification toggles, Auth hooks and dashboard integrations are not exposed by the connected read tools. Real-recipient delivery cannot be ruled out |
| In-app notifications | `notificationService.js`, NotificationContext and notification SQL use database rows and Realtime. Keep synthetic notifications as auditable application behavior; inspect target IDs to avoid notifying existing operators |
| SMS / WhatsApp | No sender integration found in scanned application/Edge source. Hosted Auth phone providers/hooks and external integrations remain operator audit items |
| Push | No Web Push/FCM/OneSignal sender, PushManager or showNotification found in the scanned source. PWA generation alone does not imply push delivery |
| Database outbound | Installed extensions: plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault. No pg_net/http/pg_cron installed; scanned public/private function bodies and noninternal triggers had no matched network sender/webhook path. This is a bounded catalog scan, not proof against all external automation |
| Edge / provider requests | Hosted inventory: PayFast initiate/notify, Ozow initiate/webhook/reconcile, admin-account-removal. Local provider code can contact payment services. Keep initiation disabled and do not execute historical callbacks/reconciliation or removal as notification tests. Hosted sources were not newly compared byte-for-byte with local files |
| Other external traffic | External images/maps and Vercel preview tooling can issue external requests. They are not recipient-message senders; avoid map links, comments and Vercel access requests during UAT |

Operator must inspect staging Auth email/SMS/security notification settings, configured hooks, database webhooks, Edge sources, scheduled/external automation and notification-related secret **names**, without exposing values. Preserve existing settings as a sanitized checkpoint. `.invalid` email addresses and no-send instructions alone do not prove suppression.

Preferred staging-only suppression: a Postgres **Send Email Auth Hook** that captures minimal metadata and returns successful suppression without SMTP/network delivery. This hook replaces built-in email sending: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook . Verify hosted support and coverage for enabled security-notification categories; route any uncovered email through an operator-controlled capture-only SMTP sink with forwarding/delivery disabled, or disable that staging-only category after approval. Never assume one hook covers every security email.

Proposed private append-only capture: run ID when known, generated event ID, timestamp, channel, action/template, synthetic user UUID if matched, hashed/redacted recipient and `suppressed=true`. Do not retain OTPs, reset links, passwords, JWTs, email bodies or raw hook payloads. Capture attempts addressed to non-run users as redacted blocked events, never forward them. Restrict read access to the staging UAT administrator/operator and write access to the hook role; no anon/authenticated table CRUD. Failed capture must fail the send operation closed, with no fallback SMTP sender. Define retention and evidence export before enabling.

For SMS, WhatsApp, push and other automation: no enabled sender may be left unverified. Prefer staging-disabled channel configuration where unused; where tests need that channel, replace only the staging dispatch path with the same capture-only sink. Do not copy or delete production credentials. Existing in-app notification rows remain the capture for application notifications. Audit real recipient targeting, not just the transport implementation.

Suppression installation/configuration and a synthetic-only capture validation require separate approval. Do not send any probe to an existing real address/phone. Use an operator-controlled mobile contact for guest formatting; it is not a ShapID or payment destination.

## 4. Changes, approval scopes and revised order

Only this runbook was added locally. No application/migration/runtime changes are needed for the documented operator Auth Admin procedure itself. A local automation script, if selected later, must implement the target lock, encrypted checkpoint, reconciliation and exact manifest protocol above before execution; no untested provisioning script is supplied as ready to run.

Separately review/approve these concrete hosted scopes before execution:

1. Exact Vercel project Preview-only ssoProtection update; no alias/domain/environment edits or share links. Scope includes other existing Previews.
2. Staging-only backend gate/allowlist and its private storage, grants, hook configuration and expiry/recovery behavior; disable public signup if selected. Produce executable reviewed migration/configuration before requesting implementation approval.
3. Staging-only private notification capture and Send Email hook configuration, plus only the individually identified uncovered channel/settings changes. Produce reviewed SQL/hook permissions and baseline restore instructions first.
4. Operator provisioning/admin promotion uses the existing conditional run approval once these prerequisites pass; do not repeat approval for already-authorised fixture writes. Any extra configuration, deployment or new infrastructure falls outside it.

Revised order: inspect operator-only settings; review exact gate/sink implementation; obtain narrow configuration approvals; install/verify capture and access controls while all four methods remain off; provision/reconcile the four identities and manifest; finish original Phase 1 profiles/RLS checkpoint; verify direct API restriction and no external recipient delivery; then execute the existing approved manual-only window and maximum 12-order plan. Immediately classify every order. Stop on commission mismatch rather than editing policy. Close out with all methods off, archived/suspended fixtures, unavailable meals and revoked sessions, retaining immutable history and manifest. Recheck production read-only.

Unresolved: backend restriction design implementation, hosted Auth/channel configuration visibility, capture-only validation, controlled guest contact, secure operator credentials/access, independent role verification and all hosted scenario results. Manual/device UAT, vendor ownership onboarding, legal/commercial review and operational launch sign-off remain required. No production readiness is claimed.
