# Supabase Support request — DRAFT, NOT SENT

Prepared 26 October 2026. Project administrator reviews, fills the evidence references
and submits only under separate authorization. No request for configuration changes.

**Subject:** Read-only effective PostgREST/Auth configuration and recovery evidence — officebites-staging

Project: `officebites-staging`, ref `eyhmarmekioovcjibcbr`, eu-west-1.
Last reported engine: PostgreSQL 17.6.1.166; please confirm the current serving stack.

We are reviewing a locally prepared, unapproved EFT-only staging migration. Nothing
has been installed or enabled. All four payment methods were disabled in a read-only
observation on 26 October at 13:44:27 UTC. We need exact-project platform evidence
before deciding whether installation is safe. Please inspect only: do not change
Auth, SMTP, hooks, API schemas, database roles/configuration, secrets, gateways,
network restrictions or backups; do not reload/restart, restore, send test messages,
invoke webhooks or create users/orders. If any answer requires an action, describe
it and its impact for a separate approval rather than performing it.

## Evidence already available / limitations

Read-only catalog observations on 26 October found no matching role/database pgrst
settings; this does not prove effective process configuration. Private-schema USAGE
exists for client roles; selected commercial tables have owner-only ACLs and RLS,
and explicit helper/RPC grants exist. No effective-runtime assertion follows from
those facts. The proposed migration defines `private.uat_pre_request()` and
`private.uat_send_email(jsonb)` but neither is installed/attached by this request.
We must not overwrite an existing hook or assume defining a function attaches it.

## Questions not settled by Dashboard/permitted read-only queries

1. **PostgREST effective configuration:** Please provide timestamped, redacted
   effective values and their precedence/source for every serving instance:
   PostgREST version, Data API enabled status, database role/database name (no
   connection URI), exposed schemas, extra search path, `db-config`, `db-pre-config`,
   `db-pre-request`, and config reload channel/enabled state. Include applicable
   environment/startup/control-plane overrides and database/role settings. Are
   replica/pooler paths or differing instances relevant? An absent field must be
   labelled unknown, not assumed default.
2. **Reload and hook compatibility:** What evidence establishes the currently loaded
   config/schema-cache revision across all instances? Is there an existing
   pre-request/pre-config hook whose behavior a future gate must preserve? Can an
   administrator verify loaded versus stored values read-only? If not, confirm
   them here; do not issue a reload. Explain whether a future hook attachment
   would require separate reload/configuration work and how to verify success.
3. **Auth routing and failure semantics:** Confirm effective signup/email/phone/
   anonymous/MFA availability and enabled hook types/targets using secret-free
   descriptions. For Send Email/Send SMS and before-user-created/token hooks,
   identify SQL versus HTTP routing and default/custom provider fallback, failure,
   timeout and retry behavior for the running Auth version. Can an error/no-op hook
   ever forward to default SMTP/SMS? Which MFA/verification/recovery/security-email
   paths do and do not use these hooks? Do not send a probe or reveal recipients.
4. **Cross-product boundary:** Confirm that Data API pre-request checks do not cover
   Auth/Storage/Realtime/Edge traffic; identify project-level serving paths, service
   bypasses or managed egress not visible in ordinary Dashboard settings that our
   separate RLS/channel review must account for. We understand Support cannot
   certify our application policies or external-worker/provider isolation.
5. **Backup/recovery, only if Dashboard evidence is incomplete:** Confirm available
   successful backups/PITR bounds and timezone, plan entitlement and failed/pending
   backup status; clarify restore limitations for roles, Auth/config, Storage object
   bytes, Edge Functions and service configuration. State what restore verification
   can be obtained without changing this project. Do not initiate a restore or add-on.
6. **Audit limits, only if operator evidence is insufficient:** What platform audit/
   database logs and retention could correlate an authorized database settings
   change around `2026-10-26 11:56:55 UTC`? Our application audit records a PayFast
   disabled/maintenance-false event then; we are not asking Support to approve that
   commercial state or infer the human actor from missing logs. Identify gaps and
   availability without exposing credentials or personal data.

For each answer please state: exact project, observation UTC time, effective versus
declared value, evidence source, visibility/retention limitations and whether the
answer covers all serving instances. Where unsupported, please say so and suggest
a read-only verification method. We will authorize any later changes separately.

## Attachments for operator review before sending

- Redacted Dashboard Data API/Auth/backup captures with operator/time/project.
- Allowlisted role/database-config and relevant schema/ACL summaries; no raw config.
- Exact error/time from a failed effective-config inspection if available.
- Sanitized change-correlation metadata only if audit question 6 is needed.

Attachment artifacts are **not yet supplied by this handoff**. Do not attach SQL
install requests, keys, JWTs, bank/customer records or unrestricted HAR/log exports.
The reports can supply local context, but contain no platform approval.

## Keep outside the Support request

An ordinary authorized admin first captures Dashboard declarations, logs and catalog
metadata. Vercel webhook 403 belongs to the Vercel team admin; external notification
routes belong to their operators. Backup drill execution/maintenance acceptance,
PayFast authorization, artifact scope, legal approval and release permission belong
to OfficeBites owners. Support answers cannot close those owner decisions.
