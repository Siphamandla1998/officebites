# Operator-controlled staging backup and restore — 27 October 2026

Target **eyhmarmekioovcjibcbr only**. The owner confirms Supabase Free: scheduled
managed backups/PITR are unavailable. Replace that prerequisite with a verified
operator export, private recovery copy and successful disposable restore; an upgrade
is not assumed or authorized. **Recovery gate remains NO-GO until these exist.**
This replaces the managed-backup/PITR option in the earlier final gate. Its API,
notification-isolation and maintenance requirements remain unchanged.

## Evidence and blockers

| Requirement | Result | Owner / exact next action |
|---|---|---|
| Supported export/recovery procedure | **PASS — prepared** | DBA: use the commands below, not an EFT installer or blanket db push. |
| Secure staging connection available | **UNKNOWN / blocked** | DBA: provide paths to approved libpq service/password/CA files privately. No PG environment credentials or default PostgreSQL credential directory were found; do not paste credentials in chat. Connector query access cannot be converted into pg_dump credentials. |
| Required binaries available | **FAIL** | Operator: install approved PostgreSQL 17 clients with pg_dump, pg_dumpall, pg_restore and psql. They are absent from PATH and the existing embedded runtime. Docker/Supabase CLI are also absent; do not claim a client was installed. |
| Private, encrypted backup destination and escrow | **UNKNOWN** | Security/operator: establish protected storage outside all Git worktrees and cloud-sync folders; verify ACL/encryption and an independently recoverable private copy. No actual backup directory/data was created here. |
| Artifact integrity tooling | **PASS — synthetic only** | Nine tests pass for hashes, tampering, path restrictions and evidence comparison. This is not integrity evidence for a staging export. |
| Real export / file integrity | **UNKNOWN / blocked** | DBA: complete roles + snapshot-based archive and fingerprints, validate TOC and SHA-256 manifest, record exit codes; no real export has run. |
| Real restore / data, functions and permissions | **UNKNOWN / blocked** | DBA: supply an isolated compatible PG17 runtime with reviewed role/extension bootstrap, restore and run comparisons/negative tests. No staging dump was restored. |
| Exact restore duration | **UNKNOWN** | Record measured milliseconds below after the real drill. No duration is fabricated or borrowed from the earlier synthetic cold-copy test. |
| Separate Storage/Auth/Edge/environment recovery | **UNKNOWN** | Service owners: supply independent byte/config/secret-manager inventories and tested recovery references. SQL metadata is insufficient. |
| RPO/RTO / maintenance acceptance | **UNKNOWN** | Release owner: review proposed targets after timing, accept a specific window/targets; all acceptance fields remain false/null. |

## 1. Credentials, destination and tools

Use official PostgreSQL 17 client binaries from a trusted signed/checksummed
distribution. Verify provenance/version and `--help` for each executable. Match the
source PG17 major; the destination additionally needs the actual extensions/Auth/
Storage schema compatibility. Missing extensions/permissions are a stop, not a
reason to suppress errors or drop objects. The embedded runtime has initdb/pg_ctl/
postgres only and is not a complete backup client installation.

Use the staging Dashboard **Connect** panel to obtain the correct direct or
**session** pooler endpoint. Never use the transaction pooler. Use a verified TLS
connection with sslmode=verify-full and an approved CA file. Direct endpoint must
be `db.eyhmarmekioovcjibcbr.supabase.co` with postgres user. If IPv6 is unavailable,
the session-pooler host must be independently verified in Connect and username must
be `postgres.eyhmarmekioovcjibcbr`, port 5432. No guessed pooler region/hostname.

Create an operator-only libpq service `officebites_staging_backup`, outside Git,
containing host/port/dbname/user/sslmode/sslrootcert. Store its password in a separate
private pgpass file with a specific host/port/database/user entry (no wildcard).
Set PGSERVICEFILE and PGPASSFILE **in that operator process only**, by paths; never
put a password in a connection URI, CLI argument, script, terminal history or report.
Do not reset hosted passwords to obtain access. No plaintext password is needed
in this repository. Use an existing approved secret-manager workflow to create
those private files. Windows libpq assumes the directory is secure; it does not
perform Unix-style pgpass permission enforcement.

Use a new timestamped directory such as
`%LOCALAPPDATA%\OfficeBites\StagingBackups\20261027T...Z`, outside this repository,
the separate legal worktree and OneDrive/Dropbox. Before creating any sensitive
file, disable inherited ACLs and permit only the current operator and SYSTEM.
Example ACL setup in an operator PowerShell session (paths contain no secrets):

```powershell
# Set $privateBackup to a NEW absolute private directory, never an existing backup.
if (Test-Path -LiteralPath $privateBackup) { throw 'Refuse backup-directory reuse' }
$null = New-Item -ItemType Directory -Path $privateBackup
$operatorSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$backupAcl = [Security.AccessControl.DirectorySecurity]::new()
$backupAcl.SetAccessRuleProtection($true, $false)
$backupAcl.SetOwner($operatorSid)
foreach ($backupSid in @($operatorSid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
  $backupRule = [Security.AccessControl.FileSystemAccessRule]::new(
    $backupSid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
  $backupAcl.AddAccessRule($backupRule)
}
Set-Acl -LiteralPath $privateBackup -AclObject $backupAcl
# Inspect the resulting ACL privately; STOP if additional principals can read it.
```

Also verify at-rest encryption of the actual destination (BitLocker/EFS or an
approved encrypted container) and recovery-key access. Do not infer encryption
from a folder name or ACL. Maintain an encrypted independently recoverable copy;
if using EFS/DPAPI, escrow the recovery keys/profile/certificate separately before
relying on a copy from another computer. No automatic retention/deletion script is
provided. Proposed retention: 7 daily successful generations plus the pre-change
generation until release review; owner must accept storage access and retention.

In the dedicated export shell, clear unrelated PGHOST/PGHOSTADDR/PGDATABASE/PGUSER/
PGPORT/PGSERVICE/PGPASSWORD/PGOPTIONS values, then set only the approved service and
password file paths. Set PGOPTIONS to
`-c default_transaction_read_only=on -c lock_timeout=5s -c statement_timeout=300000`.
The service file must not override options with a writable setting. Verify identity,
TLS and the retained 54-history/13-function preimage before export. Do not change
source RLS, role memberships, grants or service settings to make export succeed.
Stop on permissions/timeout/TLS or project mismatch. `--no-password` prevents prompts.

## 2. Consistent read-only export, including verification evidence

Do not use SQL query results as a substitute for pg_dump. Use one custom archive
for required schema + data, not independently timed schema and data exports.
Roles are global and pg_dump does not include them; collect separately without
role passwords. Agree no concurrent DDL/role changes for the export interval; if
that cannot be attested, global-role consistency remains UNKNOWN even if the data
archive succeeds. Long-lived snapshots can consume server resources; bound this
manual operation to five minutes, roll back the snapshot session on any failure.

Open **Session A**, with no psql startup file or terminal transcript:

```powershell
& $psql --no-psqlrc --no-password --tuples-only --no-align --quiet `
  --set ON_ERROR_STOP=1 --dbname 'service=officebites_staging_backup'
```

Inside that source psql session:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_user,current_database(),current_setting('server_version'),current_setting('transaction_read_only');
SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid();
SELECT pg_export_snapshot();
```

Keep Session A open. Save the snapshot identifier privately as `$snapshotId` in
Session B. It is not a password, but do not include it in public reports. In A,
use psql `\o` to direct output to the private directory's source-catalog.jsonl;
then `\i` the absolute path of `checks/staging-backup-catalog.sql`. Change `\o` to
source-data.jsonl and `\i` `checks/staging-backup-data.sql`, then `\o` with no argument.
Use quoted absolute psql file paths with forward slashes. These scripts issue
SELECT only; `\gexec` runs generated quoted SELECTs, never DDL or data writes.
They capture table/sequence counts/digests, migration-row digests, functions,
owners, RLS, ACLs, roles/memberships/default grants and extensions without printing
row contents. Keep these outputs private too. Stop on every permission error or
timeout; do not omit managed auth/storage tables silently.

In **Session B**, using the same private libpq files/options, first check tools'
versions, then:

```powershell
$exportClock = [Diagnostics.Stopwatch]::StartNew()
& $pgDumpAll --no-password --dbname 'service=officebites_staging_backup' `
  --database postgres --roles-only --no-role-passwords `
  --file "$privateBackup\roles.sql" 2> "$privateBackup\roles.stderr"
if ($LASTEXITCODE -ne 0) { throw 'Role export failed; review private log' }
& $pgDump --no-password --dbname 'service=officebites_staging_backup' `
  --format custom --snapshot $snapshotId --strict-names --lock-wait-timeout=5s `
  --schema=public --schema=private --schema=auth --schema=storage `
  --schema=supabase_migrations --schema=extensions `
  --file "$privateBackup\database.dump" 2> "$privateBackup\dump.stderr"
if ($LASTEXITCODE -ne 0) { throw 'Archive export failed; review private log' }
$exportClock.Stop()
& $pgRestore --list --file "$privateBackup\archive.toc" "$privateBackup\database.dump" `
  2> "$privateBackup\toc.stderr"
if ($LASTEXITCODE -ne 0) { throw 'Archive cannot be read' }
```

In A, finish with **ROLLBACK** and disconnect. This ends only a read-only source
transaction. Never leave the exported snapshot open while waiting for other work.
Retain warnings privately for review, even with exit code zero. Record exact tool
versions, source snapshot UTC, start/end UTC and `$exportClock.Elapsed.TotalMilliseconds`.
Source sequence increments are not MVCC-frozen: require no sequence activity for
exact sequence comparison or mark the discrepancy unresolved, never alter sequences.

Archive scope explicitly includes public/private application users/vendors/orders/
payments/agreements, auth database identities/sessions, Storage metadata, migration
ledger and extension definitions/data selected by pg_dump. Verify the private TOC
actually contains each required schema/table/sequence/function/ACL. Schema filters
do not automatically include external dependencies. Inventory other schemas,
custom tablespaces, large objects, extension data/encryption dependencies and
publication/event-trigger/database settings separately; expand the reviewed export
plan if required by the real dependency review. Do not label this a whole-cluster backup.
An encryption root key/TCE/Vault dependency, inaccessible table or missing extension
is a recovery blocker, not permission to use unavailable managed credentials.

`roles.sql` preserves role attributes/memberships that the exporter can read, but
not role passwords. Source role passwords and external signing/encryption secrets
remain in the approved secret manager. Managed reserved roles cannot be replayed
blindly into hosted Supabase. This process never restores anything to a hosted project.

Create/verify integrity manifest; commands print counts/status only:

```powershell
& $node checks/staging-backup-integrity.mjs create $privateBackup
if ($LASTEXITCODE -ne 0) { throw 'Manifest creation failed' }
& $node checks/staging-backup-integrity.mjs verify $privateBackup
if ($LASTEXITCODE -ne 0) { throw 'Integrity failure' }
```

The helper refuses backup locations inside the original officebites repository,
file links/traversal and overwrite of a manifest. SHA-256 is byte-integrity evidence,
not authentication or a restore test: protect a separate manifest hash/reference in
the operator's private evidence store and verify again after the encrypted copy.
Never put database.dump, roles.sql, TOC, logs, credential files or restored PGDATA
in Git, including an ignored repository directory. Do not attach them to reports.

## 3. Isolated restore drill — local writes only

Use a **new** native PG17/Supabase-compatible disposable cluster outside Git with
data_directory under the private recovery root, loopback-only **127.0.0.1:55443**,
bootstrap user **officebites_restore_bootstrap**, and SCRAM password in a private
local-only password file. Verify the actual socket, data_directory, server version,
fresh-cluster identity and absence of other application databases **before any write**.
Do not use the existing payment/repair clusters on ports 55432/55441/55442.

Isolate server/clients from outbound network with operator-verified firewall or an
offline runtime. Do not start Auth/Storage/Realtime/Edge workers or load scheduled
jobs, subscriptions or provider integrations. A localhost socket alone does not
prove server egress is blocked. Review dump SQL privately before execution:
pg_restore can execute arbitrary source-owner code. No SQL dump is run on staging.

Prepare a reviewed local role/extension bootstrap from roles.sql and the source
catalog. Managed role passwords are absent; bootstrap must preserve required role
names/ownership/inheritance/BYPASSRLS/grant semantics for this isolated drill. Avoid
the built-in postgres bootstrap name collision by using the dedicated bootstrap
identity at cluster initialisation. Review managed-role settings that reference
missing extensions. Do not ignore errors, remove failed tables, use --no-owner/
--no-acl, grant all clients access or weaken RLS to obtain a pass. If Supabase
extensions/managed schemas cannot be reproduced natively, obtain a compatible
isolated runtime and leave complete recovery UNKNOWN in the meantime.

Use a separate target service file/password file, service
`officebites_disposable_restore`, host 127.0.0.1, port 55443, dedicated bootstrap
user, database `officebites_restore_disposable_<timestamp>`. Remove source PGOPTIONS
and every source connection override in the restore shell. Disable service TLS
only for this verified loopback-only native target; never for the source.
Create the fresh database from template0 locally after the identity check.
The role/extension bootstrap is an explicitly reviewed local prerequisite, not an
EFT candidate migration. Verify its content/hash before executing it locally.

Time the **entire** procedure (runtime preparation, roles/extensions, archive restore,
verification), and separately the archive restore itself:

```powershell
# $targetConnection MUST be the verified local service, never a hosted URI.
$targetConnection = 'service=officebites_disposable_restore'
$restoreClock = [Diagnostics.Stopwatch]::StartNew()
& $pgRestore --no-password --dbname $targetConnection --single-transaction `
  --exit-on-error --no-tablespaces "$privateBackup\database.dump" `
  2> "$privateBackup\restore.stderr"
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; no successful recovery claim' }
$restoreClock.Stop()
```

No --create/--clean/--disable-triggers or migration installer is used. Target schema
must be empty with compatible dependencies; a pre-populated Supabase template may
conflict. Such conflicts require a reviewed compatibility plan, not ignored errors.
After restore, set PGOPTIONS to default_transaction_read_only=on in the target shell;
run the same catalog/data capture scripts into private restored-catalog.jsonl and
restored-data.jsonl using psql --no-psqlrc, ON_ERROR_STOP=1, tuples-only/no-align and
--output. Run each capture in a READ ONLY transaction. Compare:

```powershell
& $node checks/staging-backup-integrity.mjs compare `
  "$privateBackup\source-catalog.jsonl" "$privateBackup\restored-catalog.jsonl"
if ($LASTEXITCODE -ne 0) { throw 'Catalog/functions/roles/permissions differ' }
& $node checks/staging-backup-integrity.mjs compare `
  "$privateBackup\source-data.jsonl" "$privateBackup\restored-data.jsonl"
if ($LASTEXITCODE -ne 0) { throw 'Data/sequence/history recovery differs' }
& $psql --no-psqlrc --no-password --set ON_ERROR_STOP=1 --dbname $targetConnection `
  --file checks/staging-restored-permissions.sql `
  > "$privateBackup\permissions.stdout" 2> "$privateBackup\permissions.stderr"
if ($LASTEXITCODE -ne 0) { throw 'Permission/function regression failed' }
```

The permission script refuses a non-loopback/wrong-port/non-disposable database,
uses READ ONLY transactions, tests empty-identity admin denial, RLS order isolation,
real private-table permission denials and anonymous privileged-RPC restrictions.
It creates no orders, bank versions, acceptances or payment events. Catalog hashes
and row digests additionally verify functions/ownership/history/financial evidence.
Role/bootstrap/extension differences are STOP conditions requiring explanation;
do not edit the expected capture to match a bad restore. Stop the isolated cluster
after evidence capture; retain private data securely pending owner retention review.

## 4. External state and recovery targets

Database recovery does **not** recover these independently:

- **Storage bytes:** inventory bucket/object versions privately; separately export
  through an authorized Storage/S3 read path into encrypted private storage with
  per-object hashes and metadata/retention. Avoid issuing new signed links or
  printing object names. Restoration into Storage is a later approved write action.
  Database bucket/object rows alone cannot recover PDF/image bytes.
- **Auth service:** redacted provider/redirect/hook/delivery/JWT configuration plus
  approved secret-manager references. Auth table rows preserve identities, not
  external provider configuration, all encryption keys or token validity elsewhere.
  Restored staging must retain verified non-delivery controls; do not replay an
  absent hook as evidence of safe delivery.
- **Edge Functions:** securely preserve deployed source bundles/dependency versions
  and checksums separately from this branch; runtime secret values belong only in
  the secret manager. The existing six-bundle metadata inventory is not a complete
  redeployment backup. No function is invoked or redeployed during this task.
- **API/Realtime/Vercel/provider environment:** redacted effective configuration,
  origin/redirect/worker/callback schedules and secret references. Never copy
  production settings into a recovered staging runtime. Recovered DB flags remain
  closed; external bank/provider obligations need manual reconciliation.

**Proposed, not accepted:** RPO **24 hours** during active staging use, with at
least twice-daily completed/verified private copies and an immediate pre-change
snapshot; no post-snapshot staging writes may be discarded without owner review.
For installation, require a fresh pre-change recovery point and accepted
quiescence/reconciliation window. RTO **4 hours** for staging DB plus essential
external-state restoration/verification is a planning target only. Validate it
against the measured full drill; increase the target or improve tooling rather
than reporting an unmeasured guarantee. Manual exports provide snapshot recovery,
not PITR. Assign an operator and missed-backup alerts before accepting this RPO.

Record exact export/restore/verification/end-to-end milliseconds and hardware/
runtime/tool versions in `FREE-PLAN-RECOVERY-EVIDENCE-TEMPLATE-20261027.json`.
All actual timing and acceptance fields currently remain null/false. No real export
or logical restore has occurred: credentials, clients, private destination and
compatible isolated runtime are outstanding. The old synthetic cold-copy drill
does not satisfy this gate. Do not proceed to EFT installation based on this plan.

References: [Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[CLI dump exclusions](https://supabase.com/docs/reference/cli/supabase-db-dump),
[pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html),
[pg_dumpall globals](https://www.postgresql.org/docs/17/app-pg-dumpall.html),
[pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html),
[libpq service files](https://www.postgresql.org/docs/17/libpq-pgservice.html),
[private password files](https://www.postgresql.org/docs/17/libpq-pgpass.html).
The chosen raw pg_dump scope avoids assuming the CLI default includes auth/storage
or migration metadata; it requires explicit managed-dependency compatibility review.
