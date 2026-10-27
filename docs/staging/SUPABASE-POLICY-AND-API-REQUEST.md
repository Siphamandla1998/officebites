# Unsent operator / Support request

Target staging project: **eyhmarmekioovcjibcbr**. No request has been sent and no
hosted SQL is authorized by this draft. Production is **gfzhdkitdyqftealgqfi** and is
excluded from this installation request.

## Ask the project administrator first

1. Confirm the project in Dashboard; export the read-only preflight in
   `checks/staging-installation-preflight.sql` only after separate SQL approval.
   Compare the exact history/function fingerprints with
   `docs/release/staging-installation-manifest.json`. Capture API settings and
   Auth/Storage configuration with values/secrets redacted.
2. Confirm the supported policy-only path for `postgres` on `storage.objects`:
   SQL Editor or an approved migration runner using existing `supautils` delegation.
   The prepared policy step contains CREATE POLICY only; it does not ALTER managed
   tables or transfer ownership. Verify restrictive policies can be retained exactly.
3. Confirm whether `supabase_migrations.schema_migrations` has the normal
   `version`, `name`, `statements` columns and permits the approved installation
   bundles to record their NEW versions atomically. Do not edit old ledger rows.
4. If installation is later approved, create the `vendor-compliance` bucket through
   Storage Dashboard/API: private, 5,242,880-byte limit, allowed MIME types exactly
   `application/pdf`, `image/jpeg`, `image/png`. Do not change existing buckets or
   upload any evidence now. Bucket creation is a separate reviewed action.

Supabase's official [Storage access-control documentation](https://supabase.com/docs/guides/storage/security/access-control)
uses policies on `storage.objects`. The upstream
[supautils policy-delegation implementation](https://github.com/supabase/supautils#manage-policies)
supports policy DDL without table ownership. The official
[managed-policy troubleshooting guide](https://supabase.com/kb/troubleshooting/realtime-must-be-owner-of-table-messages)
distinguishes delegated policy DDL from forbidden ALTER TABLE. These establish a
supported mechanism, not proof of this project's effective configuration.

The previous production candidate's literal managed-owner login requirement is
therefore **not the preferred staging mechanism**. Its four files remain preserved;
their successful plain-Postgres owner rehearsal does not prove delegation is absent
on Supabase. No role membership, superuser, owner transfer or blanket grant is needed
or requested for the preferred staging path.

## Minimal Support request if the administrator cannot confirm the mechanism

> For staging `eyhmarmekioovcjibcbr`, please confirm the supported execution path
> for the attached six scoped/restrictive CREATE POLICY statements on
> `storage.objects` as ordinary `postgres`, using the project's existing managed
> policy delegation. We are not requesting ownership transfer, managed-role
> credentials/membership, disabled RLS or broader table privileges. Please confirm
> whether SQL Editor or the supported migration runner can apply the exact policy
> types, while preserving Storage's managed owner. If the configured delegation is
> unavailable, identify the supported provider-admin execution/ledger workflow.
> Do not execute the attachment; we will obtain separate installation approval.
>
> Please also provide or point us to authoritative effective PostgREST exposed
> schemas, pre-request/pre-config hooks, role/database/service precedence and the
> supported schema-cache reload verification method. SQL-declared GUCs alone are
> insufficient. Confirm the Auth send-email/SMS-hook failure and fallback semantics
> needed for a strictly non-delivering staging test. No credentials, JWT signing
> keys, SMTP passwords or customer/bank records are requested.

Attach only the manifest, canonical policy SQL (second `.sql`, not a production
installer), redacted read-only ownership/delegation evidence and any exact error
request ID if an approved future execution fails. Do not run a write probe just to
generate an error. Local plain PostgreSQL correctly rejected application policy
DDL and passed the separately owned fallback; it does not implement supautils.

If a provider-admin fallback is required, stop before execution: obtain a reviewed
coordinator for policy commit plus exact NEW-version recording. The preferred
atomic installation bundle is for a confirmed `postgres` delegation path; do not
give the managed owner ledger access or manually repair historical entries.
