// Narrow grant-hardening test, NOT a full production-schema rehearsal.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const native = process.argv.includes('--native');
if (process.env.PGLITE_MODULE || process.env.OFFICEBITES_LOCAL_NATIVE) throw new Error('Environment database overrides forbidden');
const dataDir = path.join(root, '.officebites-local/pg-release-grants-data').replaceAll('\\', '/').toLowerCase();
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const database = 'officebites_release_grants_disposable';
let db;
if (native) {
  const require = createRequire(path.resolve(root, '../../../.officebites-local/native-runtime/package.json'));
  const { Client } = require('pg');
  const connection = name => new Client({ host: '127.0.0.1', port: 55439, user: 'postgres', password: '', database: name, options: '', ssl: false, connectionTimeoutMillis: 5000, application_name: 'officebites-release-disposable-grants' });
  const bootstrap = connection('postgres');
  await bootstrap.connect();
  try {
    const probe = (await bootstrap.query("SELECT current_database()||'|'||replace(lower(current_setting('data_directory')),chr(92),'/')||'|'||host(inet_server_addr()) AS value")).rows[0].value;
    assert.equal(probe, 'postgres|' + dataDir + '|127.0.0.1', 'Disposable bootstrap identity mismatch');
    assert.equal((await bootstrap.query('SELECT count(*)::text AS value FROM pg_database WHERE datname=' + literal(database))).rows[0].value, '0', 'Refuse database reuse');
    await bootstrap.query('CREATE DATABASE ' + database);
  } finally { await bootstrap.end(); }
  const client = connection(database);
  await client.connect();
  const probe = (await client.query("SELECT current_database()||'|'||replace(lower(current_setting('data_directory')),chr(92),'/')||'|'||host(inet_server_addr()) AS value")).rows[0].value;
  assert.equal(probe, database + '|' + dataDir + '|127.0.0.1', 'Disposable test identity mismatch');
  db = { exec: sql => client.query(sql), query: sql => client.query(sql), close: () => client.end() };

} else {
  const { PGlite } = await import('../node_modules/@electric-sql/pglite/dist/index.js');
  db = new PGlite();
}
let assertions = 0;
const scalar = async sql => String((await db.query(sql)).rows[0].value);
const equals = async (sql, value) => { assert.equal(await scalar(sql), String(value)); assertions++; };
const candidate = fs.readFileSync('release/production-candidates/20261027093453_production_launch_browser_grants.sql', 'utf8');
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA private; CREATE SCHEMA supabase_migrations;
    CREATE TABLE supabase_migrations.schema_migrations(version text,name text);
    CREATE TYPE public.user_role AS ENUM('customer','vendor','admin'); SET check_function_bodies=off;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public,private GRANT ALL ON TABLES TO anon,authenticated;`);
  const history = JSON.parse(fs.readFileSync('docs/release/production-history.json', 'utf8')).migrations;
  assert.equal(history.length, 38);
  // Migration rows here are disposable metadata fixtures, never hosted history repairs.
  for (const row of history) await db.exec(`INSERT INTO supabase_migrations.schema_migrations VALUES(${literal(row.version)},${literal(row.name)});`);
  for (const name of ['profiles','vendors','orders','order_suborders','order_items']) {
    await db.exec(`CREATE TABLE public.${name}(id integer PRIMARY KEY,marker text NOT NULL);
      ALTER TABLE public.${name} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY preserved_read ON public.${name} FOR SELECT TO authenticated USING(marker='retained');
      INSERT INTO public.${name} VALUES(1,'retained');`);
  }
  await db.exec('GRANT INSERT(marker) ON public.profiles,public.vendors TO authenticated;');
  for (const f of JSON.parse(fs.readFileSync('docs/release/production-critical-functions.json', 'utf8')).filter(f => ['handle_new_user','guard_vendor_privileged_fields','guard_profile_privileged_fields'].includes(f.proname))) await db.exec(f.definition);
  await equals("SELECT has_table_privilege('authenticated','public.orders','TRUNCATE')::text AS value", 'true');
  await db.exec(candidate);
  for (const role of ['anon','authenticated']) for (const table of ['profiles','vendors','orders','order_suborders','order_items']) {
    await equals(`SELECT has_table_privilege('${role}','public.${table}','TRUNCATE')::text AS value`, 'false');
  }
  for (const table of ['profiles','vendors']) await equals(`SELECT has_column_privilege('authenticated','public.${table}','marker','INSERT')::text AS value`, 'false');
  await equals("SELECT count(*)::text AS value FROM public.orders WHERE marker='retained'", 1);
  await db.exec('CREATE TABLE public.future_table(id integer);');
  await equals("SELECT has_table_privilege('authenticated','public.future_table','TRUNCATE')::text AS value", 'false');
  await equals("SELECT has_table_privilege('authenticated','public.orders','SELECT')::text AS value", 'true');
  await db.exec("INSERT INTO supabase_migrations.schema_migrations VALUES('unexpected','drift'); GRANT TRUNCATE ON public.orders TO authenticated;");
  await assert.rejects(() => db.exec(candidate), /history changed/); assertions++;
  await db.exec('ROLLBACK;');
  await equals("SELECT has_table_privilege('authenticated','public.orders','TRUNCATE')::text AS value", 'true');
  console.log(`${assertions} production grant candidate assertions passed in ${native ? 'positively verified fresh loopback PostgreSQL' : 'fresh in-memory PGlite'}. No EFT/legal installer or concurrency claim.`);
} finally { await db.close(); }
