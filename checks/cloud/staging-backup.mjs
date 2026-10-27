// Prepared cloud-only operator workflow. No GitHub API writes or hosted restores.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const PROJECT='eyhmarmekioovcjibcbr';
const PG='/usr/lib/postgresql/17/bin/';
export function sourceIdentity(host){
 assert.equal(typeof host,'string');
 if(host===`db.${PROJECT}.supabase.co`)return {host,user:'postgres'};
 assert.match(host,/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/);
 return {host,user:`postgres.${PROJECT}`};
}
export function validateScope(env){
 assert.equal(env.GITHUB_ACTIONS,'true');
 assert.equal(env.GITHUB_EVENT_NAME,'workflow_dispatch');
 assert.equal(env.GITHUB_REF,'refs/heads/release/vendor-eft-legal-launch');
 assert.match(env.GITHUB_SHA??'',/^[a-f0-9]{40}$/);
 assert.equal(env.GITHUB_SHA,env.OB_BACKUP_APPROVED_SHA);
 assert.equal(env.OB_CONFIRM_PROJECT,PROJECT);
 assert.equal(env.OB_ROLE_FREEZE_CONFIRMED,'true');
 assert.match(env.OB_RESTORE_IMAGE??'',/^(?:public\.ecr\.aws\/supabase\/postgres|supabase\/postgres)@sha256:[a-f0-9]{64}$/);
 assert.match(env.OB_AGE_RECIPIENT??'',/^age1[a-z0-9]{58}$/);
 assert.match(env.GITHUB_RUN_ID??'',/^[0-9]+$/);assert.match(env.GITHUB_RUN_ATTEMPT??'',/^[0-9]+$/);
 return true;
}
export function cleanEnvironment(env){
 return Object.fromEntries(['PATH','HOME','LANG','LC_ALL','TMPDIR'].filter(k=>env[k]).map(k=>[k,env[k]]));
}
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function compareRows(a,b){assert.deepEqual(a,b,'Private recovery evidence mismatch');}
function locations(){
 const temp=fs.realpathSync(process.env.RUNNER_TEMP);
 const workspace=fs.realpathSync(process.env.GITHUB_WORKSPACE);
 assert.ok(!temp.startsWith(workspace+path.sep)&&temp!==workspace);
 const id=process.env.GITHUB_RUN_ID,attempt=process.env.GITHUB_RUN_ATTEMPT;
 assert.match(id??'',/^[0-9]+$/);assert.match(attempt??'',/^[0-9]+$/);
 const root=path.join(temp,`officebites-staging-backup-${id}-${attempt}`);
 return {root,cipher:root+'.tar.age',container:`officebites-restore-${id}-${attempt}`,database:`officebites_restore_disposable_${id}${attempt}`};
}
function marker(root){assert.equal(JSON.parse(fs.readFileSync(path.join(root,'marker.json'))).project,PROJECT);}
function write(root,name,value){fs.writeFileSync(path.join(root,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});}
function report(root,patch={}){
 const file=path.join(root,'result.json');const old=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
 write(root,'result.json',{project:PROJECT,reviewedCommit:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,scope:'Database replay and required application data/functions/permissions; not external-state or encrypted-key recovery',externalStateVerified:false,offlineDownloadDecryptionVerified:false,hostedApiVerified:false,exportComplete:false,restoreVerified:false,restoreDurationMs:null,...old,...patch});
}
async function run(root,exe,args,{env=cleanEnvironment(process.env),timeout=180000,signal}={}){
 const fd=fs.openSync(path.join(root,'process-private.log'),'a',0o600);
 try{await new Promise((resolve,reject)=>{
  const child=spawn(exe,args,{env,stdio:['ignore',fd,fd],timeout,signal});
  child.on('error',()=>reject(new Error('Private subprocess failed')));
  child.on('close',code=>code===0?resolve():reject(new Error('Private subprocess failed')));
 });}finally{fs.closeSync(fd);}
}
async function capture(client,root,prefix){
 const catalog=(await client.query(fs.readFileSync('checks/staging-backup-catalog.sql','utf8'))).rows.map(r=>Object.values(r)[0]);
 const rows=[];
 for(const part of fs.readFileSync('checks/staging-backup-data.sql','utf8').split(/^\\gexec\s*$/m)){
  const sql=part.replace(/^--.*$/gm,'').trim();if(!sql)continue;
  for(const generated of (await client.query(sql)).rows){
   const statement=Object.values(generated)[0];assert.match(statement,/^SELECT jsonb_build_object\(/);
   rows.push(Object.values((await client.query(statement)).rows[0])[0]);
  }
 }
 write(root,prefix+'-catalog.json',catalog);write(root,prefix+'-data.json',rows);
 return {catalog,rows};
}
async function exportStaging(root){
 validateScope(process.env);marker(root);const started=performance.now();
 const {Client}=createRequire('/usr/share/nodejs/pg/package.json')('pg');
 const {host,user}=sourceIdentity(process.env.OB_STAGING_DB_HOST);
 const password=process.env.OB_STAGING_DB_PASSWORD,ca=process.env.OB_STAGING_DB_CA_CERT;
 assert.ok(password&&!/[\r\n]/.test(password));assert.ok(ca?.includes('-----BEGIN CERTIFICATE-----')&&!ca.includes('PRIVATE KEY'));
 for(const k of Object.keys(process.env))if(k.startsWith('PG'))delete process.env[k];
 const caPath=path.join(root,'source-ca.pem'),passPath=path.join(root,'source.pgpass');
 fs.writeFileSync(caPath,ca,{mode:0o600});
 const escape=s=>s.replaceAll('\\','\\\\').replaceAll(':','\\:');
 fs.writeFileSync(passPath,`${host}:5432:postgres:${user}:${escape(password)}\n`,{mode:0o600});
 const options='-c default_transaction_read_only=on -c lock_timeout=5s -c statement_timeout=60000 -c search_path=public';
 const client=new Client({host,user,password,database:'postgres',port:5432,ssl:{ca,rejectUnauthorized:true},options,connectionTimeoutMillis:15000});
 let sourceDisconnected=false;client.on('error',()=>{sourceDisconnected=true;});
 const controller=new AbortController();
 const snapshotTimer=setTimeout(()=>{sourceDisconnected=true;client.connection?.stream?.destroy();controller.abort();},300000);
 const childEnv={...cleanEnvironment(process.env),PGPASSFILE:passPath,PGSSLMODE:'verify-full',PGSSLROOTCERT:caPath,PGOPTIONS:options};
 const connection=['--no-password',`--host=${host}`,`--username=${user}`,'--port=5432','--dbname=postgres'];
 try{
  await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const identity=(await client.query("SELECT current_user username,current_database() db,current_setting('server_version_num')::int version")).rows[0];
  assert.equal(identity.username,'postgres');assert.equal(identity.db,'postgres');assert.equal(Math.floor(identity.version/10000),17);
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
  assert.equal((await client.query("SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()")).rows[0].ssl,true);
  const manifest=JSON.parse(fs.readFileSync('docs/release/staging-installation-manifest.json'));
  const history=(await client.query("SELECT count(*)::int n,md5(string_agg(version||':'||coalesce(name,''),E'\\n' ORDER BY version)) md5 FROM supabase_migrations.schema_migrations")).rows[0];
  assert.equal(history.n,manifest.baselineHistoryCount);assert.equal(history.md5,manifest.baselineHistoryMd5);
  const expected=JSON.parse(fs.readFileSync('docs/staging/preflight-20261027-1504/evidence.json')).fingerprintComparison;
  assert.equal(expected.length,13);
  for(const item of expected){
   const actual=(await client.query('SELECT md5(pg_get_functiondef(oid)) value,pg_get_userbyid(proowner) owner FROM pg_proc WHERE oid=to_regprocedure($1)',[item.signature])).rows[0];
   assert.equal(actual?.value,item.expected);assert.equal(actual.owner,'postgres');
  }
  assert.equal((await client.query('SELECT count(*)::int n FROM private.gateway_settings WHERE enabled')).rows[0].n,0);
  const snapshot=(await client.query('SELECT pg_export_snapshot() id')).rows[0].id;
  assert.match(snapshot,/^[A-Fa-f0-9-]+$/);
  const times=(await client.query('SELECT transaction_timestamp() started,clock_timestamp() exported')).rows[0];
  const source=await capture(client,root,'source');
  const roleConnection=connection.filter(a=>!a.startsWith('--dbname='));
  await run(root,PG+'pg_dumpall',[...roleConnection,'--dbname=dbname=postgres','--database=postgres','--roles-only','--no-role-passwords',`--file=${root}/roles.sql`],{env:childEnv,signal:controller.signal});
  // Full staging database: no silent managed-schema or failed-table exclusions.
  await run(root,PG+'pg_dump',[...connection,'--format=custom',`--snapshot=${snapshot}`,'--lock-wait-timeout=5s',`--file=${root}/database.dump`],{env:childEnv,signal:controller.signal});
  await run(root,PG+'pg_restore',['--list',`--file=${root}/archive.toc`,`${root}/database.dump`]);
  // Independent read-only snapshot detects observed role/catalog/sequence drift.
  const after=new Client({host,user,password,database:'postgres',port:5432,ssl:{ca,rejectUnauthorized:true},options,connectionTimeoutMillis:15000});
  after.on('error',()=>{});
  try{await after.connect();await after.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const catalog=(await after.query(fs.readFileSync('checks/staging-backup-catalog.sql','utf8'))).rows.map(r=>Object.values(r)[0]);
   compareRows(source.catalog,catalog);
   const sequenceQuery=fs.readFileSync('checks/staging-backup-data.sql','utf8').split(/^\\gexec\s*$/m)[1].replace(/^--.*$/gm,'').trim();
   const sequences=[];
   for(const generated of (await after.query(sequenceQuery)).rows)sequences.push(Object.values((await after.query(Object.values(generated)[0])).rows[0])[0]);
   compareRows(source.rows.filter(r=>r.kind==='sequence'),sequences);await after.query('ROLLBACK');
  }finally{await after.end();}
  assert.ok(performance.now()-started<300000,'Export snapshot exceeded five-minute limit');
  assert.equal(sourceDisconnected,false);
  await client.query('ROLLBACK');
  const files=['database.dump','roles.sql','archive.toc','source-catalog.json','source-data.json'];
  write(root,'manifest.json',{project:PROJECT,files:files.map(name=>({name,sha256:sha(fs.readFileSync(path.join(root,name)))}))});
  report(root,{exportComplete:true,sourceTransactionStartedUtc:times.started.toISOString(),snapshotExportedUtc:times.exported.toISOString(),exportDurationMs:Math.round(performance.now()-started)});
 }finally{
  clearTimeout(snapshotTimer);
  await client.end().catch(()=>{});
  for(const file of [passPath,caPath])if(fs.existsSync(file))fs.unlinkSync(file);
 }
}
async function restore(root,container,database){
 marker(root);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'result.json'))).exportComplete,true);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
 for(const item of manifest.files)assert.equal(sha(fs.readFileSync(path.join(root,item.name))),item.sha256);
 const started=performance.now();
 try{
  await run(root,'docker',['pull',process.env.OB_RESTORE_IMAGE]);
  await run(root,'docker',['run','--detach','--name',container,'--user','0:0','--network','none','--pids-limit','512','--entrypoint','/bin/bash',process.env.OB_RESTORE_IMAGE,'-c','sleep infinity']);
  await run(root,'docker',['exec',container,'mkdir','-p','/input','/verification']);
  for(const name of ['database.dump','roles.sql'])await run(root,'docker',['cp',path.join(root,name),container+':/input/'+name]);
  for(const name of ['staging-backup-catalog.sql','staging-backup-data.sql','staging-restored-permissions.sql'])await run(root,'docker',['cp','checks/'+name,container+':/verification/'+name]);
  await run(root,'docker',['cp','checks/cloud/restore-staging-backup.sh',container+':/verification/restore.sh']);
  await run(root,'docker',['exec',container,'bash','/verification/restore.sh',database],{timeout:600000});
  for(const name of ['restored-catalog.jsonl','restored-data.jsonl','restore-duration-ms.txt','postgres-version.txt'])await run(root,'docker',['cp',container+':/restore/'+name,path.join(root,name)]);
  const lines=name=>fs.readFileSync(path.join(root,name),'utf8').split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));
  compareRows(JSON.parse(fs.readFileSync(path.join(root,'source-catalog.json'))),lines('restored-catalog.jsonl'));
  compareRows(JSON.parse(fs.readFileSync(path.join(root,'source-data.json'))),lines('restored-data.jsonl'));
  const elapsed=Number(fs.readFileSync(path.join(root,'restore-duration-ms.txt'),'utf8'));
  assert.ok(Number.isFinite(elapsed)&&elapsed>=0);
  report(root,{restoreVerified:true,restoreServerVersion:fs.readFileSync(path.join(root,'postgres-version.txt'),'utf8').trim(),restoreDurationMs:elapsed,endToEndRestoreVerificationMs:Math.round(performance.now()-started)});
 }catch{report(root,{restoreVerified:false,restoreAttemptDurationMs:Math.round(performance.now()-started)});throw new Error('Isolated restore verification failed');}
 finally{
  // Keep error diagnostics encrypted too; never print data-bearing COPY errors.
  for(const name of ['archive.log','roles.log','init.log','permissions.log'])await run(root,'docker',['cp',container+':/restore/'+name,path.join(root,'restore-'+name)]).catch(()=>{});
  await run(root,'docker',['rm','--force',container]).catch(()=>{});
 }
}
async function encrypt(root,cipher){
 marker(root);
 for(const file of ['source.pgpass','source-ca.pem'])assert.equal(fs.existsSync(path.join(root,file)),false);
 const manifestPath=path.join(root,'manifest.json');
 if(fs.existsSync(manifestPath))for(const item of JSON.parse(fs.readFileSync(manifestPath)).files)assert.equal(sha(fs.readFileSync(path.join(root,item.name))),item.sha256);
 const tar=path.join(root,'private-bundle.tar');
 const members=fs.readdirSync(root).filter(n=>n!=='private-bundle.tar');
 assert.ok(members.every(n=>fs.lstatSync(path.join(root,n)).isFile()));
 await run(root,'tar',['-cf',tar,'-C',root,...members]);
 await run(root,'age',['--recipient',process.env.OB_AGE_RECIPIENT,'--output',cipher,tar]);
 fs.writeFileSync(cipher+'.sha256',sha(fs.readFileSync(cipher))+'  '+path.basename(cipher)+'\n',{mode:0o600});
 fs.appendFileSync(process.env.GITHUB_OUTPUT,`ciphertext=${cipher}\nciphertext_hash=${cipher}.sha256\n`);
 console.log('Encrypted artifact prepared; inspect encrypted result.json for verified scope. No plaintext uploaded.');
}
async function main(action){
 assert.equal(process.platform,'linux','Cloud runner only');
 process.umask(0o077);
 if(action!=='cleanup')validateScope(process.env);
 const {root,cipher,container,database}=locations();
 if(action==='allocate'){
  validateScope(process.env);process.umask(0o077);fs.mkdirSync(root,{mode:0o700});
  write(root,'marker.json',{project:PROJECT});report(root);return;
 }
 marker(root);
 if(action==='export')await exportStaging(root);
 else if(action==='restore')await restore(root,container,database);
 else if(action==='encrypt')await encrypt(root,cipher);
 else if(action==='cleanup'){
  await run(root,'docker',['rm','--force',container]).catch(()=>{});
  fs.rmSync(root,{recursive:true,force:false});
  for(const file of [cipher,cipher+'.sha256'])if(fs.existsSync(file))fs.unlinkSync(file);
 }else throw new Error('Unknown action');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main(process.argv[2]).catch(()=>{console.error('Staging backup step failed closed. No secret or database error payload printed.');process.exitCode=1;});
}
