# OfficeBites production recovery checklist — 28 October 2026

**Release status: NO-GO. Preparation only is authorised.** No migrations, policy
DDL, bucket creation, data changes, payment activation, cloud restore, frontend
deployment or credential changes were performed. Original migration files and
their manifest remain byte-for-byte unchanged. This checklist supersedes the
earlier assumption that Storage policies always require logging in as the owner.

## Completed evidence and assigned work

Current execution details and tests: `PRODUCTION-EFT-RECOVERY-EXECUTION-20261028.md`.
Secure owner setup/export/restore: `PRODUCTION-BACKUP-OPERATOR-20261028.md`.
The separately reviewed Storage alternative is prepared, not approved or installed.

| Gate | Connected/local work completed | Manual action / responsible operator | Evidence required to close |
|---|---|---|---|
| Production identity / plan | Supabase project `gfzhdkitdyqftealgqfi`; organization `uhgbmvutojjkmsfyotdk` is **Free** | Project owner Siphamandla confirms target in Dashboard | Project ref, plan, approval/window |
| Existing-data safety | **32 orders: 31 pending payment, one preparing**; original order/suborder/item digests unchanged | Release owner prevents conflicting changes during the approved export/install window | Snapshot-bound preservation manifest, before/after comparison |
| Migration baseline | Full 38-entry ledger fingerprint, latest `20261010101910`, three security function hashes, core owners/RLS and all four SQL SHA-256 values match | DBA/reviewer signs exact artifact/manifest | No drift, recorded review SHA/hash and supported executors |
| Production backup | Connector has no backup inventory/create/export endpoint. Native pg_dump/pg_restore/psql/Docker/age and approved production libpq configuration not available. Secure interactive setup and operator procedure prepared. SQL metadata is not a backup | **Siphamandla Khumalo confirmed as backup operator**; completes private setup using actual production Connect-panel details | Successful bounded read-only export, encrypted archive, manifest/TOC/hash, private independent copy and decryption test |
| Restore drill | Defined below; **not performed**. Existing local/cloud recovery evidence is staging-only or synthetic | Named backup/restore operator; owner approves isolated target and handling of production data | Zero-error isolated restore, catalog/data/permission comparisons, measured duration, accepted RPO/RTO |
| Storage execution | `postgres` is not owner/member; **session-preloaded supautils and configured policy delegation cover storage.objects/buckets** | Owner confirms supported exact path; Supabase Support if original managed-owner file is retained | Executor/session evidence, managed rehearsal, exact six-policy comparison; no role/ownership changes |
| Managed user journeys | Existing local/browser evidence retained; no new login or mutation tests performed under this preparation | Owner supplies active dedicated customer/vendor credentials privately; independent admin/compliance/legal reviewers | Isolated Auth/Storage/PostgREST UAT and role-isolation matrix below |
| Final release decision | Ordering/payment/legal activation remain closed | Owner appoints release executor and recovery operator; approves exact final package separately | All gates PASS, signed maintenance/recovery and operational/legal/bank approvals |

Recovery/release executors must be named before execution. Siphamandla is the project
owner/approver and has explicitly accepted the backup operator role. Codex can prepare and compare
evidence through connected read tools; Supabase Support owns any platform-only
execution assistance. No support message or external workflow was sent/dispatched.

## 1. Backup capability, coverage and safe recovery test

Supabase documents daily backup access for paid plans and recommends logical
exports/off-site copies for Free projects. PITR and restore-to-new-project require
paid capabilities; neither is evidenced as available for this Free organization.
Do not pause production, upgrade billing or invoke the connector's
`restore_project` tool to try to create a backup. That tool is not a backup export.

A current logical backup **can be prepared by an authorised operator**, without
writing production business data, once native clients, secure connection access
and private encrypted storage are available. It **cannot currently be created or
certified with the connected tools alone**. Customer/vendor UAT passwords are not
database backup credentials. Do not reset the working production DB password.

Operator steps, after the source-read window and private processing are approved:

1. Obtain the production direct or session-pooler endpoint from Dashboard Connect;
   do not use the transaction pooler or guess a host. Use an approved PostgreSQL 17
   client, verified TLS, a least-scope existing credential in private libpq service/
   password/CA files, and `--no-password`. Keep secrets and cleartext dumps out of
   Git, chat, command-line arguments and synced folders.
2. Confirm project identity, PG17, read-only transaction state, TLS and the complete
   38-entry/security baseline. Establish a bounded schema/role-change freeze; a
   freeze changes no database policy. Use a repeatable-read READ ONLY transaction
   with an exported snapshot for the custom-format pg_dump and data/catalog
   fingerprints from that same snapshot. Keep the snapshot session alive through
   completion. Capture roles/ACLs separately without custom-role passwords and
   check they did not drift. Set lock/statement/time limits; stop on permission,
   timeout or snapshot failure. Do not silently omit managed tables to finish.
3. Inventory **public, private, auth, storage and supabase_migrations** schema/data,
   sequences, constraints, triggers, functions/owners/search paths/ACLs, policies,
   role membership/default/column grants and extensions. A dump tool's defaults
   must not be assumed to include every managed schema. Verify required archive
   entries explicitly. Preserve all original order/payment/legal/account data.
4. Validate archive TOC and checksums; encrypt the archive and sensitive manifests
   before any off-site transfer. Verify an independently retained encrypted copy,
   key custody and a private decryption/manifest round trip. Record snapshot time,
   bytes, tool versions, commands-without-secrets, exit codes and approver/operator.
5. Restore **first into a new disposable offline PG17/Supabase-compatible runtime**
   with a pinned image and expected managed roles/extensions, no external network,
   no production DSN/secrets and a fresh distinct database/port/volume. Do not use
   production, current staging, an existing payment cluster or a public preview.
   Confirm target identity before any restore. Suppress no errors; any managed-role,
   extension or ownership conflict requires a reviewed restore procedure.
6. Restore the archive and roles using the reviewed bootstrap/ownership order.
   Compare snapshot-bound row counts/digests for every covered table, sequences,
   full schema/function/policy/privilege metadata and original order records. Test
   negative permissions with anonymous/customer/vendor/admin roles using synthetic
   claims only in the offline fixture. Test crash/restart and independently recover
   the encrypted archive. Record restore-only and total recovery durations.
7. Rehearse the exact final release in a separate disposable copy, preserving the
   pre-migration restore as evidence. Managed supautils, Auth/JWT, Storage transport,
   API schema exposure and Realtime need a later isolated managed UAT environment.
   Prove no outbound jobs/webhooks/SMTP/push/provider access **before** restoring
   production-derived data there. Do not rely on disabling jobs after they run.

| Coverage | Database archive | Additional recovery evidence |
|---|---|---|
| Orders, profiles, vendors, finance, legal/audit records | Required schema/data and original snapshots | Same-snapshot comparisons and business integrity checks |
| Auth users/identities | Required sensitive auth-schema records, including hashes where permitted | Auth configuration, redirect URLs, provider/SMTP configuration and key handling; do not send real recovery emails from a clone |
| Storage | Bucket/object metadata only | **60 object records across 5 buckets** observed; separately inventory/download actual bytes through Storage APIs, verify content hashes and private access, and restore through APIs |
| Vault/encrypted values | Encrypted DB values alone are insufficient | Owner-controlled encryption-root/key recovery and a successful isolated decryption check; no secret material in reports |
| Roles, service settings, Edge/Vercel/integrations | Only database-covered definitions | Secret-manager recovery, environment configuration, Edge code, service/API/Realtime settings, scheduled jobs/webhooks and external event/bank reconciliation |

Current result: **no production archive created, no production restore test run,
no measured RTO, no accepted RPO, no complete-service recovery proof**. A hash-only
metadata report or the staging backup workflow is not a production recovery point.
Existing staging scripts hard-code a different project/history and must not be
retargeted merely by substituting a project ref.

## 2. Storage migration: supported path and owner actions

`20261027115843_production_compliance_storage_owner_policies.sql` requires
`current_user='supabase_storage_admin'` and ownership of `storage.objects` in its
own DO guard. It then directly inserts the bucket metadata and creates six policies.
That explicit guard rejects the connected `postgres` role even though the platform
delegates policy-management authority to it. BYPASSRLS does not confer ownership.

Fresh production evidence: `session_preload_libraries='supautils'`;
`supautils.policy_grants` allows postgres on `storage.objects` and `storage.buckets`;
storage objects remain owned by `supabase_storage_admin`, with RLS enabled and no
postgres membership. Supabase's own source documents policy delegation. This is
more accurate evidence than native PostgreSQL ownership checks without supautils.
**No CREATE POLICY probe, even one followed by rollback, was run in production.**

Supported mechanism: manage policies through SQL Editor/normal postgres using the
platform-configured delegation; manage bucket creation/settings through the
Storage Dashboard/API. Supabase recommends treating Storage metadata as read-only
outside those APIs. This does not make the current combined P4 executable as-is.

Owner decision, before release approval:

- **Keep exact P4:** obtain written Supabase confirmation/assistance for its exact
  owner guard, bucket operation, transaction and migration-history recording.
  Project ownership in the Dashboard does not grant a managed-role login. Do not
  obtain/share a managed-role password, SET ROLE through unsupported means,
  transfer tables or grant managed membership.
- **Use supported delegated policies plus bucket API:** prepare a separately
  versioned, reviewed replacement package that retains the same six predicates,
  commands, role lists and restrictive boundaries, validates the provider's
  delegated authority, and validates the bucket created through the normal API.
  Rehearse it on managed Supabase, refresh the manifest/history expectations, then
  obtain new approval. **Do not remove the guard from the existing file or execute
  selected lines around it.** No such replacement has been approved or executed.

For the second path, after approval and P3 installation, the owner uses Storage to
create `vendor-compliance`: private, 5,242,880-byte limit, exactly PDF/JPEG/PNG MIME
types. Independently verify its resulting catalog settings. The supported policy
executor then applies the approved replacement, retaining `compliance_object_insert`,
`compliance_object_read`, `compliance_insert_boundary`, `compliance_read_boundary`,
`compliance_no_update` and `compliance_no_delete`. Dashboard policy conveniences
must not silently replace `AS RESTRICTIVE` with permissive policies.

If delegation is unavailable in the selected execution session, stop and ask
Supabase Support to confirm/fix the supported provider configuration. The owner
must not change supautils configuration, ownership, broad policies or RLS to make
the release pass. Preserve non-compliance buckets' behavior as well.

## 3. Four-file review, retries and rollback boundaries

All paths below are under `release/production-candidates/`; exact hashes remain in
`docs/release/production-migration-manifest.json` and all four still match.

| Order | File | Preconditions / review outcome |
|---|---|---|
| P1 | `20261027093453_production_launch_browser_grants.sql` | App postgres; count 38/latest/security hashes/core RLS/owners match. New preflight additionally compares the **entire ledger fingerprint**. Revokes unsafe table/schema privileges and direct provisioning INSERT; no row update |
| P2 | `20261027112327_production_minimum_manual_legal_foundation.sql` | Requires recorded P1/history 39, active-account helper and absent new manual tables; existing financial core must match. Adds two order columns with defaults and manual/legal foundations; retains historical order semantics |
| P3 | `20261027112437_production_checked_settings.sql` | Requires recorded P2/history 40 and correct objects; composes legal/compliance guards, agreement receipts, fee snapshots and CAS settings. Includes helper permissions used by Storage policies. No approved documents/real banking/activation supplied |
| P4 | `20261027115843_production_compliance_storage_owner_policies.sql` | **Executor/package decision unresolved**, as above. Original guard checks owner/helper, not the complete preceding ledger; external full-history gate is mandatory |

These are **one-time guarded migrations, not an idempotent replay batch**. P1's
revokes are largely repeatable in isolation but history guards must not be bypassed.
P2/P3 contain CREATE/ALTER/rename operations and will not safely rerun. P4's bucket
ON CONFLICT and configuration check do not make its plain CREATE POLICY statements
idempotent. After any uncertain connection/commit result, inspect history and exact
objects before retrying. Do not insert invented history or loosen guards.

One transaction per approved SQL file; the runner must reliably reconcile successful
commit/history recording between files. The original sequence expects
38 → 39 → 40 → 41 → 42. A revised Storage/API package requires revised, reviewed
history expectations. Do not use blanket db push or replay staging sources; do not
apply `20261027094852_production_manual_legal_transition_guards.sql` separately,
because P3 already composes it.

Before COMMIT, a failed transaction rolls back. After COMMIT, prefer approved
forward containment of new initiation while preserving evidence and historical
settlement. Frontend rollback needs a tested compatible target; the current broken
deployment is not evidence of a working rollback. No destructive down migration,
blanket restore over later activity, order reclassification or paid-state rewrite.

## 4. Preflight, postflight and user-journey evidence

Prepared files:

- `checks/production-recovery-preflight.sql`: SELECT-only; **executed successfully**
  in production. Full ledger/security/core-object checks pass. Snapshot in
  `docs/release/recovery-preparation-20261028.json`.
- Existing `checks/production-launch-preflight.sql` and
  `checks/integrated-release-rpc-preflight.sql`: broader catalog/ACL/RLS/RPC inventory.
- `checks/production-recovery-postflight.sql`: SELECT-only; prepared, **not executed**
  because foundations are not installed. It checks closed rollout states, original
  order projections, restrictions, banking/evidence grants and six Storage policies.
  Revalidate it if P4 is replaced. Compare exact definitions with approved rehearsal
  manifests, not policy counts alone.

Refresh data/restriction digests at the approved snapshot/install boundary. P2 adds
`checkout_revision` and `delivery_fee`; postflight compares existing order columns
by excluding those new defaults. Preserve original values for all 32 orders,
suborders and items, plus vendor statuses/owners/rates and account restrictions.
Do not freeze the earlier 32-row observation as a reason to discard legitimate
orders created before an approved future window. Unexplained drift is a stop.

| Validation | Required evidence / isolation |
|---|---|
| Customer login | Genuine dedicated customer; confirmed email; correct DB role; session reload/refresh; no other profiles/orders visible |
| Vendor login | Dedicated owner-linked vendor; correct role/status; session reload; another vendor's orders/banking/evidence denied. Suspended vendor remains denied; never unsuspend it for UAT |
| Administrator | Working admin role preserved; ordinary users cannot call admin actions; independent reviewer and account-switch/race tests |
| Manual EFT checkout | Isolated synthetic vendor/menu → mobile cart → explicit legal review → idempotent order → vendor banking snapshot/reference → pending. PayShap only when verified receiving capability exists |
| Banking | Only independently approved current profile can issue instructions; self-approval, stale/revoked versions and cross-vendor access denied; no real bank destination changed |
| Payment report/confirmation | Reporting remains unpaid; independent verification requires synthetic receipt/reference/amount; duplicate/concurrent receipt and cancellation/refund behavior tested offline/isolated. No real transfer or production paid-state mutation |
| Legal acceptance | Approved exact versions/hashes; unchecked-to-checked consent; guest/member/vendor evidence stored atomically; stale versions and missing documents fail closed; no draft acceptance fabricated |
| Historical integrity | Exact snapshot comparisons for all pre-existing data and historical settlement paths; no schema-default false positives |
| Storage | Private byte upload/read/expiry controls; MIME/size checks; immutable client evidence; cross-account and unauthenticated access denied; existing buckets unaffected |
| Notifications/history | Only intended isolated test recipients; no real email/push/webhook/provider routing; correct customer/vendor history and Realtime isolation |

Keep all gateway initiation, legal/publication/assent rollout and new-workflow flags
closed during structural postflight. Positive checkout requires a separately
approved isolated UAT activation with synthetic records; do not activate production
to smoke-test it. A production frontend candidate/deployment, publication, real
vendor approval and payment activation each remain outside this preparation.

## 5. Evidence needed before release can proceed

- [ ] Named backup operator, recovery operator and release executor; owner-approved window/data handling.
- [ ] Current production encrypted export, coverage manifest, independent decryption and successful isolated restore with measured RPO/RTO acceptance.
- [ ] Separate actual Storage bytes and Auth/config/secret-manager/Vault/Edge/provider recovery evidence.
- [ ] Written Storage executor decision; exact unchanged P4 supported by provider, or separately reviewed/rehearsed replacement and new hashes/history manifest.
- [ ] Complete schema/owner/role/grant/policy/trigger/function comparison; exact final package tested in a matching managed environment.
- [ ] Positive and negative customer/vendor/admin, EFT, legal, banking, Storage, notification and historical-order UAT evidence, with live channels isolated.
- [ ] Exact final preflight and data-preservation proof; no unexpected flags enabled, suspensions lifted or banking approvals bypassed.
- [ ] Legal/company disclosures, actual approved documents, vendor assent, independent banking/compliance and accounting/operations approvals.
- [ ] Separate explicit authorization for production migration execution and later frontend/activation steps. None is granted by this checklist.

## Primary sources

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups): plan capabilities, logical exports and Storage-byte exclusion.
- [Backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore): supported connection/restore process and additional encryption-key considerations.
- [Restore to new project](https://supabase.com/docs/guides/platform/clone-project): paid-plan database-only clone and external-service limitations.
- [Supautils policy delegation](https://github.com/supabase/supautils#manage-policies) and [provider configuration](https://github.com/supabase/postgres/blob/d8666db883fd1bc3bc06654c8db1f8dc39812b82/ansible/files/postgresql_config/supautils.conf.j2): documented postgres policy-management mechanism; effective production settings were independently read.
- [Storage schema guidance](https://supabase.com/docs/guides/storage/schema/design) and [access control](https://supabase.com/docs/guides/storage/security/access-control): API-managed metadata and RLS policies.
