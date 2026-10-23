# OB-UAT-20261020: remaining operator checklist

## Current local preparation — 22 October

Use [the current release/checkpoint and remaining operator evidence checklist](vendor-direct-uat-local-preparation-20261022.md) before the historical instructions below. Current target is release `695e5e19cf581f6202dcc058afad1ee2fba23208`, Preview `dpl_DGWZnPj1ubqxzCfzDcZVUJ3iEYTQ`, staging `eyhmarmekioovcjibcbr`. All methods stay off, 15 minutes/R500. Refreshed evidence does not authorise provisioning: its acceptance and `provisioningApproved` flags remain false. Every hosted write must fall within an explicit approved scope; neither this checklist nor `--execute` grants that approval. Preserve a working suppression hook on recovery, even though the historical baseline had none.

Status: read-only preparation. No settings were changed, accounts provisioned, payments enabled, notifications sent or deployment/push performed.

Latest detailed assessment: [final operator prerequisites, 21 October](vendor-direct-uat-prerequisites-20261021.md). It contains the authoritative Management API path and its field limitations, exact Supabase support inquiry, fresh hosted notification inventory, evidence requirements and installation order. **NO-GO** remains until effective service configuration and the remaining operator-only notification inventory are established. Catalog absence and successful HTTP are not substitutes.

## Baseline update — 21 October 2026

This update supersedes earlier statements that the presence of an Auth hook is entirely unknown. It does not establish notification suppression or authorise installation in this task.

| Item | Evidence and current conclusion |
| --- | --- |
| Auth Hooks | Operator-reported Dashboard: no hooks listed; “Add a new hook” offered. The unsaved Send Email creation form has no selected function. Record the pre-install baseline as **no configured hook**, not an active empty hook. Exact observation time was not supplied |
| SMTP form | Operator directly confirmed custom SMTP **disabled** in staging Dashboard on 21 October; no settings saved. This supersedes the earlier blank-form observation. Built-in SMTP remains possible |
| Email provider | Agent read-only GET `https://eyhmarmekioovcjibcbr.supabase.co/auth/v1/settings`, using the existing staging publishable key: HTTP 200, `external.email=true` |
| Public signup / confirmation | Same read: `disable_signup=false`, `mailer_autoconfirm=false`: public signup enabled; auto-confirmation disabled |
| Phone provider | Same read: `external.phone=false`. This does not establish every MFA/SMS/automation setting |
| Database baseline | Fresh read at 06:40:42 UTC / 08:40:42 SAST: helper definition, postgres ownership and raw ACL exactly match the tested baseline. No authenticator or applicable database/global-role `pgrst.*` overrides found. Latest migration unchanged, UAT not installed, all four methods disabled |
| REST baseline request | Existing staging-only settings checker called read-only `get_payment_gateways` without a UAT capability: HTTP 200, all four methods disabled. Expected before installation; not proof of absence of every environment override |
| Effective REST runtime | Catalog and baseline settings-request behavior verified. Environment/pre-config overrides and post-install worker reload/gate enforcement remain unverified; do not call these baseline checks a complete runtime audit |

No hook plus email provider enabled is **not suppression**. Default SMTP can still deliver to authorised project-team recipients even if custom SMTP is not configured. Do not treat restoring the no-hook baseline as a safe recovery step. Keep the reviewed sink attached once installed; if attachment fails, do not create users or trigger any Auth mail flow.

The original 20 October recovery JSON and its test hash are retained unchanged as historical evidence. This update is an observation overlay, not a fabricated historical API capture. Sanitised current evidence: `.officebites-local/OB-UAT-20261020/auth-baseline-reassessment-20261021.json`.

### Exact remaining read-only operator checks

The operator has confirmed the exact staging project, Email enabled, Phone disabled, public signup enabled, custom SMTP disabled, no configured hooks and all four methods disabled. These baseline checks are complete. Refresh only at installation preflight to detect drift. The tracked recovery observation overlay is `checks/uat/fixtures/auth-baseline-20261021.json`; the historical test fixture/hash remain unchanged.

1. Inventory enabled security-email categories, MFA SMS and independently configured hosted notification automation. Phone Auth disabled does not establish MFA SMS disabled. Record absence, verified suppression or an approved block for outside-hook channels before using those operations.
2. Obtain redacted effective service-level `PGRST_DB_CONFIG`, `PGRST_DB_PRE_REQUEST`, `PGRST_DB_PRE_CONFIG` and any pre-config function through existing operator access/Supabase support. Confirm database settings are enabled and no override replaces the reviewed gate. No applicable catalog overrides or candidate pre-config functions were found by read-only SQL; service environment configuration is not exposed. Do not overwrite an unknown effective hook.

### Notification coverage and failure evidence — 21 October

Read-only staging `/auth/v1/health` returned HTTP 200, GoTrue **v2.197.0**. The [matching official release source](https://github.com/supabase/auth/blob/v2.197.0/internal/api/mail.go) routes signup/confirmation, invite, recovery, magic-link/OTP, email change (including secure old/new handling) and reauthentication through `sendEmail`. Password/email/phone changes, identity linked/unlinked and MFA factor enrolled/unenrolled security notifications use that same helper. Its enabled-hook branch directly returns the hook invocation result before the SMTP branch: no SMTP fallback on hook error in the reviewed version. This is version-matched source evidence, not a hosted fault test or binary attestation.

The reviewed SQL sink has no sender/network call, returns `{}`, and raises on capture/configuration failure. Unknown action names, including security notification categories, are suppressed and captured as `other`. This limits category-specific audit detail but does not permit delivery. Captures contain run/channel/action/salted recipient hash/suppressed status, never addresses, message bodies or tokens. Failed Auth transactions can roll back captures; no capture does not prove no attempt.

[Auth hooks documentation](https://supabase.com/docs/guides/auth/auth-hooks) specifies Postgres hook errors propagate without retry and a two-second SQL hook limit. The [Send Email contract](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) accepts an empty success response. Saved enabled/URI state, grants and controlled non-delivering capture evidence must still be verified after attachment; a direct SQL call alone does not prove GoTrue routing.

No listed built-in Auth/security email bypass was found in this release's mail helper. Outside coverage: Supabase account/team/operational mail, independent application/Edge/webhook/provider messages, SMS/WhatsApp/push and MFA SMS. Repository audit found no independent application sender; hosted external automation still needs operator inventory. Security-email category toggles remain operator evidence to capture; source review establishes their routing when enabled. Do not trigger real-recipient probes. Disabling the sink permits built-in SMTP despite custom SMTP being disabled; recovery retains a verified active sink.

### Minimal future installation sequence and fail-closed outcome

These are execution instructions for a later authorised turn/operator, **not actions performed here**:

1. Resolve the read-only operator checks above; refresh project/migration/helper/ACL/settings checkpoint and confirm all methods disabled. Require the existing tested recovery artifacts. Do not redo checkout or local security implementation.
2. On verified staging only, apply the exact reviewed `checks/uat/staging-security.sql` in the transaction described in `vendor-direct-uat-security-local.md`. Its empty actor list and unset capability/window remain deny-by-default. Do not register identities or enable methods.
3. Verify new private-table RLS/grants, unchanged original order/financial fingerprints and preserved payment-role checks. Attach the reviewed REST hook only if it will not overwrite another effective hook; reload configuration and require gate-specific denial on missing/wrong capability using read-only RPCs. Failure or conflicting configuration: stop, keep flags off and do not open the window.
4. In staging Auth Hooks, attach the reviewed Postgres Send Email function `pg-functions://postgres/private/uat_send_email` through the supported Dashboard mechanism. Read back the saved enabled/URI state and permissions. Verify private redacted capture with a non-delivering SQL/hook probe; separately verify actual Auth routing, category coverage and failure behavior using controlled no-delivery evidence/probes only. A direct SQL capture does not prove GoTrue routing.
5. If hook creation/save/attachment fails or no-delivery/fallback behavior is unproven: **stop immediately before all provisioning and Auth-flow probes**; retain the deny-by-default backend restriction, all methods off and zero UAT accounts/orders. Do not detach a working sink, restore the empty-hook baseline, switch SMTP providers, or retry via invitations/recovery. If the sink is not attached, report “email suppression NOT established”; do not claim the pre-install state is globally no-delivery. Any additional blocking/delivery-setting change must be precisely reviewed/authorised rather than improvised. No destructive rollback.
6. Only after Auth/REST verification passes, execute the existing conditional Preview-only protection phase without share links; verify existing authorised operator access, anonymous Preview denial and unchanged public production access. Assess Storage/Realtime/Edge paths as documented. All methods still off.
7. Stop at the installation handoff. Provisioning, admin assignment, accounts, orders and a manual-payment test window require their separately specified approval/checkpoints. If positive guest/run-actor transport verification needs a temporary capability/window or later identities, report it pending and obtain/confirm the exact scope; do not silently create fixtures under a read-only security check.

Readiness: **NO-GO to begin the conditional hosted installation yet.** Effective service-level PostgREST/pre-config evidence and independent hosted notification-channel inventory remain outstanding. Auth/SMTP baseline and version-matched coverage/fallback design review are complete. Once the two operator checks pass, use the existing installation sequence; hosted attachment/non-delivery and REST transport checks are mandatory acceptance criteria before provisioning. No local tests were repeated or hosted changes made.

## Checkout preservation and completed checks

Local commit: `ce98c90cc99b41222017009b3c4eb4e232f50a14` on `feat/vendor-direct-launch-payments`.

Reviewed inventory: `src/pages/customer/Checkout.jsx`, `checks/browser-harness.jsx`, `checks/manual-payments-browser.spec.mjs`; required client dependencies `src/services/manualPaymentService.js` and `src/services/orderService.js`; and `playwright.config.mjs` to discover the manual-payment tests. No backend configuration/migration or security-install files were committed. Git identity was command-scoped Codex; repository/global identity configuration was not changed.

The three requested files included earlier uncommitted vendor-direct changes, not just the latest disclosure button. The direct service dependencies were included to prevent a missing import or obsolete order-creation RPC. Other vendor-direct screens, security work, migrations and unrelated edits remain uncommitted and were preserved. This is a checkout checkpoint, not a complete standalone launch release. The 48 passing browser tests/build evidence applies to the existing full working tree, not an isolated clean checkout of this partial feature commit. Focused lint and staged whitespace checks passed again during commit review; application code was not changed during this task.

Read-only staging inspection on 20 October 2026 confirmed:

- Exact project `eyhmarmekioovcjibcbr`, name officebites-staging, ACTIVE_HEALTHY; latest migration `20261020100740`.
- All four methods disabled; UAT security not installed.
- Live `get_vendor_manual_methods` still intersects approved current bank-profile support, enabled/ready/non-maintenance gateway state, approved unarchived vendor and active owner.
- Live `create_manual_order` accepts only manual EFT/PayShap and independently rechecks recipient approval and availability. Client selection cannot authorise an unavailable method.
- PayFast/Ozow alternatives have disabled inputs, no selection handler and no initiation path in Checkout. Changing technical provider flags does not turn them into checkout choices.
- Authenticator role and current-database/global role catalog `pgrst.*` settings remain empty. This is catalog evidence, not proof of effective PostgREST environment configuration.
- Local security/recovery evidence remains 43 security assertions and 59 recovery assertions; no hosted Auth suppression or REST transport verification is claimed.

## A. Capture Auth baseline in the Dashboard — read only

1. Open https://supabase.com/dashboard/project/eyhmarmekioovcjibcbr . Verify project name and URL ref before opening any settings. Do not select the OfficeBites production project (`gfzhdkitdyqftealgqfi`). Record UTC timestamp and operator identity in a private evidence file.
2. Open **Authentication > Hooks**. Select/view **Send Email**. If the UI calls this Auth Hooks, use that equivalent page. Record whether the hook exists and is enabled; type (Postgres or HTTP); schema/function or sanitised endpoint; displayed configuration revision/time if available. If no hook exists, explicitly record `none`, rather than leaving a blank field.
3. Record the exact Postgres URI when present, e.g. `pg-functions://postgres/private/uat_send_email`. For an HTTP endpoint, preserve the operational endpoint securely but redact query/path credentials in the review evidence. Record only secret presence/reference, never signing-secret values. Do not reveal, rotate or regenerate secrets. Do not click Save, Enable, Disable or Send/Test.
4. On the same Hooks page, inventory Send SMS, Before User Created, access-token/password/MFA hooks and any other active hook. Record destinations/functions and whether they can dispatch email/SMS externally. An account-create hook can send messages independently of the Admin createUser request.
5. Open **Authentication > Email / Custom SMTP** (the dashboard may expose SMTP under Authentication settings). Record custom SMTP enabled/disabled, provider/host classification, forwarding/delivery policy and whether it is a verified capture-only sink. Keep credentials and sender/recipient addresses out of shared screenshots. Record which existing secret-manager entry would support controlled restoration; do not copy credentials.
6. Open **Authentication > Sign In / Providers > Email** (or the Email provider page). Record email/password provider enabled state, public-signup setting, confirmation policy, secure email-change policy and reauthentication settings. Record redirect/site URL destinations without tokens. Do not turn off the email/password provider as a substitute for disabling public signup: the proposed users need password login.
7. Inspect **Authentication > Email > Templates / Security notifications**, or the equivalent security-email controls exposed by the dashboard. List every enabled category, including password/email/phone change and identity/MFA changes where available. For each, record whether the Send Email hook actually covers it, an independently verified capture-only SMTP path handles it, or it must be blocked through an approved setting. Missing controls or unclear coverage remain UNKNOWN; do not infer coverage from a template being present.
8. Open the Phone/SMS provider settings and Send SMS hook. Record provider enabled state, hook destination and any external delivery integration. Inspect application webhooks/automation and Edge function notification paths through their configuration pages. No WhatsApp/push integration was found in the repository scan; this does not prove that external hosted integrations are absent.
9. Save redacted evidence locally under the protected UAT run directory and give the reviewer only the nonsecret status/function/coverage summary. Do not press Invite user, Send password recovery, Resend confirmation, or Request access in Vercel.

The required pre-install Auth record is:

```text
project_ref, captured_at_utc, operator
send_email_hook_present, enabled, type, schema/function or sanitised URI
other_hooks and possible external dispatch paths
email_provider_enabled, public_signup_enabled, email_confirmation_policy
secure_email_change, reauthentication policy
smtp_custom_enabled, sink_or_delivery_classification, forwarding_disabled evidence
each_security_notification_category -> suppressed / explicitly blocked / UNKNOWN
sms_phone_provider_and_send_sms_hook_state
private checkpoint/secret references (names only), evidence file references
```

This captures the current **pre-install** baseline. It cannot prove a historical configuration was unchanged unless an audit trail supports that claim. The historical 20 October snapshot marks the Auth hook unknown; the dated 21 October overlay confirms no hook. Neither establishes suppression.

Supabase documents that an enabled Send Email hook replaces SMTP, while disabling the hook can return email handling to SMTP. Default SMTP can still send to project-team addresses; it is not a no-delivery guarantee. See [Send Email hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) and [SMTP behavior](https://supabase.com/docs/guides/auth/auth-smtp).

## B. Verify effective REST configuration — read only now

In the verified staging **SQL Editor**, the following reads capture role/database overrides without altering settings:

```sql
BEGIN READ ONLY;
SELECT r.rolname, s.setting
FROM pg_roles r
CROSS JOIN LATERAL unnest(r.rolconfig) AS s(setting)
WHERE r.rolname='authenticator' AND s.setting LIKE 'pgrst.%';

SELECT CASE WHEN c.setdatabase=0 THEN 'ALL' ELSE d.datname END AS database_scope,
       CASE WHEN c.setrole=0 THEN 'ALL' ELSE r.rolname END AS role_scope,
       s.setting
FROM pg_db_role_setting c
LEFT JOIN pg_database d ON d.oid=c.setdatabase
LEFT JOIN pg_roles r ON r.oid=c.setrole
CROSS JOIN LATERAL unnest(c.setconfig) AS s(setting)
WHERE s.setting LIKE 'pgrst.%'
  AND (c.setdatabase=0 OR d.datname=current_database());
COMMIT;
```

Review `pgrst.db_pre_request`, `pgrst.db_pre_config` and settings that affect exposed schemas/roles. Keep any unrelated sensitive configuration out of shared exports. A database/role override or pre-config function must be reviewed, not silently overwritten. A SQL Editor `current_setting()` result or SET ROLE in the same connection does not establish the authenticator's live PostgREST session state.

Then inspect **Integrations > Data API / API settings** for displayed API/schema configuration and overrides. The dashboard may not expose a pre-request or environment-level setting. If not available, obtain a redacted effective-config statement through the operator's existing management access or Supabase support. Do not invent an absent UI toggle, expose service secrets or change role/database settings to investigate.

After the separately approved installation and configuration, runtime confirmation requires direct **non-mutating** requests to staging `/rest/v1/rpc/get_payment_gateways`, with POST body `{}` and the staging publishable key supplied privately:

| Caller after installation | Required result |
| --- | --- |
| Missing UAT capability | Gate-specific access denial (normally HTTP 403 for anon) |
| Wrong UAT capability | Same denial |
| Expired/unset run window | Same denial |
| Valid temporary capability and approved window | Read succeeds for required guest configuration reads, all four methods still disabled |
| Unrelated authenticated staging user, even with capability | Denied |
| Approved run actor with proper capability | Required reads succeed; unrelated vendor records still denied |

Also test an existing permitted bounded table SELECT route, not only the RPC, with missing/wrong capability. Require SQLSTATE `42501` and `Staging UAT access required`; generic gateway errors, empty RLS results and schema-cache errors are not gate evidence. Forged role headers without a valid service JWT must not reach the deliberate service-role bypass. Read back catalog/pre-config settings after reload and repeat fresh requests to check consistent worker behavior. Preserve CORS OPTIONS; metadata routes are distinct from data operations. Keep service keys out of browsers. No positive capability/window or user fixture writes are authorised by this preparation task.
A generic 401 from a wrong publishable key is not proof that the UAT gate ran. Capture status, redacted error and intended function identity. Use fresh requests after configuration reload; a catalog change or SQL NOTIFY alone does not prove workers reloaded. Do not use create_order, report/verify payment or any mutating RPC as a probe. Current task performs none of these transport requests. Positive run-actor checks require later authorised provisioning; temporary capability/window configuration is itself a write requiring the appropriate approval.

PostgREST pre-request enforcement does not cover Auth, Storage, Realtime or Edge Functions. Preserve the existing allowlist/RLS and separate-surface verification from the security runbook; Vercel-only protection or CORS is insufficient.

## C. Notification suppression / failure checklist

Complete before account provisioning, without uncontrolled delivery:

1. Compare the captured baseline to the approved sink function, grants and expected URI. After approved installation, verify that the hosted Send Email hook is enabled at `pg-functions://postgres/private/uat_send_email` and points to the reviewed function, not an external sender.
2. Confirm the private capture table has RLS, no browser-role CRUD, restricted operator access and append-only history. Allowed capture is action/time/run/channel/salted recipient hash/suppressed flag; no OTPs, links, tokens, raw recipients, bodies or payloads.
3. For signup/confirmation, Admin creation, invitations, recovery, magic link, email change and reauthentication, record one of: verified hook suppression; configuration-blocked; or UNKNOWN. Provisioning must use confirmed Admin createUser, never invitations. Do not exercise invitation/signup endpoints under this read-only task.
4. Cover each security email and independent SMS/app/Edge/automation path separately. If hook coverage is not established, keep the path explicitly blocked or behind a verified non-forwarding sink under separate approved configuration. `.invalid` destinations and absence of SMTP credentials in the repository do not prove suppression.
5. Review error behavior: hook failure must not invoke custom/default SMTP, a secondary provider, webhook automation or retry queue capable of real delivery. The local SQL function contains no sender/fallback; that is not proof of hosted GoTrue fallback behavior. Establish this through supported configuration/provider evidence or a separately approved non-delivering controlled test with provider egress disabled. A direct SQL call of the sink proves capture only, not Auth routing.
6. If fallback/coverage cannot be established without a live-delivery risk, mark it blocked and do not send a probe. Do not temporarily detach the hook: that may reactivate SMTP. During recovery, retain suppression unless an independently verified no-delivery replacement is explicitly approved.

## Minimum remaining sequence

1. Auth/hook/SMTP baseline is complete. Operator supplies effective REST configuration attestation and the outstanding MFA/external-automation inventory in the linked prerequisite report; record security-email toggles. No credentials need to be shared in chat.
2. Reconcile any differences with the captured helper/ACL/REST baseline and the tested recovery procedure. Local recovery (59 assertions) is complete; native Auth/REST runtime verification is not.
3. With valid installation approval and all prerequisites passing, install/configure only the reviewed staging gate/allowlist/sink and Preview-only protection; verify anonymous denial, authorised operator access, notification coverage and unchanged public production routing. Never use the authenticated URL-fetch/share-link helper.
4. Obtain the separately required provisioning approval. Execute the existing secure operator workflow, assign the exact synthetic admin separately, register only approved run IDs and complete the original Phase 1 vendor/profile/RLS checkpoints. Keep all methods off.
5. Only after actual backend isolation, notification suppression and all checkpoints pass, use the explicitly approved bounded manual-only UAT window; retain the 12-order cap, immediate classification, no transfers and mandatory all-disabled closeout.

Current outstanding items are operator configuration evidence and hosted verification, not another checkout implementation or rerun of completed local security work. No launch readiness is claimed.
