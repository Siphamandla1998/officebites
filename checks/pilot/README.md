# Local lunch-booking candidate

`booking-candidate.sql` is the **local foundation**, not a deployable migration. It
requires an isolated-test marker and exposes no public RPC by itself.
`atomic-collection-candidate.sql` extends it with the tested collection checkout,
configuration and protected-read contracts now used by the local UI. Both files
remain outside the auto-applied migration directory.
Do not copy it into hosted SQL Editor or bulk migrations.

Run the existing integrated local fixture:

```powershell
node checks/checkout-database.mjs
```

The runner applies existing checkout/payment migrations in disposable PGlite,
then calls `verifyPilotBookings` and `verifyAtomicCollection`, followed by the existing recovery/security suite.
All vendors, profiles, bank references and orders are synthetic local fixtures.
No hosted database is used. PGlite tests are in process. Native tests use only the
fixed disposable workspace cluster on 127.0.0.1:55432, database
`officebites_local_atomic`; both database name and data directory are checked.
Tests temporarily simulate EFT availability only inside
this disposable database and disable all methods at the end.

See `docs/atomic-collection-local-20261022.md` for current results, native runtime
instructions, promotion/recovery requirements and the NO-GO hosted assessment.

## Repeating the native tests locally

Use only the disposable workspace cluster. The pinned packages are already
downloaded in the ignored runtime directory. No hosted URL/key is accepted by
the adapter. The Windows binaries need a compatible Visual C++ runtime DLL
directory on the process PATH; this session used the existing Edge directory
`C:/Program Files (x86)/Microsoft/Edge/Application/155.0.4283.62`. Do not install
or change system services to run these tests.

With local Node on PATH and the runtime directory above prepended:

```powershell
$pgTestBin = '.officebites-local/native-runtime/node_modules/@embedded-postgres/windows-x64/native/bin'
# initdb is needed only once for a new, empty test directory:
# & "$pgTestBin/initdb.exe" -D '.officebites-local/pg-atomic-data' -U postgres -A trust --encoding=UTF8 --locale=C
& "$pgTestBin/pg_ctl.exe" -D '.officebites-local/pg-atomic-data' -l '.officebites-local/pg-atomic-server.log' -o '-h 127.0.0.1 -p 55432' -w start
try {
  node checks/pilot/native-bootstrap.mjs --reset
  if ($LASTEXITCODE -ne 0) { throw 'Local test reset failed' }
  $env:OFFICEBITES_LOCAL_NATIVE = '1'
  node checks/checkout-database.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Native tests failed' }
} finally {
  Remove-Item Env:OFFICEBITES_LOCAL_NATIVE -ErrorAction SilentlyContinue
  & "$pgTestBin/pg_ctl.exe" -D '.officebites-local/pg-atomic-data' -m fast -w stop
}
```

`--reset` deliberately drops/recreates only `officebites_local_atomic` and its
fixed fixture roles AFTER verifying the server data directory matches the
workspace test cluster. Never point this workflow at a shared PostgreSQL server.
If startup fails because the port is occupied, stop and inspect; do not terminate
an unknown process. The final session stopped its disposable server successfully.
