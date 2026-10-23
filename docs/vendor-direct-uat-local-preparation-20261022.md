# Final UAT local preparation — 22 October 2026

**NO-GO for hosted writes or UAT.** This task permits local preparation and hosted reads only. No account, profile, order, payment, hook, gate, allowlist, Auth setting, Vercel setting, migration, commit, push or deployment is authorised by this document or task.

## Reviewed target and refreshed evidence

- Branch/HEAD: `feat/vendor-direct-launch-payments`, `695e5e19cf581f6202dcc058afad1ee2fba23208`.
- Staging: `eyhmarmekioovcjibcbr`, officebites-staging, ACTIVE_HEALTHY.
- Current Preview: `dpl_DGWZnPj1ubqxzCfzDcZVUJ3iEYTQ`, https://officebites-70l6nc42z-sp24tg-6983s-projects.vercel.app, freshly read READY, target null, no aliases. Platform Git metadata is empty; release identity relies on the existing exact Git export and served-bundle evidence in the release results, not a new platform Git-SHA attestation.
- Fresh recovery capture: `checks/uat/fixtures/recovery-baseline-20261022.json`, captured **2026-10-22 10:02:16 UTC / 12:02:16 SAST**, using SELECT queries only.
- All four methods disabled; manual ready/maintenance unchanged, PayFast/Ozow maintenance retained. Deadline 15 minutes, threshold R500. Orders 15, payment profiles/manual payments zero. No UAT gate installed.
- Current migration head `20261021100655`; required manual foundation `20261020100740` also present. The provisioning checkpoint's `migration` remains the required manual foundation, not a false claim that it is the latest head.
- Captured `private.active_account()` definition, owner, ACL and grants match the historical fixture exactly; safe catalog REST settings remain empty. Captures deliberately whitelist nonsecret configuration keys. Neither empty catalogs nor a successful request establishes effective service configuration.
- Historical `recovery-baseline.json` and `auth-baseline-20261021.json` are preserved. Auth observations remain dated operator evidence; no new Auth service configuration was exposed. The fresh checkpoint marks current effective REST/Auth delivery verification false/unknown.

`readiness-checkpoint-20261022.json` records those facts with notification/backend/Auth acceptance and provisioning approval **false**. It must fail provisioning validation. It is evidence, not an execution permit; its timestamp also expires under the existing 30-minute provisioning freshness rule. Do not manually flip flags merely to pass validation.

## Local script changes

The existing provisioning core now shares the exact reviewed release reference. The operator script records that reference for a new manifest and rejects a different/missing reference in an existing encrypted manifest before reconciliation. It never silently rewrites old vault history. A stale vault requires explicit local operator review, not deleting it, guessing passwords or creating replacement accounts. No vault or credential was opened during this task.

The checkpoint requires the reviewed commit, Preview ID/URL and an explicit `provisioningApproved` flag in addition to existing identity, freshness, notification, backend, Auth and all-disabled checks. The flag is only a procedural guard; it is not an approval issued by the software. Existing staging-only origin/redirect validation, independent Management API identity check, DPAPI/ACL storage, pre-write checkpointing, collision checks, non-admin signup role, default offline help and idempotent account reconciliation remain intact.

The recovery generator accepts the exact newly captured migration pair/release, as well as the preserved historical fixture. It still rejects another project, installed-state baseline, unknown future migration, missing required migration or wrong release. This expands only local generation/test compatibility. It does not authorise execution, prove live PostgREST reload or restore the absent Auth hook. The refreshed recovery run writes separate evidence under `.officebites-local/OB-UAT-20261020/recovery-20261022/`.

## Only remaining notification evidence

Use the existing operator checklist and source review; do not repeat the completed GoTrue v2.197.0 mail-source investigation unless the deployed version changed.

1. **Operator, staging Dashboard → Authentication → Providers, Emails/SMTP, Auth Hooks:** timestamp current Email/Phone/public-signup state, custom SMTP enabled state and hook enabled/URI state; inspect security-notification toggles. The prior confirmed baseline is Email on, Phone off, public signup on, custom SMTP off, no hooks. Treat drift as a stop condition. Do not Save, Add hook, Send invitation, Recover password or send probes.
2. **Operator → Authentication → MFA and Phone/Send SMS:** establish phone enrollment AND challenge/verification controls, configured SMS provider presence and Send SMS hook state. Phone provider off does not independently settle MFA SMS coverage. Record UNKNOWN if not exposed; no enrolment or challenge probe.
3. **Operator → Database Webhooks, Cron, Edge Function settings; Vercel/external integrations and provider accounts:** complete the existing per-channel inventory for email/SMS/WhatsApp/push/schedulers/webhooks/log drains/automation watching staging. Inspect presence and routing, never secret values or test delivery. Existing source/bundle scans found no independent application sender but do not attest external automation.
4. **Operator → notification recipient review:** establish that synthetic onboarding/order actions cannot fan out to real in-app/Realtime recipients or external subscribers. Platform account/team/security/billing mail lies outside the Send Email hook; preserve platform security alerts and avoid intentional alert/invitation flows. Record this boundary explicitly.
5. **Later separately approved installation acceptance:** hook enabled at `pg-functions://postgres/private/uat_send_email`, correct private grants/RLS/redaction, verified non-delivery and fail-closed error routing. Direct SQL sink success is not native Auth dispatch evidence. Retain a working sink during recovery; disabling it can restore SMTP delivery even with custom SMTP off. Unknown paths block provisioning, not justify a real-recipient probe.

No listed built-in Auth/security mail bypass was found in the reviewed version's `sendEmail` helper. Outside coverage remains independent automation, SMS/WhatsApp/push/MFA SMS and platform operational mail. The remaining work is configuration/transport evidence, not another notification implementation.

## Precise PostgREST operator checklist

1. Verify project ref/name in **Supabase Dashboard → Integrations → Data API → Settings** (or equivalent Data API settings screen). Record only displayed nonsecret settings and timestamp. No pre-request/db-config field means **not exposed**, not empty, false or default. Do not Save/restart/reload.
2. Through an existing trusted local Management API client, GET `/v1/projects/eyhmarmekioovcjibcbr`, then GET `/v1/projects/eyhmarmekioovcjibcbr/postgrest` with authorised read access. Inspect privately and whitelist required nonsecret values; do not export the full response, which can contain sensitive fields such as JWT configuration. Never paste credentials into chat/arguments. Exposed schema/pool/row-limit fields alone do not establish hook/db-config values.
3. Correlate safe catalog role/database settings with `recovery-baseline-20261022.json`. Obtain effective `PGRST_DB_CONFIG`, `PGRST_DB_PRE_REQUEST`, `PGRST_DB_PRE_CONFIG`, deployed version, database/login role, provenance and all applicable overrides/pre-config results. Read a disclosed function's definition/owner/grants; do not execute unknown pre-config code as an inspection technique.
4. If any effective value/provenance is inaccessible, use the existing support inquiry in `vendor-direct-uat-prerequisites-20261021.md`. Ask Supabase for timestamped project-bound attestation across every serving worker, exact recoverable prior hook, whether the proposed authenticator setting will be honoured, supported reload mechanism (`db-channel`/`db-channel-enabled`) and a non-mutating post-reload attestation. Request no secrets and no service changes. A complete authoritative operator export can substitute for Support; a partial API response cannot.
5. There is no established hosted CLI dump that proves these values. Local `config.toml`, `supabase status`, SQL Editor `current_setting`, role switching, local PostgREST and successful HTTP/NOTIFY responses are not hosted worker attestations.
6. After separately approved installation only: require gate-specific `42501` / `Staging UAT access required` on RPC AND bounded table reads with missing/wrong capability, and on expired/unset window/unrelated users. Test fresh requests plus supported runtime attestation. Valid guest/run-actor reads must retain application RLS and use an audited staging-REST-only header injector with verified CORS. Keep capability out of Vite variables, URLs, storage, screenshots and logs. Auth/Storage/Realtime/Edge need their own checks; Preview protection/CORS alone cannot secure the upstream API.

## Approval boundary and next action

Every hosted write must map to an explicit existing approval covering that exact operation or receive separate approval first. A bounded batch may be covered by one explicit approval; neither a runbook, a true checkpoint flag nor `--execute` creates authorisation. This task authorises **none** of the following:

| Future operation | Approval/evidence required before writing |
| --- | --- |
| Gate/sink SQL, REST setting/reload, Auth hook/signup safeguard, Preview-only protection | Existing conditional installation approval reconciled with current evidence and exact scope; obtain any missing scope. No substitution or broader protection |
| Confirmed Admin Auth users, admin role, run allowlist/capability/window | Separately approved synthetic provisioning/role/access operations after hosted isolation acceptance |
| Vendor/meal/profile submission and independent approval | Explicit fixture/onboarding scope, synthetic-only destinations, original snapshot protection |
| Manual method activation, one order, classification, simulated confirmation/fulfilment/receivable | Separately approved bounded UAT window; all other methods off; no actual transfers |
| Closeout writes/session revocation/restoration | Include exact safe closeout in the UAT approval; no automatic destructive rollback or sink detachment |

Do not invoke the provisioning script with `--execute` now. Its ordinary invocation is offline help. Preserve all four disabled flags, 15 minutes/R500 and zero hosted fixtures until evidence and the relevant approval are complete. Merchant/payment-provider approval is not needed for a no-funds synthetic manual test; it must not be inferred for live operation or PayFast/Ozow.

**Next executable action:** the operator completes the two read-only evidence packages above, beginning with Data API settings/Management API inspection and the MFA/external-notification inventory. Submit the existing precise Supabase Support inquiry only for inaccessible effective PostgREST fields. Codex can then review the redacted evidence and update readiness locally; hosted installation/provisioning remains NO-GO until accepted.

## Local validation

Executed locally on 22 October:

| Command/check | Result |
| --- | --- |
| `node checks/uat/provision-core.test.mjs` | **44 passed**, APIs mocked; includes wrong release/project, missing approval, stale checkpoint and idempotent reconciliation |
| `node checks/uat/preparation.test.mjs` | **28 passed**, compares historical/current helper definition/owner/ACL/grants and safe catalogs; rejects unsupported restoration baselines and non-authorising checkpoints |
| `node checks/uat/verify-recovery.mjs checks/uat/fixtures/recovery-baseline-20261022.json` | **59 passed**, actual local SQL restoration/interruption/permissions plus non-delivery model; hosted Auth not attested |
| `node checks/checkout-database.mjs` (existing local chain) | **481 passed**, including **59 historical recovery** and **43 security** assertions; synthetic PGlite only |
| `node checks/uat/provision-staging.mjs` without execution flag | Offline help, exit 0; no network calls/accounts |
| Focused oxlint on all seven preparation modules | PASS, exit 0, no warnings |

Total: **612 assertions**, counting the integrated chain once. Historical and refreshed recovery baselines were both exercised; these are separate local baseline runs, not new hosted transport tests. Logs: `.officebites-local/uat-preparation-recovery-20261022.log`, `.officebites-local/uat-preparation-security-20261022.log`; current recovery evidence/SQL is in the separate dated directory above. Generated SQL is not permission to execute it.

No browser/PWA build was repeated because no application runtime source changed. No source or migration diff, staged changes, commit, push or deployment was introduced by this preparation. Existing excluded working-tree work remains preserved.
