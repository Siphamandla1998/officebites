// Native local cold-copy drill. No hosted DSN, arbitrary directory or activation.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
assert.ok(!process.env.DATABASE_URL&&!process.env.PGHOST&&!process.env.PGPORT,'Database overrides forbidden');
const pre=JSON.parse(fs.readFileSync('docs/release/staging-cold-restore-preimage.json','utf8'));
assert.equal(pre.syntheticOnly,true);assert.match(pre.database,/^officebites_staging_disposable_[0-9]+$/);
const source=path.resolve(root,'.officebites-local/pg-release-owner-data'),restore=path.resolve(root,'.officebites-local/pg-staging-recovery-copy-20261027');
for(const target of [source,restore])assert.ok(target.startsWith(path.join(root,'.officebites-local')+path.sep));
assert.equal(fs.existsSync(restore),false,'Refuse to overwrite an existing recovery copy');
assert.equal(fs.readdirSync(path.join(source,'pg_tblspc')).length,0,'External tablespaces forbidden');
const require=createRequire(path.resolve(root,'../../../.officebites-local/native-runtime/package.json'));const {Client}=require('pg');
const proof=new Client({host:'127.0.0.1',port:55441,user:'release_native_bootstrap',password:'',database:pre.database,ssl:false,options:'',connectionTimeoutMillis:5000});
await proof.connect();try{assert.equal((await proof.query("SELECT current_database()||'|'||replace(lower(current_setting('data_directory')),chr(92),'/')||'|'||host(inet_server_addr()) value")).rows[0].value,pre.database+'|'+source.replaceAll('\\','/').toLowerCase()+'|127.0.0.1');}finally{await proof.end();}
const ctl=path.resolve(root,'../../../.officebites-local/native-runtime/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe');
function run(command,args){const r=spawnSync(command,args,{cwd:root,stdio:'inherit',env:process.env});if(r.error)throw r.error;if(r.status!==0)throw Error('Local recovery command failed: '+path.basename(command));}
run(ctl,['stop','-D',source,'-m','fast','-w','-t','30']);
fs.cpSync(source,restore,{recursive:true,errorOnExist:true,force:false,dereference:false});
try{run(ctl,['start','-D',restore,'-l',path.join(root,'.officebites-local/pg-staging-restore.log'),'-o','-h 127.0.0.1 -p 55442','-w','-t','30']);run(process.execPath,['checks/verify-staging-cold-restore.mjs']);}
finally{run(ctl,['stop','-D',restore,'-m','fast','-w','-t','30']);}
