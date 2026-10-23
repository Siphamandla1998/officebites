# OB-UAT-20261020 local security handoff

Local implementation only. No hosted configuration, migrations, accounts, admin roles, orders, payment activation, notifications, deployments or share-link operations were executed. Existing unrelated edits were preserved. This handoff supersedes the proposed broad gate design in `vendor-direct-uat-blocker-resolution.md`; the original fixture plan and 12-order cap remain unchanged.

## Files changed in this work

- `checks/uat/staging-security.sql`: staging-only reviewed installation artifact, three private RLS tables, existing account-helper intersection, REST gate, private redacted Auth email hook.
- `checks/uat/provision-core.mjs`: exact four identities, checkpoint validation, collision checks, resumable create/reconcile protocol.
- `checks/uat/provision-staging.mjs`: operator-only Windows runner, independent target identity check, fixed-host Admin API, DPAPI credentials, operator-only directory ACL, lock and manifest.
- `checks/uat/provision-core.test.mjs`: mocked provisioning safeguard and ambiguous-write recovery tests.
- `checks/uat/security-database.mjs`: isolated SQL gate, RLS, role, capture and historical-callback assertions.
- `checks/uat/checkpoint.example.json`: deliberately failing operator attestation template; no credentials.
- `checks/checkout-database.mjs`: one additional call to the UAT security assertions after existing manual-payment checks.
- This handoff, plus a follow-up link in the blocker-resolution runbook.

No new universal Supabase migration was added. UAT restrictions intentionally stay outside `supabase/migrations`: they must never ride a future production `db push`. `staging-security.sql` is an explicit staging installation artifact, not an already-applied migration or production feature. It must run in an operator transaction after project verification; any failure rolls that transaction back. Reapplication is not intended; inspect installed objects instead.

## Controls and scope

The existing checked manual RPCs retain vendor ownership, independent admin approval and role checks. The new controls do not replace them or weaken any RLS policy.

The installed account helper intersects its original logic with four operator-registered Auth UUIDs and an expiring run window. Existing restrictive public-table/Storage policies and private admin/vendor helpers inherit that restriction. An old staging admin outside the run loses helper-based access. The original helper is retained privately for reviewed recovery, with browser execution revoked. No account is automatically allowlisted or promoted.

`private.uat_pre_request` additionally requires a random 64-character capability on every non-service-role REST request, including guests. Only the hash is stored; missing config, missing/wrong header or expiry fails closed. Validated service-role requests remain available for historical reconciliation and operator provisioning. Ordinary users cannot register actors, modify settings or read gate secrets/capture tables. This is a temporary operator access credential, not a browser admin credential.

There is no proxy, frontend deployment, replacement checkout or new public RPC. Testers use an audited browser header injector scoped to the exact staging REST origin/path or Playwright origin-scoped headers. Guest tests still use the real anonymous role. Never put the capability in Vite variables, localStorage, query strings, screenshots or request logs. Verify CORS/preflight compatibility before UAT. A shared run capability restricts outsiders; it does not replace per-user or per-order authorization.

### Transport inspection

| Surface | Evidence / disposition |
| --- | --- |
| REST tables and RPCs | Pre-request gate covers all non-service requests; account allowlist complements existing role/RLS checks. No existing authenticator pre-request hook appeared in the inspected role settings; inspect database/per-role overrides again before configuration |
| Auth | Password sign-in remains supported; it cannot grant a database allowlist entry. New public signups must be disabled in staging through separately approved Auth configuration; verify Admin creation remains supported. Exact fixture creation uses confirmed Admin API users, no invitations. Audit all Auth hooks first |
| Storage | Existing `active_account_storage` is restrictive. Local negative test verifies outsider private-object reads denied; existing ownership/bucket policies remain. Public vendor-image reads stay public. This plan uploads no test files/images and puts no protected fixtures in public buckets |
| Realtime | Hosted business publication contains public `messages` and `notifications`, not order/payment/profile tables. Their restrictive account policy is inherited; local SQL tests deny outsider notification reads. Realtime transport re-evaluation/cached sessions still requires a hosted negative check and existing-session review before activation. No sensitive test data is sent through public Broadcast channels |
| Edge | Hosted account-removal source was inspected: caller Auth verification, then a caller-scoped REST profile read before the service-role removal path. Its REST client does not forward a UAT capability; under the gate it fails before removal. Removal is deliberately unavailable in this UAT; no Edge change/deployment is needed. PayFast/Ozow remain independently disabled, with historical callback/reconcile paths retained and no provider tests invoked. Other Edge sources/settings must remain unchanged from reviewed versions |
| SQL/service credentials | Trusted operator boundary. Keep out of browser, Git, logs and chat; browser restrictions do not protect against leaked privileged credentials |

No claim is made that a REST hook protects every Supabase product. Auth delivery configuration, Storage policy inventory, publication changes, Realtime sessions and Edge versions are installation checkpoints. If any alternate path exposes fixtures, stop before activation. No wider policy rewrite or gateway infrastructure is proposed.

## Preview-only Vercel change awaiting approval

Current read-only project inspection: project `prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71`, team `team_kKRzCLk1pNHoIA4sV1M0ciSg`, SSO/password/IP protection disabled; same READY UAT Preview. Team membership shows one confirmed OWNER. That existing owner is eligible for protected Preview access; other collaborators must have verified membership/access rather than assuming invitations are sufficient.

Proposed operator action: Vercel project Deployment Protection > Vercel Authentication > **Only Preview Deployments**. Exact partial API update body:

```json
{"ssoProtection":{"deploymentType":"preview"}}
```

Apply only to the exact project/team above. It affects all project Previews, including the already deployed UAT artifact, and excludes production deployment URLs/custom domains. Do not choose Standard Protection or All Deployments. The supported setting is available on all plans; tenant acceptance must still be verified when applying. The setting itself does not request share-link creation/revocation. Inspect bypass/exception inventory read-only and compare afterward; do not automatically remove any exception. Keep the authenticated URL-fetch helper prohibited.

Production alias inspection still reports `officebites.co.za` -> `dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt`, updatedAt `1792492251782`. Existing metadata indicates no production protection. The web fetch tool could not load the sites, but subsequent direct, unauthenticated HTTP GET checks returned 200 with no redirect for both `officebites.co.za` and `www.officebites.co.za`. No page scripts or login flows were executed. Operator must recheck this after the approved configuration step, and confirm Preview denies anonymous access while existing owner access works. Do not click Request Access or Share; those can send email or change links.

Reference: https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication

## Notification sink and remaining hosted audit

`private.uat_send_email(jsonb)` is a supported Postgres Auth Send Email hook candidate. Only `supabase_auth_admin` can execute it; it returns `{}` after inserting a redacted private capture. There is no network/SMTP/client sender. It captures timestamp, generated ID, fixed run/channel, whitelisted action (unknown values become `other`), salted recipient hash and suppressed=true. It never captures payloads, bodies, OTPs, hashes/tokens supplied by Auth, URLs or raw addresses. Capture is append-only. A failed capture fails the hook; it has no fallback sender. Expiring the access window does not reactivate delivery.

Hook tests cover signup/confirmation, invitation (suppression only; provisioning never invites), recovery, magic link, email change, reauthentication and an unknown action. These are local hook calls, not hosted messages. Enable the hook only on staging after verifying Auth dashboard support/permissions. It suppresses arbitrary destinations, including non-test addresses; it is not merely an `.invalid` allowlist.

Repository scan found app signup/recovery email requests, database/Realtime in-app notifications, provider-network calls and external images/maps. No application email SDK, SMS/WhatsApp sender or Web Push/FCM/OneSignal integration was found. Hosted catalog scan found no matching public/private network sender functions/triggers and no pg_net/http/pg_cron extension. This bounded evidence does not reveal hosted SMTP, Auth security-email/SMS provider settings, external automation or every configured hook. Operator must inspect these before provisioning. Disable unused staging SMS/phone/other messaging channels and uncovered security-email categories only with approval; alternatively use a verified non-forwarding capture-only SMTP sink for uncovered email. Preserve production settings/secrets. A Send Email hook must not be assumed to cover every security notification. No uncontrolled test recipient may be used to probe coverage.

Reference: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook

## Exact staged installation sequence (approval required)

1. Reverify project ref/name, migration `20261020100740`, all methods disabled, Preview provenance, production alias and unchanged hosted Edge/publication/policy inventory. Record affected helper definition/ACL, Auth hooks/settings, authenticator and database pre-request settings and Vercel configuration. This is a schema/configuration checkpoint, not proof of full backup/PITR.
2. Obtain approval for Preview-only SSO, staging-only SQL install, REST hook attachment, Auth Send Email hook attachment and any explicitly enumerated staging Auth notification/signup settings. Do not infer permission for new deployments, share links or broad policy edits.
3. In the independently verified staging SQL Editor/connection, run:

```sql
BEGIN;
SET LOCAL officebites.verified_project_ref='eyhmarmekioovcjibcbr';
-- Execute the exact reviewed checks/uat/staging-security.sql contents here.
COMMIT;
```

The SQL attestation is an additional guard, not independent proof of project identity. Do not set it on an arbitrary connection. No payment flags change. Keep capability_hash/expires_at unset initially; this denies ordinary access rather than opening the project. Check the captured prior helper and new grants/RLS before attaching hooks.

4. If no prior hook exists, configure `ALTER ROLE authenticator SET pgrst.db_pre_request='private.uat_pre_request'; NOTIFY pgrst,'reload config';` on staging only. If another hook exists, stop and compose/review rather than overwrite. Verify role/database overrides and effective hook behavior through direct REST requests, including missing capability and service-role historical reads.
5. Attach `pg-functions://postgres/private/uat_send_email` using staging Auth Hooks > Send Email. Independently inspect all other delivery/hook settings and disable public signup (not the email/password provider) under the approved scope. Confirm suppression with a designated synthetic-only hook payload and private capture before account creation. Stop on any unknown fallback sender.
6. Complete a fresh operator checkpoint from `checks/uat/checkpoint.example.json`, saved under the operator-only run directory. The four verification booleans are attestations backed by evidence, not switches to bypass a failed check. It expires after 30 minutes; migration state is operator-verified, not inferred from an opaque key. Keep all methods off.
7. Run operator provisioning as below. Independently verify trigger-created profiles/storefronts and store their IDs. Perform the separate exact-UUID admin assignment from the earlier reviewed runbook; no script grants admin.
8. Register exactly those four UUIDs in private.uat_actors only after matching each exact email, `auth.users.raw_app_meta_data.uat_run` and fixture marker against the manifest. Confirm the designated admin/customer/vendor roles; reject any fifth or mismatched identity. Set only this run's row to the SHA-256 hash of a locally generated 32-byte random hex capability and an explicit short expiry (for example one hour). Do not log SQL parameter values or store the plaintext capability in SQL history. Use a parameterised privileged operator client/secret manager for this step.
9. Test direct REST denial without/wrong capability, denial with capability for unrelated existing users/admins, anonymous allowed read with capability, real vendor isolation and guest-token denial. Verify Storage/Realtime/private table denial through actual separate sessions and that account-removal cannot reach its service path. Verify Auth cannot create unapproved public identities. Inspect capture and any external-delivery evidence. CORS/header support remains a hosted prerequisite; stop if unsupported.
10. Only after these checkpoints and original Phase 1 profile approvals pass may the already-approved manual-only activation/test window begin. Preserve A2 pending until the designated snapshot test, B1 unapproved, R70 meals, R560 review, immediate classification and maximum 12 orders. Validate 15%+2%=17% commission from actual snapshots; never edit global policy to hide a mismatch. Use synthetic receipt/refund evidence only.

## Operator provisioning usage

Required process-only secrets, by name: `STAGING_SUPABASE_ADMIN_KEY` (that project's server Admin API credential), `STAGING_SUPABASE_MANAGEMENT_TOKEN` (operator management credential for a read-only project identity check). `OFFICEBITES_UAT_CHECKPOINT` is a local file path, not a secret. Supply credentials through the operator's secret manager/secure input; never command-line values, chat, VITE variables or browser code.

With a trusted Windows operator session, repository root and existing lockfile-installed dependencies:

```text
node checks/uat/provision-staging.mjs
# Offline help only, no network.
node checks/uat/provision-staging.mjs --execute
# Only after installation/verification and explicit operator authorization.
```

The runner validates a fresh checkpoint, independently reads the fixed Management API project, rejects alternate Admin API hosts/redirects, reads actual disabled gateway settings, paginates users and creates only the four exact synthetic identities. Passwords are CSPRNG-generated, saved with Windows CurrentUser DPAPI before creation, and never printed. Secure-store child processes do not inherit the two privileged secret variables. Directory ACL is replaced with current-user-only full control, a single-operator lock prevents parallel provisioning, and symlink/redirected directories are refused.

Files are under `.officebites-local/OB-UAT-20261020/`: `credentials.dpapi` (encrypted complete checkpoint) and `fixture-manifest.json` (IDs/status/credential-vault references, no passwords). Both are under the restricted ACL and Git-ignored. The initial manifest reserves meal/profile/order maps for later approved fixture work; the runner creates Auth identities and trigger-created storefronts only, not meals/payment profiles/orders. Do not lose the DPAPI user profile/vault. A stale lock or .tmp file after interruption requires operator investigation; do not automatically delete it or reset passwords. No automatic rollback/deletion occurs after partial creation.

Reruns reconcile exact email+server-set app metadata+saved UUID and never resend invitations or reset passwords. Foreign/duplicate accounts, lost encrypted passwords, wrong profiles or unexpected storefront status stop. Re-running provisioning after subsequent storefront approval intentionally stops for inspection instead of undoing onboarding. Ambiguous create responses leave the encrypted pre-call password checkpoint; the next run reconciles before another create. Provision the admin initially as customer, then independently promote it by exact generated UUID. Keep passwords in the vault/secret manager for operator handoff; do not print them for this agent.

## Local validation

- Provisioning core: 36 assertions with mocked APIs, including checkpoint target/expiry, no admin signup, encrypted-checkpoint-before-create ordering, duplicate/foreign account rejection, idempotent rerun and ambiguous-response recovery.
- Actual Windows CurrentUser DPAPI encryption/decryption round trip passed using a dummy string; no real credential or network request. The full operator runner was invoked only in offline help mode. Secure directory ACL application and actual Admin creation still need operator verification.
- Existing isolated database suites: checkout/mobile/cancellation/delivery/gateway 38; Ozow/subscription/roles 50; delivery origin 59; legal/corporate/RPC 103; repair/access 20; manual payments 109. Manual suite includes snapshots, guest capability, commission/idempotency, independent approval, refund/dispute and provider blocks.
- Additional UAT SQL assertions: **43 passed**, covering gate missing/wrong/expired capability, outsider admin and public-table denial, Storage/notification restrictive policy denial, allowlisted roles, vendor isolation, no ordinary activation, provider reactivation denial, private capture/grants/redaction/immutability and historical PayFast callback retention after gate installation. These explicitly invoke the gate locally; they do not simulate PostgREST executing the configured hook or Supabase Auth/Realtime transports.
- Lint exit 0, same nine existing warnings; new checks/uat lint clean.
- Vite/PWA build passed. Initial sandbox build failed to spawn its Windows helper; authorised local elevated retry succeeded. No artifact was uploaded or deployed.

The SQL install does not activate any hook by itself. Native concurrency, actual CORS/header injection, Auth hook registration/coverage, Realtime cached-session behavior, collaborators' browser access and hosted UAT are still unverified. The new safeguards are locally tested, not installed or approved as hosted-ready.

## Safe closeout and recovery

Executed recovery follow-up: [baseline capture, 59 local recovery assertions, transactional restoration and remaining operator checks](vendor-direct-uat-recovery-validation.md). Use the tested generator in `checks/uat/recovery.mjs` and generated local SQL rather than reconstructing grants manually. The hosted Auth configuration baseline is still unknown; suppression must remain installed during recovery.

Before expiry, close the original test window: disable both manual methods, verify all four disabled, archive/suspend run fixtures, mark meals unavailable and revoke supported Auth sessions. Preserve the manifest, capture evidence, profiles/snapshots and financial history. If the gate expires first, it fails closed and the admin session can no longer operate; use the separately approved privileged staging forward-stop script to disable methods, then finish scoped operator cleanup. Never extend an expired window automatically.

For an installation failure before commit, roll back the transaction. For a successful install, keep access restrictions/suppression in place while investigating; no destructive rollback is required. Do not detach the email hook before a verified no-delivery fallback or intentional restoration is approved. Detaching can restore SMTP delivery.

To later remove UAT restrictions under separate approval: ensure all payments disabled and UAT identities/sessions closed, capture evidence, restore the exact original active_account definition/ACL from the checkpoint (or compare with the preserved private original), restore the prior pre-request settings and reload PostgREST configuration. Restore only the prior scoped Auth/Vercel settings intentionally approved for restoration. Retain private capture/history and originals until retention review; do not DROP/reset/re-enable gateway flags. No production object or alias participates in this recovery.
