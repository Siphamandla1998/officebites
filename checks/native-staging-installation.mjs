// Staging rehearsal: captured shared schema + existing installed staging sources; guarded actual-function preimage comparison.
// Native local-only rehearsal. No environment DSN or database override accepted.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); process.chdir(root);
assert.ok(!process.env.DATABASE_URL&&!process.env.PGHOST&&!process.env.PGPORT,'Database environment overrides forbidden');
const require=createRequire(path.resolve(root,'../../../.officebites-local/native-runtime/package.json'));
const {Client,types}=require('pg'); types.setTypeParser(20,Number);
const dir=path.join(root,'.officebites-local/pg-release-owner-data').replaceAll('\\','/').toLowerCase();
const database='officebites_staging_disposable_'+Date.now();
const connect=async(name,user='postgres')=>{const c=new Client({host:'127.0.0.1',port:55441,user,password:'',database:name,ssl:false,options:'',connectionTimeoutMillis:5000});await c.connect();return c;};
const ident=s=>'"'+s.replaceAll('"','""')+'"',lit=s=>"'"+s.replaceAll("'","''")+"'";
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const proof=async(c,name)=>assert.equal((await c.query(c.user==='release_native_bootstrap'
 ? "SELECT current_database()||'|'||replace(lower(current_setting('data_directory')),chr(92),'/')||'|'||host(inet_server_addr()) value"
 : 'SELECT public.native_fixture_identity() value')).rows[0].value,name+'|'+dir+'|127.0.0.1');
const admin=await connect('postgres','release_native_bootstrap');
await proof(admin,'postgres');
await admin.query(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres') THEN
 CREATE ROLE postgres LOGIN NOSUPERUSER INHERIT BYPASSRLS CREATEROLE CREATEDB;
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE;
 END IF; END $$;`);
await admin.query('GRANT anon,authenticated,service_role TO postgres WITH ADMIN OPTION');
assert.equal((await admin.query('SELECT count(*) n FROM pg_database WHERE datname=$1',[database])).rows[0].n,0,'Refuse database reuse');
await admin.query('CREATE DATABASE '+database+' OWNER postgres');await admin.end();
const fixtureIdentity=await connect(database,'release_native_bootstrap');await proof(fixtureIdentity,database);
await fixtureIdentity.query(`CREATE FUNCTION public.native_fixture_identity() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT current_database()||'|'||replace(lower(current_setting('data_directory')),chr(92),'/')||'|'||host(inet_server_addr()) $$;
 REVOKE ALL ON FUNCTION public.native_fixture_identity() FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.native_fixture_identity() TO postgres,anon,authenticated,service_role,supabase_storage_admin;`);
await fixtureIdentity.end();
let db=await connect(database);await proof(db,database);
const q=(sql,args=[])=>db.query(sql,args);
let assertions=0;
const eq=(a,b)=>{assert.deepEqual(a,b);assertions++;};
const reject=async(sql,args,pattern)=>{await assert.rejects(()=>q(sql,args),pattern);assertions++;};
const rootRole=()=>q("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const as=async n=>{await rootRole();await q("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[n?id(n):'',n?'authenticated':'anon']);await q('SET ROLE '+(n?'authenticated':'anon'));};
try {
 await q(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; END IF; END $$;
 DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='release_native_bootstrap') THEN CREATE ROLE release_native_bootstrap LOGIN SUPERUSER; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_storage_admin') THEN CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE; END IF; END $$;
 CREATE SCHEMA private; CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA supabase_migrations;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',raw_app_meta_data jsonb DEFAULT '{}');
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text,owner uuid,metadata jsonb DEFAULT '{}');
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
 CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
 GRANT USAGE ON SCHEMA public,private,auth,storage TO anon,authenticated,service_role;
 GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated,service_role;
 CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text);
 SET check_function_bodies=off;`);
 const s=json('docs/release/production-structure.json')[0];
 for(const e of s.enums)await q(`CREATE TYPE ${ident(e.schema_name)}.${ident(e.name)} AS ENUM(${e.labels.map(lit)})`);
 const views=json('docs/release/production-view-prerequisites.json')[0].views;
 const viewNames=new Set(views.map(v=>v.schema_name+'.'+v.name));
 for(const key of new Set(s.columns.map(c=>c.schema_name+'.'+c.table_name))){
  if(viewNames.has(key))continue;
  const columns=s.columns.filter(c=>c.schema_name+'.'+c.table_name===key).map(c=>ident(c.column_name)+' '+c.type+(c.default_expr?' DEFAULT '+c.default_expr:'')+(c.not_null?' NOT NULL':''));
  await q('CREATE TABLE '+key+'('+columns.join(',')+')');
 }
 for(const c of [...s.constraints].sort((a,b)=>Number(a.definition.startsWith('FOREIGN KEY'))-Number(b.definition.startsWith('FOREIGN KEY'))))await q(`ALTER TABLE ${ident(c.schema_name)}.${ident(c.table_name)} ADD CONSTRAINT ${ident(c.name)} ${c.definition}`);
 for(const f of json('docs/release/repair-production-functions.json'))await q(f.definition+';');
 for(const v of views)await q('CREATE VIEW '+v.schema_name+'.'+v.name+' AS '+v.definition);
 for(const t of s.triggers)await q(t.definition);
 const indexes=json('docs/release/production-privileges.json')[0].indexes;
 for(const i of indexes){if((await q('SELECT to_regclass($1) r',[i.schemaname+'.'+i.indexname])).rows[0].r===null)await q(i.indexdef);}
 for(const o of s.objects)if(!viewNames.has(o.schema_name+'.'+o.table_name)&&o.rls)await q(`ALTER TABLE ${ident(o.schema_name)}.${ident(o.table_name)} ENABLE ROW LEVEL SECURITY`);
 for(const p of s.policies)await q(`CREATE POLICY ${ident(p.policyname)} ON ${ident(p.schemaname)}.${ident(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.map(ident)}${p.qual?' USING('+p.qual+')':''}${p.with_check?' WITH CHECK('+p.with_check+')':''}`);
 const a=json('docs/release/production-access.json')[0];
 for(const g of a.grants)await q(`GRANT ${g.privilege_type} ON public.${ident(g.table_name)} TO ${ident(g.grantee)}`);
 for(const g of a.column_grants||[])await q(`GRANT ${g.privilege_type}(${ident(g.column_name)}) ON public.${ident(g.table_name)} TO ${ident(g.grantee)}`);
 // Function ACLs captured from production. Managed service implementations remain fixture contracts.
 for(const f of json('docs/release/production-catalog.json')[0].functions){
  await q('REVOKE ALL ON FUNCTION '+f.signature+' FROM PUBLIC,anon,authenticated,service_role');
  const acl=Array.isArray(f.acl)?f.acl:String(f.acl||'{=X/postgres}').slice(1,-1).split(',');
  for(const entry of acl){const m=entry.match(/^([^=]*)=([^/]*)\//);if(m&&m[2].includes('X'))await q('GRANT EXECUTE ON FUNCTION '+f.signature+' TO '+(m[1]?ident(m[1]):'PUBLIC'));}
 }
 for(const row of json('docs/release/repair-staging-history.json').migrations)await q('INSERT INTO supabase_migrations.schema_migrations VALUES($1,$2)',[row.version,row.name]);
 await rootRole();
 await q(`INSERT INTO auth.users(id,email) VALUES('${id(1)}','reviewer-one@synthetic.invalid'),('${id(2)}','customer@synthetic.invalid'),('${id(3)}','vendor@synthetic.invalid'),('${id(6)}','reviewer-two@synthetic.invalid');
 INSERT INTO public.profiles(id,name,email,role) VALUES('${id(1)}','Synthetic reviewer one','reviewer-one@synthetic.invalid','admin'),('${id(2)}','Synthetic customer','customer@synthetic.invalid','customer'),('${id(3)}','Synthetic legacy vendor','vendor@synthetic.invalid','vendor'),('${id(6)}','Synthetic reviewer two','reviewer-two@synthetic.invalid','admin');
 INSERT INTO public.vendors(id,owner_id,name,category,status,commission_rate) VALUES('${id(4)}','${id(3)}','Synthetic retained vendor','Meals','approved',0.17);
 UPDATE public.profiles SET vendor_id='${id(4)}' WHERE id='${id(3)}';
 INSERT INTO public.order_flow(status,step) VALUES('confirmed',1),('accepted',2),('preparing',3),('ready',4),('collected',5),('completed',6);`);
 const retained=(await q('SELECT to_jsonb(v) v FROM public.vendors v WHERE id=$1',[id(4)])).rows[0].v;
 await q("INSERT INTO public.meals(id,vendor_id,name,category,price) VALUES($1,$2,'SYNTHETIC retained meal','Meals',100)",[id(7),id(4)]);
 const retainedOrder=(await q("SELECT public.create_order_from_cart(NULL,'SYNTHETIC retained guest','0820000000',NULL,current_date+7,'SYNTHETIC retained location',$1) r",[JSON.stringify([{mealId:id(7),qty:1}])])).rows[0].r;
 const _retainedRows={order:(await q('SELECT to_jsonb(o) r FROM public.orders o WHERE id=$1',[retainedOrder.id])).rows[0].r,suborders:(await q('SELECT to_jsonb(s) r FROM public.order_suborders s WHERE order_id=$1 ORDER BY id',[retainedOrder.id])).rows,items:(await q('SELECT to_jsonb(i) r FROM public.order_items i JOIN public.order_suborders s ON s.id=i.suborder_id WHERE s.order_id=$1 ORDER BY i.id',[retainedOrder.id])).rows};
 await q('SET check_function_bodies=on');
 const fixtureAdmin=await connect(database,'release_native_bootstrap');await proof(fixtureAdmin,database);
 await fixtureAdmin.query(`ALTER SCHEMA storage OWNER TO release_native_bootstrap;
 GRANT USAGE,CREATE ON SCHEMA storage TO supabase_storage_admin;
 GRANT USAGE ON SCHEMA storage TO postgres;
 ALTER TABLE storage.objects OWNER TO supabase_storage_admin; ALTER TABLE storage.buckets OWNER TO supabase_storage_admin;
 GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects,storage.buckets TO postgres;`);await fixtureAdmin.end();
 await db.end();db=await connect(database);await proof(db,database);
 eq((await q("SELECT rolsuper FROM pg_roles WHERE rolname='postgres'")).rows[0].rolsuper,false);

 // These are ALREADY INSTALLED staging dependencies, reconstructed only locally.
 // No excluded feature here becomes part of the forward staging installation delta.
 const existingSources=[
 '20261016074256_checkout_recovery_mobile_delivery_gateways.sql','20261016081336_booking_mobile_validation.sql',
 '20261016083644_ozow_attempts_subscription_approval.sql','20261016090258_central_hub_vendor_origin_approval.sql',
 '20261016091839_central_hub_display_name_encoding.sql','20261016092359_delivery_unenforced_order_snapshots.sql',
 '20261016094201_legal_corporate_framework.sql','20261016100142_commercial_reporting_contract_locks.sql',
 '20261016101707_repair_order_policy_helper_access.sql','20261020090841_vendor_direct_manual_payments.sql',
 '20261021094956_fix_admin_manual_settings_singleton.sql'];
 for(const name of existingSources){console.log('Reconstruct installed staging source:',name);await q(fs.readFileSync('checks/reference-regressions/supabase/migrations/'+name,'utf8').replaceAll('\r\n','\n'));}
 const capture=json('checks/reference-regressions/checks/uat/fixtures/eft-staging-baseline-20261026.json');
 const comparisons=[];
 for(const f of capture.functions){const actual=(await q('SELECT md5(pg_get_functiondef(to_regprocedure($1))) hash',[f.signature])).rows[0].hash;comparisons.push({signature:f.signature,captured:f.md5,reconstructed:actual,match:actual===f.md5});}
 fs.writeFileSync('docs/release/staging-preimage-rehearsal.json',JSON.stringify({observedUtc:new Date().toISOString(),captureUtc:capture.observedUtc,comparisons},null,2));
 if(comparisons.some(f=>!f.match)){console.error(comparisons.filter(f=>!f.match));throw new Error('Captured staging function preimage mismatch; refuse to weaken staging guards');}
 await q("UPDATE private.gateway_settings SET maintenance=false WHERE provider IN('manual_eft','manual_payshap','payfast');UPDATE private.delivery_settings SET enabled=false");
 await q("INSERT INTO private.vendor_legal_acceptances(vendor_id,actor_id,documents,acknowledgements,method) VALUES($1,$2,'{}','[]','application')",[id(4),id(3)]);
 const oldReceipt=(await q('SELECT to_jsonb(a) r FROM private.vendor_legal_acceptances a')).rows[0].r;
 const beforeSettings=(await q('SELECT * FROM private.gateway_settings ORDER BY provider')).rows;
 const manifest=json('docs/release/staging-installation-manifest.json');
 await q('ALTER TABLE supabase_migrations.schema_migrations ADD COLUMN statements text[]');
 console.log('Apply staging-only application installation bundle');
 await q(fs.readFileSync(manifest.steps[0].installationBundle,'utf8'));
 eq((await q('SELECT count(*) n FROM supabase_migrations.schema_migrations')).rows[0].n,55);
 eq((await q('SELECT * FROM private.gateway_settings ORDER BY provider')).rows,beforeSettings);
 eq((await q("SELECT to_jsonb(a)-'assignment_id'-'acknowledgement_text'-'signer_name' r FROM private.vendor_legal_acceptances a")).rows[0].r,oldReceipt);
 eq((await q('SELECT to_jsonb(v) v FROM public.vendors v WHERE id=$1',[id(4)])).rows[0].v,retained);
 // Ordinary native PG has no supautils. Demonstrate safe rejection, not simulated delegation.
 const policySql=fs.readFileSync(manifest.steps[1].sql,'utf8');
 await reject(policySql,[],/bucket configuration/);await q('ROLLBACK');
 const bucketAdmin=await connect(database,'release_native_bootstrap');await proof(bucketAdmin,database);
 // Models an approved Storage API bucket creation, not an installer metadata INSERT.
 await bucketAdmin.query("INSERT INTO storage.buckets VALUES('vendor-compliance','vendor-compliance',false,5242880,ARRAY['application/pdf','image/jpeg','image/png'])");await bucketAdmin.end();
 await reject(policySql,[],/owner|permission/);await q('ROLLBACK');
 const managed=await connect(database,'supabase_storage_admin');await proof(managed,database);
 try{await managed.query(policySql);}finally{await managed.end();}
 // The approved coordinator records only this NEW version after owner-path commit.
 await q('INSERT INTO supabase_migrations.schema_migrations VALUES($1,$2,$3)',[manifest.steps[1].version,manifest.steps[1].name,[policySql]]);
 eq((await q('SELECT count(*) n FROM supabase_migrations.schema_migrations')).rows[0].n,56);
 eq((await q("SELECT count(*) n FROM pg_policies WHERE schemaname='storage' AND policyname LIKE 'compliance_%'")).rows[0].n,6);
 await as(3);const existing=(await q("SELECT public.become_vendor('SYNTHETIC existing account','Meals',NULL) r")).rows[0].r;
 eq(existing.vendor_id,id(4));eq(existing.already_vendor,true);
 await rootRole();eq((await q('SELECT count(*) n FROM public.vendors WHERE owner_id=$1',[id(3)])).rows[0].n,1);
 await import('./native-release-scenarios.mjs').then(m=>m.verify({db,q,eq,reject,rootRole,as,id,connect:()=>connect(database),proof:c=>proof(c,database),beforeContainment:ctx=>import('./native-staging-recovery.mjs').then(r=>r.containment(ctx))}));
 await rootRole();
 await import('./native-staging-recovery.mjs').then(m=>m.snapshot({q,database,eq}));
 fs.writeFileSync('docs/release/native-staging-installation-result.json',JSON.stringify({observedUtc:new Date().toISOString(),assertions,result:'passed',baseline:'captured 54-history plus 10 exact function preimages',ownership:'non-superuser application; distinct managed owner fallback',preferredHostedPolicyPath:'supautils delegation not installed locally; operator confirmation required',hostedSqlExecuted:false},null,2));
 console.log('Staging installation/recovery assertions:',assertions);
} finally {await db.end();}
