# Production backup operator procedure

Operator: Siphamandla Khumalo (owner authorization in this session).
Project: **gfzhdkitdyqftealgqfi**. No production migrations, business-data writes,
credential resets, bucket creation or payment activation are part of this procedure.

## 1. Obtain actual connection details and create private files

Open [production](https://supabase.com/dashboard/project/gfzhdkitdyqftealgqfi), verify
project reference, then **Connect → Session pooler**. Copy the host/user exactly.
Use port **5432**, database **postgres**. Do not use Transaction pooler/6543.
The project API confirms the direct host `db.gfzhdkitdyqftealgqfi.supabase.co`,
PG17/server release 17.6.1.147. DNS currently returns IPv6 only; this machine's TCP
probe failed. The session-pooler host has not been supplied or tested. It cannot be
inferred from region. Session connectivity will be verified once the actual host
is entered. No IPv4 add-on purchase is required for session pooling.

Download the project's root CA from **Database settings → SSL Configuration →
Download Certificate**. Use the database password you already hold, not your
dashboard, customer or vendor login. If you do not have it, stop; do not reset it
as part of this setup because other production integrations may depend on it.

In a normal local PowerShell window, run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -File 'C:\Users\Siphamandla.Khumalo\Documents\officebites\.officebites-local\worktrees\vendor-eft-legal-launch\checks\operator\Initialize-ProductionLibpq.ps1'
```

The script prompts for real host/user/CA and a masked SecureString password.
It never puts the password in an argument, URI, environment variable, console
output or command history. Do not paste credentials into VS Code, chat or shell
commands. It creates a fresh directory under `%LOCALAPPDATA%\OfficeBitesRecovery`,
with inheritance disabled and access limited to your Windows SID and SYSTEM.
Staging files are neither read nor copied. No database connection is attempted.

The resulting `.pgpass` contains a plaintext libpq password protected by the file
ACL; it is not encrypted at rest by libpq. The password briefly exists in process
memory; managed strings cannot be guaranteed erased. Use your approved encrypted
disk and retain the temporary file only for the backup window. Never include it
in the backup bundle. The script escapes `:` and `\` per libpq, rejects multiline
passwords and writes UTF-8 without BOM. Only the resulting **paths** should be
shared. Do not display `Get-Content` of the password file.

The command sets RemoteSigned only for this new PowerShell process, because this
machine currently disallows `.ps1` execution by default. It does not change system
policy. If organizational policy blocks the script, stop and use your approved
administrator process; do not override Group Policy. The synthetic test script
checks real current-user/SYSTEM ACL creation without creating credentials.

## 2. Tool and read-only connection gate

PostgreSQL17 client utilities (`psql`, `pg_dump`, `pg_dumpall`, `pg_restore`), age,
tar and Docker are not currently available on PATH. The embedded local test server
does not include dump/restore clients. Use approved official binaries or an approved
isolated recovery host; do not run an unverified installer or substitute JSON exports.
Download sources: [PostgreSQL Windows](https://www.postgresql.org/download/windows/),
[age releases](https://github.com/FiloSottile/age/releases),
[Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/).
Installations/reboots and the exact Supabase restore-image digest remain operator
prerequisites. Client major must match17. Pin a matching Supabase PG17 image by
digest, including required extensions/config; local PG17.10 is only synthetic UAT.

After tools are available, start a fresh PowerShell window. Paths entered below
are local paths from the setup output, never secrets. Do not print existing PG env
values. Set these again in **each** export terminal:

```powershell
Get-ChildItem Env:PG* | ForEach-Object { Remove-Item -LiteralPath ('Env:' + $_.Name) }
$env:PGSERVICEFILE = Read-Host 'Full production service-file path from setup'
$env:PGPASSFILE = Read-Host 'Full production password-file path from setup'
$env:PGSERVICE = 'officebites_production'
$env:PGOPTIONS = '-c default_transaction_read_only=on -c lock_timeout=5s -c statement_timeout=60000'
psql --version
pg_dump --version
pg_dumpall --version
pg_restore --version
psql -X -w --dbname=service=officebites_production -v ON_ERROR_STOP=1 -c "SELECT current_user,current_database(),current_setting('server_version_num'),current_setting('transaction_read_only'),(SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid());"
if ($LASTEXITCODE -ne 0) { throw 'Connection gate failed; do not weaken TLS or retry with guessed details.' }
```

Require postgres/postgres, version17, read-only **on**, SSL **true**. Verify host/user
against the selected production dashboard. TLS verification failure is a STOP,
never a reason to change verify-full to require/disable. Wrong-password or access
errors are not permission to reset passwords or elevate production roles.

## 3. Consistent archive and private evidence

Freeze schema/role changes during this bounded capture; existing order traffic may
continue. Aim for an export within five minutes; abort/restart capture if the source
snapshot disconnects, times out or is held beyond the approved window. Do not keep
an idle snapshot open while installing tools. Obtain/escrow the encryption public
recipient **before** exporting. Keep the decryption identity in a separately
restricted location, never in the archive bundle. age public recipient is not secret.

Create a new `bundle-...` directory **inside the private directory created by setup**
(it inherits its private ACL). Keep the CA/pass/service files in their parent, not
in the bundle. In terminal A:

```powershell
$connectionDir = Split-Path -Parent $env:PGPASSFILE
$backupDir = Join-Path $connectionDir ('bundle-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupDir -ErrorAction Stop | Out-Null
$releaseDir = 'C:\Users\Siphamandla.Khumalo\Documents\officebites\.officebites-local\worktrees\vendor-eft-legal-launch'
Copy-Item -LiteralPath (Join-Path $releaseDir 'checks\staging-backup-catalog.sql') -Destination (Join-Path $backupDir 'source-catalog.sql')
Copy-Item -LiteralPath (Join-Path $releaseDir 'checks\production-backup-data.sql') -Destination (Join-Path $backupDir 'source-data.sql')
Set-Location -LiteralPath $backupDir
psql -X -w -A -t -q --dbname=service=officebites_production -v ON_ERROR_STOP=1
```

Paste these commands **into psql**, keeping the session open after the last SELECT:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
\o source-identity.jsonl
SELECT jsonb_build_object('snapshot',pg_export_snapshot(),'transactionUtc',transaction_timestamp(),'observedUtc',clock_timestamp(),'user',current_user,'database',current_database(),'serverVersion',version(),'readOnly',current_setting('transaction_read_only'));
\o source-catalog.jsonl
\i source-catalog.sql
\o source-data.jsonl
\i source-data.sql
\o
SELECT pg_export_snapshot();
```

Record the snapshot identifier locally (not secret). The data script hashes every
non-system table and sequence, including managed schemas; it prints no row records.
Catalog JSON covers the required public/private/auth/storage/history objects and
all roles/extensions. Inventory additional schemas/extension configuration and
external encryption keys explicitly; these five application schemas alone are not
proof of full-cluster recovery. Permission errors are a STOP, not omitted tables.

In terminal B, set the same connection env as above, then:

```powershell
$backupDir = Read-Host 'Full private bundle directory created in terminal A'
$snapshotId = Read-Host 'Snapshot identifier from still-open terminal A'
if ($snapshotId -notmatch '^[A-Fa-f0-9-]+$') { throw 'Invalid snapshot identifier.' }
pg_dumpall -w --dbname=service=officebites_production --database=postgres --roles-only --no-role-passwords --file="$backupDir\roles.sql" 2> "$backupDir\roles-private.log"
if ($LASTEXITCODE -ne 0) { throw 'Role export failed; inspect private log.' }
pg_dump -w --dbname=service=officebites_production --format=custom --snapshot=$snapshotId --lock-wait-timeout=5s --file="$backupDir\database.dump" 2> "$backupDir\dump-private.log"
if ($LASTEXITCODE -ne 0) { throw 'Full export failed; no exclusions or ignored errors allowed.' }
pg_restore --list --file="$backupDir\archive.toc" "$backupDir\database.dump"
if ($LASTEXITCODE -ne 0) { throw 'Archive TOC invalid.' }
```

No `--no-owner`, `--no-acl`, schema exclusions or `--enable-row-security` on the
dump. Preserve managed roles, custom policies, triggers, history, Auth data and
application data. The postgres account may encounter managed-schema/role limits;
record the exact private failure and obtain a supported export path. Never strip
failing objects or grant broader production roles to make the backup pass.
`--no-role-passwords` intentionally excludes database-role password verifiers;
recover those separately from operator secrets, not from this archive. Auth password
hashes in `auth.users` remain sensitive archive contents.

Compare a second read-only catalog and sequence capture for schema/role/sequence
drift while schema/role changes remain frozen. If a sequence changes under live
writes, quiesce the affected allocation path through an approved operational window
and recapture; a PostgreSQL snapshot does not make sequences transactional.
Return to terminal A only after export and drift checks succeed: `ROLLBACK;` then
`\q`. Record capture completion, duration, client/server versions and zero errors.

## 4. Hash, encrypt, decrypt and restore verification

From terminal B (Node24 is already available locally), the production-specific
helper requires files outside Git, checks normal non-linked files and refuses a
staging manifest. Hashes establish integrity, not origin, encryption or a restore.

```powershell
$releaseDir = 'C:\Users\Siphamandla.Khumalo\Documents\officebites\.officebites-local\worktrees\vendor-eft-legal-launch'
& 'C:\Users\Siphamandla.Khumalo\AppData\Local\Temp\officebites-legal-node\node-v24.22.0-win-x64\node.exe' (Join-Path $releaseDir 'checks\production-backup-integrity.mjs') create $backupDir
if ($LASTEXITCODE -ne 0) { throw 'Integrity manifest creation failed.' }
$ageRecipient = Read-Host 'Escrowed age public recipient'
if ($ageRecipient -notmatch '^age1[a-z0-9]{58}$') { throw 'Expected age public recipient.' }
$bundleParent = Split-Path -Parent $backupDir
$tarFile = Join-Path $bundleParent ((Split-Path -Leaf $backupDir) + '.tar')
$cipherFile = $tarFile + '.age'
if ((Test-Path -LiteralPath $tarFile) -or (Test-Path -LiteralPath $cipherFile)) { throw 'Do not overwrite a backup.' }
tar -cf $tarFile -C $backupDir .
if ($LASTEXITCODE -ne 0) { throw 'Bundle creation failed.' }
age --recipient $ageRecipient --output $cipherFile $tarFile
if ($LASTEXITCODE -ne 0) { throw 'Encryption failed; private plaintext remains for recovery.' }
(Get-FileHash -LiteralPath $cipherFile -Algorithm SHA256).Hash | Set-Content -LiteralPath ($cipherFile + '.sha256') -Encoding ascii
```

Transfer only ciphertext+hash to approved private recovery storage. On an independent
restricted recovery machine, download, check ciphertext hash, decrypt using the
escrowed identity, extract into a fresh private directory and run `verify` instead
of `create` with the production helper. Compare original/independent manifest hashes.
Never attach the archive, key, process logs or database data to Git/chat.

Restore target: fresh matching Supabase PG17 disposable container, pinned image
digest, `--network none` **before any restore**, source credentials absent, no
production mounts or application workers. Use a new cluster/bootstrap role, restore
roles first and create a new database from template0. Restore the entire custom
archive with `pg_restore --single-transaction --exit-on-error --no-tablespaces`;
preserve owners/ACLs. Run the saved catalog/data capture scripts READ ONLY against
the restored copy, then compare both JSONL captures using the helper's `compare`
command. Restart the disposable server and repeat. Measure RTO; owner accepts RPO.
Any extension/managed-owner/membership/config failure blocks recovery; do not delete
failed statements or restore with ignored errors. Matching vanilla PG is insufficient
if managed extensions/configuration are required. Existing staging restore scripts
are references only; their postflight assumes the staging backend and is incompatible
with this pre-migration production baseline.

Prepared production-only restore executor:
`checks/operator/restore-production-isolated.sh`. It requires a fresh Docker
container with loopback as its only interface, PG17, no `/restore` directory,
an explicit production marker, and a disposable database name. It restarts the
restored server and runs the production-baseline access checks. It has not been
executed because Docker/image/export are not available; a syntax check alone is
not restore evidence. After independent decryption and hash verification, use an
approved Linux-container recovery host and these PowerShell commands. `$backupDir`
must point to the independently decrypted, verified bundle, not production files:

```powershell
$restoreImage = Read-Host 'Approved matching Supabase PG17 image pinned by SHA256 digest'
if ($restoreImage -notmatch '^(public\.ecr\.aws/supabase/postgres|supabase/postgres)@sha256:[a-f0-9]{64}$') { throw 'Pinned approved image required.' }
$restoreId = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
$containerName = 'officebites-production-restore-' + $restoreId
$restoreDb = 'officebites_production_restore_disposable_' + $restoreId
docker pull $restoreImage
if ($LASTEXITCODE -ne 0) { throw 'Image pull failed.' }
docker run --detach --name $containerName --user 0:0 --network none --pids-limit 512 --entrypoint /bin/bash $restoreImage -c 'sleep infinity'
if ($LASTEXITCODE -ne 0) { throw 'Offline container creation failed.' }
docker exec $containerName mkdir -p /input /verification
if ($LASTEXITCODE -ne 0) { throw 'Container setup failed.' }
foreach ($file in @('roles.sql','database.dump')) {
    docker cp (Join-Path $backupDir $file) "${containerName}:/input/$file"
    if ($LASTEXITCODE -ne 0) { throw 'Private archive copy failed.' }
}
foreach ($file in @('source-catalog.sql','source-data.sql')) {
    docker cp (Join-Path $backupDir $file) "${containerName}:/verification/$file"
    if ($LASTEXITCODE -ne 0) { throw 'Verification script copy failed.' }
}
foreach ($file in @('restore-production-isolated.sh','production-restored-permissions.sql')) {
    docker cp (Join-Path $releaseDir "checks\operator\$file") "${containerName}:/verification/$file"
    if ($LASTEXITCODE -ne 0) { throw 'Reviewed executor copy failed.' }
}
docker exec $containerName bash -c 'printf "%s\n" gfzhdkitdyqftealgqfi > /verification/production-isolated.marker'
if ($LASTEXITCODE -ne 0) { throw 'Scope marker creation failed.' }
docker exec $containerName bash /verification/restore-production-isolated.sh $restoreDb
if ($LASTEXITCODE -ne 0) { throw 'Restore failed. Retain private container/logs; do not ignore errors.' }
foreach ($file in @('restored-catalog.jsonl','restored-data.jsonl','restore-duration-ms.txt','permissions.log','restart.log')) {
    docker cp "${containerName}:/restore/$file" (Join-Path $backupDir $file)
    if ($LASTEXITCODE -ne 0) { throw 'Restore evidence copy failed.' }
}
$nodeExe = 'C:\Users\Siphamandla.Khumalo\AppData\Local\Temp\officebites-legal-node\node-v24.22.0-win-x64\node.exe'
$integrityHelper = Join-Path $releaseDir 'checks\production-backup-integrity.mjs'
& $nodeExe $integrityHelper compare (Join-Path $backupDir 'source-catalog.jsonl') (Join-Path $backupDir 'restored-catalog.jsonl')
if ($LASTEXITCODE -ne 0) { throw 'Restored catalog differs.' }
& $nodeExe $integrityHelper compare (Join-Path $backupDir 'source-data.jsonl') (Join-Path $backupDir 'restored-data.jsonl')
if ($LASTEXITCODE -ne 0) { throw 'Restored data differs.' }
```

Do not add source credentials/env files, host networking, production mounts or
application services to that container. Do not reuse it for hosted UAT. Preserve
private failure logs for diagnosis; clean up only the positively identified
disposable container after evidence review, never production. This restore executor
assumes the currently verified 38-migration baseline; legitimate drift requires
reviewed checks and a new snapshot, not a forced pass.

Separately prove Storage object-byte recovery (currently5buckets/60objects),
Vault/column encryption keys, Auth/SMTP/OAuth and project/Edge/provider settings.
DB metadata does not restore files or external services. Do not launch Auth/cron/
SMTP/webhooks against restored production data until outbound isolation is verified.

Keep credentials/plaintext in restricted encrypted storage only for the approved
window. After independent decrypt+restore PASS and retention approval, securely
remove the exact temporary plaintext/pass files through native PowerShell using
verified absolute paths; no recursive cleanup or source deletion is part of these
commands. Ordinary file deletion is not guaranteed secure erasure on SSDs.

## Evidence to return (no secrets)

- Service/password/CA paths; actual session host and TCP/TLS/read-only result.
- Private archive location and SHA-256; snapshot/time/version/coverage and zero-error
  export result; operator identity and schema/role/sequence drift result.
- Independent decryption verification, isolated restore/restart/hash/catalog result,
  measured RTO and owner-accepted RPO; complete list of external-state exclusions.
- Managed Storage delegation rehearsal and exact approved migration manifest.

Only after these gates pass should production migration approval be requested.

Sources: [Supabase connection methods and SSL](https://supabase.com/docs/guides/database/connecting-to-postgres),
[Supabase backup/restore considerations](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[libpq password files](https://www.postgresql.org/docs/17/libpq-pgpass.html),
[pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html).
