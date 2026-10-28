# EFT recovery execution gate — 28 October 2026

Preparation only. No production migration, bucket, banking, credential, order,
deployment or feature-control mutation has been authorized or performed in this phase.

## Verified implementation

The reviewed P1–P3 package contains the complete manual EFT and legal functions;
there is no missing-function stub to implement. The four original migration files
remain byte-identical to `production-migration-manifest.json`.

The native PG17.10 rehearsal reconstructs the production schema/ACL baseline using
synthetic data, installs P1–P3 in order, proves ordinary postgres is rejected by
original P4, and installs P4 using a local fixture owner. It exercises guest/member
orders, consent/version evidence, independent banking approval, exact destination,
reference and amount, receipt-based confirmation, unpaid customer reports,
underpayment, expiry, cancellation, duplicate/concurrent receipts, immutable fees,
refunds, cross-vendor denial, suspension, and retained-order preservation.
This is not an actual production restore or a managed Auth/Storage/PostgREST test.

The candidate frontend excludes delivery-origin RPC callers. Deploying the current
live frontend again would retain that incompatible dependency. Use the reviewed
release candidate after backend compatibility and hosted UAT pass; do not add a
dummy `get_vendor_delivery_origin` or install the larger delivery stack blindly.

## Storage executor correction

Production read-only inspection confirms `session_preload_libraries=supautils`
(superuser context, configuration-file source) and `supautils.policy_grants`
(sighup context, configuration-file source) delegates `storage.objects` policy
management to postgres. Neither table ownership nor managed-role membership changes
are needed. Original P4 rejects this supported path through its own stricter guard.

Preserve original P4. The separately generated review alternative is
`release/storage-alternative/20261028073200_production_compliance_delegated_policies.sql`.
It requires provider-installed delegation, unchanged managed ownership/RLS,
recorded P1–P3, a correctly configured empty bucket, and closed release controls.
All six policy definitions are identical to P4. It contains no Storage metadata
DML or role/ownership/grant changes. Vanilla PostgreSQL must reject this guard;
the local fixture does not impersonate a provider extension to manufacture a PASS.

After recovery and isolated managed rehearsal, the proposed sequence is:

1. Refresh preflight, backup evidence and package hashes; obtain explicit production
   execution approval for the exact replacement manifest.
2. Apply P1 `20261027093453_production_launch_browser_grants.sql` as postgres;
   verify commit and recorded history 39.
3. Apply P2 `20261027112327_production_minimum_manual_legal_foundation.sql`;
   verify commit/history 40 and closed controls.
4. Apply P3 `20261027112437_production_checked_settings.sql`;
   verify commit/history 41, no original order/restriction drift.
5. Owner creates `vendor-compliance` using Storage dashboard/API: private,
   limit 5242880 bytes, MIME types application/pdf, image/jpeg, image/png.
   API equivalent: `storage.createBucket('vendor-compliance', {public:false,
   fileSizeLimit:5242880, allowedMimeTypes:['application/pdf','image/jpeg','image/png']})`.
   Inspect existing bucket first; never overwrite an unexpected bucket. Keep it
   empty and all workflows closed. This step is not authorized now.
6. Apply the alternative policy-only migration as postgres using provider
   delegation. Record version 20261028073200 only after verified success. History
   becomes 42/latest 20261028073200. Never execute original P4 as well. If the
   provider denies delegation, stop and obtain Supabase support; do not weaken checks.
7. Run postflight using the alternative history query below and the remaining
   `checks/production-recovery-postflight.sql` checks. Compare exact definitions,
   not only policy counts. Reconcile uncertain commits before any retry.

```sql
SELECT count(*)=42 AND max(version)='20261028073200' history_matches
FROM supabase_migrations.schema_migrations;
SELECT version,name FROM supabase_migrations.schema_migrations
WHERE version IN ('20261027093453','20261027112327','20261027112437',
                 '20261027115843','20261028073200') ORDER BY version;
```

Run `node checks/production-storage-package.mjs --write-manifest` for the exact
review-only replacement hashes. The original manifest remains unchanged.

## Production recovery work still requiring operator access

Connected SQL inspection is read-only evidence, not a downloadable backup.
The organization is Free; no connected backup export/create tool is available.
Only staging libpq files are present. Never retarget those credentials.
Current Windows runtime can rehearse schema tests but lacks dump/restore clients,
Docker and age; it is not a verified production recovery machine.

Backup operator is Siphamandla Khumalo, confirmed in this session. The secure
interactive setup and export/restore commands are in
`docs/PRODUCTION-BACKUP-OPERATOR-20261028.md`. Production files do not yet exist.

Required owner/operator inputs: approved production libpq service, password and
CA file paths (not secrets in chat), an encrypted destination outside every Git
worktree, named backup/restore operators, escrow/decryption recipient, reviewed
PG17 client binaries and a matching pinned Supabase image with Docker on an
isolated recovery host. No project upgrade or cloud resource purchase is assumed.

The operator must produce the following privately, with only redacted results
committed. Existing staging scripts are useful references, not production executors:

1. Verify project identity from control plane and direct/session-pooler connection;
   use TLS verify-full and the postgres user. Do not use transaction pooling.
   Freeze schema/role changes during capture. Set default_transaction_read_only=on,
   lock_timeout=5s and bounded statement timeout; require source session READ ONLY.
2. Hold a REPEATABLE READ READ ONLY transaction, export its snapshot, and capture
   all table hashes/counts, catalog, ACLs, policies, functions and sequences using
   `checks/staging-backup-catalog.sql` and `checks/production-backup-data.sql` (these
   SQL captures are schema inventories, not staging connection credentials).
   Use `pg_dump --format=custom --snapshot=SNAPSHOT --lock-wait-timeout=5s`
   with the approved production service. Export roles with `pg_dumpall --roles-only
   --no-role-passwords`. No silent exclusions or ignored permission errors.
3. Verify archive TOC, SHA-256 hashes and independent catalog/sequence stability;
   record transaction start, export completion and failed/skipped objects (must
   be zero). Encrypt archive, roles, private inventory and logs outside Git;
   independently decrypt/download and recheck hashes. Hashing alone proves no
   restore or origin. Stop if encrypted auth/Vault data cannot be recovered.
4. Restore into a fresh matching PG17/Supabase disposable instance with **network
   none before restore**, source credentials absent, no mounted source files,
   no application workers or outgoing SMTP/webhooks/jobs. Restore roles, owners,
   ACLs and full archive with exit-on-error/single transaction. Compare every
   captured table/hash/sequence and exact catalog, restart, repeat checks, measure
   restore duration and have owner accept RPO/RTO. Never restore over production
   or the shared staging project.
5. Separately recover actual Storage bytes (currently 60 objects/5 buckets),
   config, Auth/SMTP/OAuth, Edge secrets/deployments and required encryption keys.
   Database Storage metadata does not recover object bytes. Document exclusions
   and operator ownership; do not label DB-only restore as full service recovery.
6. Use a separately approved isolated managed project for real PostgREST, Auth,
   Storage API and supautils validation; isolate outbound channels before loading
   any copied data. Native SQL fixtures cannot establish that evidence.

## Final release checklist and rollback boundaries

- [ ] Named operators and private encrypted archive/coverage evidence, independent
  decryption, successful isolated restore/restart, accepted RPO/RTO.
- [ ] Managed rehearsal of the exact P1/P2/P3 + API bucket + alternative package,
  including legacy permissive Storage policies and cross-account/anonymous tests.
- [ ] Dedicated confirmed customer and normal-process approved vendor UAT accounts;
  working admin unchanged. Hosted login, DB role, reload/refresh and order isolation.
- [ ] Guest/member mobile checkout, approved vendor bank snapshot/ref/amount,
  pending state, owner receipt verification and admin oversight; expiry, cancellation,
  mismatch, suspicious and duplicate scenarios remain unpaid or under review.
- [ ] Approved legal versions/company disclosures and stored affirmative acceptance;
  independent banking/compliance evidence. No test drafts published in production.
- [ ] Customer/vendor history, notification recipient isolation and intended Realtime
  recipients verified in managed UAT. No live email, transfer or payment simulation.
- [ ] Fresh baseline proves all 32 originally observed orders/items/suborders and
  restrictions preserved; account for legitimate intervening activity, never delete it.
- [ ] Separate explicit migration approval, then separate reviewed frontend deployment
  and controlled activation approval. Branch auto-deployment remains disabled.

Failed uncommitted migration: rollback transaction. Successful committed migration:
retain added data/evidence, stop before next file and prefer reviewed forward repair.
Do not replay non-idempotent files, drop foundations, restore over later orders or
mark unpaid orders paid. A new private bucket may remain empty with controls closed;
do not delete evidence as rollback. Use only a rehearsed backend-compatible frontend
rollback target. Original broken live deployment is not a validated fallback.

Sources: [Supautils policy management](https://github.com/supabase/supautils#manage-policies),
[Storage API bucket creation](https://supabase.com/docs/reference/javascript/storage-createbucket),
[Storage schema](https://supabase.com/docs/guides/storage/schema/design),
[Supabase backups](https://supabase.com/docs/guides/platform/backups).
