// Fast isolated recovery entrypoint. No network, accounts, or real payment data.
// Full checkout harness also invokes the same recovery assertions.
import { PGlite } from '@electric-sql/pglite';
import { verifyUatRecovery } from './recovery-database.mjs';
const db = new PGlite();
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA private;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE TABLE public.profiles(id uuid,role text,suspended boolean,deleted_at timestamptz,vendor_id uuid);
 CREATE TABLE public.vendors(id uuid,owner_id uuid,status text,archived_at timestamptz);
 CREATE TABLE public.orders(id uuid PRIMARY KEY);
 CREATE TABLE public.order_suborders(id uuid PRIMARY KEY);
 CREATE TABLE private.manual_order_payments(order_id uuid PRIMARY KEY);
 CREATE TABLE private.manual_receivables(order_id uuid PRIMARY KEY);
 CREATE TABLE private.manual_receivable_entries(id uuid PRIMARY KEY);
 CREATE TABLE private.gateway_settings(provider text PRIMARY KEY,enabled boolean,ready boolean,maintenance boolean);
 INSERT INTO private.gateway_settings VALUES('payfast',false,true,true),('ozow',false,false,true),('manual_eft',false,true,false),('manual_payshap',false,true,false);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role') $$;
 CREATE FUNCTION private.manual_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Retain immutable payment history'; END $$;
 CREATE FUNCTION private.active_account() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 GRANT USAGE ON SCHEMA public,auth,private TO anon,authenticated,service_role;`);
  if (process.argv.length > 3) throw Error('Usage: verify-recovery.mjs [local-baseline.json]');
  await verifyUatRecovery(db, process.argv[2] ? {
    baselinePath: process.argv[2],
    evidenceDirectory: '.officebites-local/OB-UAT-20261020/recovery-20261022',
  } : {});
} catch (error) {
  console.error('Local recovery verification failed:', error.message);
  process.exitCode = 1;
} finally { await db.close(); }
