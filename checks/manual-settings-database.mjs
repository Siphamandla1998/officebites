import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PGlite} from '../node_modules/@electric-sql/pglite/dist/index.js';
export async function verifySettingsPackageCompatibility(db,installer){
 if(!(db instanceof PGlite))throw Error('Disposable PGlite instance required');
 const q=async s=>(await db.query(s)).rows[0];
 const flags=(await q('SELECT jsonb_agg(to_jsonb(g) ORDER BY provider) r FROM private.gateway_settings g')).r;
 await db.exec("SET LOCAL officebites.local_fixture='isolated-checkout'");
 await db.exec(fs.readFileSync('checks/manual-settings-concurrency-candidate.sql','utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm,''));
 assert.deepEqual((await q('SELECT jsonb_agg(to_jsonb(g) ORDER BY provider) r FROM private.gateway_settings g')).r,flags);
 assert.equal((await q("SELECT has_function_privilege('anon','public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text)','EXECUTE') r")).r,false);
 assert.equal((await q("SELECT has_function_privilege('authenticated','public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text)','EXECUTE') r")).r,true);
 await db.exec('SAVEPOINT retry');
 try{await assert.rejects(()=>db.exec(installer),/function\/ACL drift/);}finally{await db.exec('ROLLBACK TO retry;RELEASE retry');}
 console.log('4 post-EFT settings-install/unchanged-gateway/ACL/expected-retry-drift assertions passed in disposable PGlite. No actor or gate activation.');
}
export async function verifySettingsFix(db){
 if(!(db instanceof PGlite))throw Error('Disposable PGlite instance required');
 let checks=0;const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const q=async(s,a=[])=>(await db.query(s,a)).rows[0];
 const root=()=>db.exec("RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false)");
 const as=async n=>{await root();await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('SET ROLE '+(n?'authenticated':'anon'));};
 const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
 const reject=async(sql,args,pattern)=>{await db.exec('SAVEPOINT denied');try{await assert.rejects(()=>db.query(sql,args),pattern);checks++;}finally{await db.exec('ROLLBACK TO denied;RELEASE denied');}};
 const sql='SELECT public.admin_manual_settings_checked($1,$2,$3,$4,$5,$6)';
 const reason='Synthetic local settings change only';
 const revision=async()=>(await q('SELECT public.manual_payment_workspace(false) r')).r.settings.settings_revision;
 await root();await db.exec('BEGIN');
 try{
  const flags=(await q('SELECT jsonb_agg(to_jsonb(g) ORDER BY provider) r FROM private.gateway_settings g')).r;
  const initial=(await q('SELECT to_jsonb(s) r FROM private.manual_payment_settings s')).r;
  await db.exec("SET LOCAL officebites.local_fixture='isolated-checkout'");
  await db.exec(fs.readFileSync('checks/manual-settings-concurrency-candidate.sql','utf8').replace(/^\s*(BEGIN|COMMIT);\s*$/gm,''));
  equal((await q('SELECT jsonb_agg(to_jsonb(g) ORDER BY provider) r FROM private.gateway_settings g')).r,flags);
  equal((await q('SELECT deadline_minutes,review_threshold FROM private.manual_payment_settings')).deadline_minutes,initial.deadline_minutes);
  await as(null);await reject(sql,[false,false,16,501,reason,'wrong'],/permission denied/);
  await as(802);await reject(sql,[false,false,16,501,reason,'wrong'],/administrator/);
  await as(1);const old=await revision();assert.match(old,/^[a-f0-9]{32}$/);checks++;
  await q(sql,[false,false,16,501,reason,old]);equal((await q('SELECT public.manual_payment_workspace(false) r')).r.settings.deadline_minutes,16);
  assert.notEqual(await revision(),old);checks++;
  const count=(await q('SELECT public.manual_payment_workspace(false) r')).r.events.length;
  await reject(sql,[false,false,16,501,reason,old],/Settings changed/);
  equal((await q('SELECT public.manual_payment_workspace(false) r')).r.events.length,count);
  const current=await revision();
  for(const [minutes,threshold]of [[null,500],[4,500],[15,0],[15,1.001],[15,'NaN']])await reject(sql,[false,false,minutes,threshold,reason,current],/Valid manual settings/);
  await reject(sql,[false,false,15,500,reason,null],/Settings changed/);
  // Legacy authorized writes advance revision too, including same-value/ABA writes.
  await q('SELECT public.admin_manual_settings(false,false,16,501,$1)',[reason]);assert.notEqual(await revision(),current);checks++;
  const gateRevision=await revision();await root();await db.exec('UPDATE private.pilot_policy SET enabled=true WHERE singleton');await as(1);
  await reject(sql,[true,false,15,500,reason,gateRevision],/authoris|collection|unavailable/i);
  equal(await revision(),gateRevision);
  await root();await db.exec('UPDATE private.pilot_policy SET enabled=false WHERE singleton');
  // Pending banking uses existing admin-assisted workflow; owner gets no selling privileges.
  await db.exec(`INSERT INTO auth.users(id,email) VALUES('${id(93001)}','independent-local@test.invalid');INSERT INTO public.profiles(id,name,email,role) VALUES('${id(93001)}','Synthetic independent admin','independent-local@test.invalid','admin');UPDATE public.vendors SET status='pending' WHERE id='${id(804)}';`);
  const destination={accountHolder:'Synthetic non-routing test recipient',bank:'Synthetic bank',accountNumber:'0000000000',accountType:'Synthetic',branchCode:'000000'};
  const submit='SELECT public.submit_vendor_payment_profile($1,$2,true,false) r';
  await as(802);await reject(submit,[id(804),destination],/ownership/);
  await as(1);const profile=(await q(submit,[id(804),destination])).r;
  await reject('SELECT public.approve_vendor_payment_profile($1,$2)',[profile,'Synthetic independent banking evidence'],/Independent approver/);
  await as(93001);await q('SELECT public.approve_vendor_payment_profile($1,$2)',[profile,'Synthetic independent banking evidence only']);checks++;
  await root();equal((await q('SELECT status FROM public.vendors WHERE id=$1',[id(804)])).status,'pending');
  await as(null);equal(Object.values((await q('SELECT public.get_vendor_manual_methods($1) r',[id(804)])).r).some(v=>v===true),false);
 }finally{await root();await db.exec('ROLLBACK');}
 equal((await q("SELECT to_regprocedure('public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text)') r")).r,null);
 console.log(`${checks} settings CAS/duplicates/validation/role/activation/pending-banking assertions passed in disposable PGlite; candidate rolled back.`);
}
