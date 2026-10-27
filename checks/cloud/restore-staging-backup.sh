#!/usr/bin/env bash
# Executes ONLY inside a fresh --network none container, never on the source.
set -euo pipefail
umask 077
db="${1:?disposable database required}"
[[ "$db" =~ ^officebites_restore_disposable_[0-9]+$ ]]
[[ "$(postgres --version)" =~ PostgreSQL\)\ 17\. ]]
test ! -e /restore
install -d -o postgres -g postgres -m 700 /restore /restore/data /restore/socket
postgres --version >/restore/postgres-version.txt
chown -R postgres:postgres /input /verification
runuser -u postgres -- initdb -D /restore/data -U officebites_restore_bootstrap --auth-local=trust --auth-host=trust >/restore/init.log 2>&1
runuser -u postgres -- pg_ctl -D /restore/data -l /restore/server.log -o "-h 127.0.0.1 -p 55443 -k /restore/socket" -w start
trap 'runuser -u postgres -- pg_ctl -D /restore/data -m fast -w stop >/dev/null 2>&1 || true' EXIT
export PGHOST=127.0.0.1 PGPORT=55443 PGUSER=officebites_restore_bootstrap
unset PGPASSWORD PGPASSFILE PGSERVICE PGSERVICEFILE PGOPTIONS
psql -X -w -d postgres -v ON_ERROR_STOP=1 -tAc \
 "SELECT current_setting('data_directory')='/restore/data' AND host(inet_server_addr())='127.0.0.1' AND inet_server_port()=55443 AND current_user='officebites_restore_bootstrap'" | grep -qx t
psql -X -w -d postgres -v ON_ERROR_STOP=1 --single-transaction -f /input/roles.sql >/restore/roles.log 2>&1
createdb -w -T template0 "$db"
psql -X -w -d "$db" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public' >/restore/empty.log 2>&1
start=$(date +%s%3N)
pg_restore -w -d "$db" --single-transaction --exit-on-error --no-tablespaces /input/database.dump >/restore/archive.log 2>&1
end=$(date +%s%3N)
printf '%s\n' "$((end-start))" >/restore/restore-duration-ms.txt
export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=60000 -c search_path=public'
psql -X -w -d "$db" -tAq -v ON_ERROR_STOP=1 -f /verification/staging-backup-catalog.sql -o /restore/restored-catalog.jsonl
psql -X -w -d "$db" -tAq -v ON_ERROR_STOP=1 -f /verification/staging-backup-data.sql -o /restore/restored-data.jsonl
psql -X -w -d "$db" -v ON_ERROR_STOP=1 -f /verification/staging-restored-permissions.sql >/restore/permissions.log 2>&1
# No migration candidate, application order write or callback is executed.
