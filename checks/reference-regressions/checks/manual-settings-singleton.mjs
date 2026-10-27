// Focused isolated PostgreSQL tests. No network, hosted users/orders or payments.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

const migration='supabase/migrations/20261021094956_fix_admin_manual_settings_singleton.sql';
const baseline=JSON.parse(fs.readFileSync('checks/fixtures/manual-settings-baseline-20261021.json','utf8'));
const sql=fs.readFileSync(migration,'utf8');
const original=fs.readFileSync('supabase/migrations/20261020090841_vendor_direct_manual_payments.sql','utf8');
const settingsDdl=original.match(/CREATE TABLE private\.manual_payment_settings \([\s\S]*?\n\);/)[0];
const db=new PGlite();const results=[];
const check=(name,fn)=>{fn();results.push({name,pass:true});};
const q=async(text,args=[])=> (await db.query(text,args)).rows;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const as=async(n,role='authenticated')=>{await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('SET ROLE '+role);};
const root=()=>db.exec('RESET ROLE');
const snapshot=async()=>{await root();return (await q(`SELECT jsonb_build_object(
 'settings',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY singleton),'[]') FROM private.manual_payment_settings s),
 'gateways',(SELECT jsonb_agg(to_jsonb(g) ORDER BY provider) FROM private.gateway_settings g),
 'audit',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]') FROM private.business_audit a),
 'events',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY id),'[]') FROM private.manual_payment_events e)) AS state`))[0].state;};
const invoke=(minutes=15,threshold=500,reason='Synthetic settings validation',eft=false,payshap=false)=>db.query('SELECT public.admin_manual_settings($1,$2,$3,$4,$5)',[eft,payshap,minutes,threshold,reason]);
async function rejected(name,run,pattern){const before=await snapshot();let error;try{await run();}catch(e){error=e;}check(name,()=>{assert.ok(error,'Expected rejection');assert.match(error.message,pattern);});check(name+' leaves settings, gateways and audits atomic',()=>{});const after=await snapshot();assert.deepEqual(after,before);}

try{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA private;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text,suspended boolean DEFAULT false,deleted_at timestamptz,vendor_id uuid);
 CREATE TABLE public.vendors(id uuid PRIMARY KEY,owner_id uuid,status text,archived_at timestamptz);
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 GRANT USAGE ON SCHEMA public,private,auth TO anon,authenticated,service_role;
 CREATE TABLE private.gateway_settings(provider text PRIMARY KEY,enabled boolean NOT NULL DEFAULT false,ready boolean NOT NULL DEFAULT false,maintenance boolean NOT NULL DEFAULT false,notice text NOT NULL DEFAULT '',updated_at timestamptz DEFAULT now(),updated_by uuid);
 CREATE TABLE private.business_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid,action text,reason text,details jsonb);
 CREATE TABLE private.manual_payment_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid,action text,note text);
 ${settingsDdl}
 INSERT INTO private.manual_payment_settings DEFAULT VALUES;
 ALTER TABLE private.manual_payment_settings ENABLE ROW LEVEL SECURITY;
 ALTER TABLE private.gateway_settings ENABLE ROW LEVEL SECURITY;
 ALTER TABLE private.business_audit ENABLE ROW LEVEL SECURITY;
 ALTER TABLE private.manual_payment_events ENABLE ROW LEVEL SECURITY;`);
 for(const h of [...baseline.helpers].sort((a,b)=>Number(a.name.includes('is_admin'))-Number(b.name.includes('is_admin'))))await db.exec(h.definition);
 await db.exec(`CREATE TRIGGER marketplace_provider_block BEFORE INSERT OR UPDATE ON private.gateway_settings FOR EACH ROW EXECUTE FUNCTION private.block_marketplace_provider();`);
 for(const g of baseline.methods)await db.query('INSERT INTO private.gateway_settings(provider,enabled,ready,maintenance) VALUES($1,$2,$3,$4)',[g.provider,g.enabled,g.ready,g.maintenance]);
 for(const [n,role,suspended,deleted] of [[1,'admin',false,false],[2,'customer',false,false],[3,'vendor',false,false],[4,'admin',true,false],[5,'admin',false,true]]){
  await db.query('INSERT INTO auth.users VALUES($1)',[id(n)]);
  await db.query('INSERT INTO public.profiles(id,role,suspended,deleted_at) VALUES($1,$2,$3,$4)',[id(n),role,suspended,deleted?'2026-01-01':null]);
 }
 await db.exec(baseline.function.definition);
 await db.exec(`REVOKE ALL ON FUNCTION public.admin_manual_settings(boolean,boolean,integer,numeric,text) FROM PUBLIC;
 GRANT EXECUTE ON FUNCTION public.admin_manual_settings(boolean,boolean,integer,numeric,text) TO authenticated,service_role;`);
 const metadata=()=>q("SELECT oid,pg_get_userbyid(proowner) owner,proacl::text acl,prosecdef,proconfig FROM pg_proc WHERE oid='public.admin_manual_settings(boolean,boolean,integer,numeric,text)'::regprocedure");
 const beforeMetadata=await metadata(),beforeInstall=await snapshot();
 await db.exec(sql);
 check('migration does not mutate settings, gateway flags or audits',()=>{});assert.deepEqual(await snapshot(),beforeInstall);
 check('CREATE OR REPLACE preserves function OID, owner, grants and security properties',()=>{});assert.deepEqual(await metadata(),beforeMetadata);
 check('targeted singleton predicate and row count check present',()=>{assert.match(sql,/WHERE singleton = true;\s+GET DIAGNOSTICS updated_rows = ROW_COUNT;\s+IF updated_rows <> 1/);});
 check('historical unsafe UPDATE confirmed without editing original',()=>{assert.match(baseline.function.definition,/review_threshold=p_threshold;/);});
 await as(1);await invoke();const unchanged=await snapshot();
 check('active admin saves unchanged numerical settings',()=>assert.deepEqual(unchanged.settings,[{singleton:true,deadline_minutes:15,review_threshold:500}]));
 check('successful save records two gateway audits and one settings event',()=>{assert.equal(unchanged.audit.length,2);assert.equal(unchanged.events.length,1);assert.equal(unchanged.events[0].actor_id,id(1));assert.equal(unchanged.events[0].action,'settings_changed');assert.match(unchanged.events[0].note,/Synthetic settings validation/);});
 check('unchanged save leaves all methods disabled',()=>assert.ok(unchanged.gateways.every(g=>g.enabled===false)));
 check('legacy provider records remain identical',()=>assert.deepEqual(unchanged.gateways.filter(g=>['payfast','ozow'].includes(g.provider)),beforeInstall.gateways.filter(g=>['payfast','ozow'].includes(g.provider))));
 for(const [name,n,role] of [['anonymous',null,'anon'],['customer',2,'authenticated'],['vendor',3,'authenticated'],['suspended admin',4,'authenticated'],['deleted admin',5,'authenticated'],['service role without admin identity',null,'service_role']])await rejected(name+' denied',async()=>{await as(n,role);await invoke();},/permission|Active admin/i);
 for(const [name,minutes,threshold,reason,eft,payshap] of [
  ['deadline too short',4,500,'Valid synthetic reason',false,false],['deadline too long',61,500,'Valid synthetic reason',false,false],['missing deadline',null,500,'Valid synthetic reason',false,false],
  ['zero threshold',15,0,'Valid synthetic reason',false,false],['negative threshold',15,-1,'Valid synthetic reason',false,false],['missing threshold',15,null,'Valid synthetic reason',false,false],
  ['short reason',15,500,'short',false,false],['blank reason',15,500,'           ',false,false],['missing reason',15,500,null,false,false],['oversize reason',15,500,'x'.repeat(1001),false,false],
  ['existing downstream notice limit',15,500,'x'.repeat(501),false,false],['null EFT flag',15,500,'Valid synthetic reason',null,false],['null PayShap flag',15,500,'Valid synthetic reason',false,null],
 ])await rejected(name,async()=>{await as(1);await invoke(minutes,threshold,reason,eft,payshap);},/constraint|null value|reason required|at most 500/i);
 await root();await db.exec('DELETE FROM private.manual_payment_settings WHERE singleton=true');
 await rejected('missing singleton fails before gateway writes',async()=>{await as(1);await invoke();},/exactly one.*singleton/i);
 await root();await db.exec('INSERT INTO private.manual_payment_settings DEFAULT VALUES');
 // Deliberate local schema corruption demonstrates the >1 guard; real PK forbids this.
 await db.exec('ALTER TABLE private.manual_payment_settings DROP CONSTRAINT manual_payment_settings_pkey; INSERT INTO private.manual_payment_settings DEFAULT VALUES');
 await rejected('duplicate target rows fail and rollback',async()=>{await as(1);await invoke(20,800);},/exactly one.*singleton/i);
 await root();await db.exec('DELETE FROM private.manual_payment_settings WHERE ctid <> (SELECT ctid FROM private.manual_payment_settings ORDER BY ctid LIMIT 1); ALTER TABLE private.manual_payment_settings ADD PRIMARY KEY(singleton)');
 // Failure in the second gateway update must undo the first gateway metadata and settings.
 await db.exec(`CREATE FUNCTION private.fail_payshap_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.provider='manual_payshap' THEN RAISE EXCEPTION 'Synthetic second gateway failure';END IF; RETURN NEW;END $$;
 CREATE TRIGGER synthetic_gateway_failure BEFORE UPDATE ON private.gateway_settings FOR EACH ROW EXECUTE FUNCTION private.fail_payshap_update();`);
 await rejected('second gateway failure',async()=>{await as(1);await invoke(20,800);},/Synthetic second gateway failure/);
 await root();await db.exec('DROP TRIGGER synthetic_gateway_failure ON private.gateway_settings');
 await db.exec(`CREATE FUNCTION private.fail_settings_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic final audit failure';END $$;
 CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON private.manual_payment_events FOR EACH ROW EXECUTE FUNCTION private.fail_settings_audit();`);
 await rejected('final audit failure',async()=>{await as(1);await invoke(20,800);},/Synthetic final audit failure/);
 await root();await db.exec('DROP TRIGGER synthetic_audit_failure ON private.manual_payment_events');
 for(const provider of ['payfast','ozow']){
  await rejected(provider+' RPC activation rejected',async()=>{await as(1);await db.query('SELECT public.admin_update_payment_gateway($1,true,false,$2)',[provider,'Synthetic blocked activation attempt']);},/Provider authorisation required|Provider unavailable/);
  await rejected(provider+' trigger blocks direct activation',async()=>{await root();await db.query('UPDATE private.gateway_settings SET enabled=true WHERE provider=$1',[provider]);},/Provider authorisation required/);
 }
 await as(1);await invoke(20,800,'Explicit synthetic numeric settings change');const changed=await snapshot();
 check('only explicitly requested numerical settings change',()=>assert.deepEqual(changed.settings,[{singleton:true,deadline_minutes:20,review_threshold:800}]));
 check('each completed save contributes exactly its intended audits',()=>{assert.equal(changed.audit.length,4);assert.equal(changed.events.length,2);});
 await as(1);await invoke(15,500,'Restore synthetic numerical baseline');
 await root();const beforeReapply=await snapshot();await db.exec(sql);
 check('reapplying definition has no configuration side effects',()=>{});assert.deepEqual(await snapshot(),beforeReapply);
 check('all methods finish disabled',()=>assert.ok(beforeReapply.gateways.every(g=>!g.enabled)));
 // Definition-only restoration is recoverable, but returns the known unsafe body.
 // Do not invoke that old function; prefer retaining the fix operationally.
 await db.exec(baseline.function.definition);
 const restored=(await q("SELECT pg_get_functiondef('public.admin_manual_settings(boolean,boolean,integer,numeric,text)'::regprocedure) AS definition"))[0].definition;
 check('captured definition can be restored exactly',()=>assert.equal(restored,baseline.function.definition));
 check('definition restoration preserves configuration and audit history',()=>{});assert.deepEqual(await snapshot(),beforeReapply);
 check('definition restoration preserves ownership and grants',()=>{});assert.deepEqual(await metadata(),beforeMetadata);
 await db.exec(sql);
 check('forward fix reinstalls without changing settings or gateway state',()=>{});assert.deepEqual(await snapshot(),beforeReapply);
 const dir='.officebites-local/manual-settings-singleton';fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(dir+'/test-evidence.json',JSON.stringify({migration,sha256:crypto.createHash('sha256').update(sql).digest('hex'),checks:results.length,results,limitations:'PGlite executes actual SQL and captured Auth/admin/gateway helpers with synthetic schemas. No native hosted PostgREST/safeupdate extension or concurrent-server test; explicit WHERE checked in source. Local synthetic role/session claims only; no hosted Auth accounts.'},null,2));
 console.log(`${results.length} assertions passed; no hosted writes; all four local methods disabled.`);
}finally{await db.close();}
