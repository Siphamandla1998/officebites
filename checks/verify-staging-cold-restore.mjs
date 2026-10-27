import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {digests} from './native-staging-recovery.mjs';
assert.ok(!process.env.DATABASE_URL&&!process.env.PGHOST&&!process.env.PGPORT,'Database overrides forbidden');
const pre=JSON.parse(fs.readFileSync('docs/release/staging-cold-restore-preimage.json','utf8'));
assert.equal(pre.syntheticOnly,true);assert.match(pre.database,/^officebites_staging_disposable_[0-9]+$/);
assert.equal(pre.restorePort,55442);assert.equal(pre.restoreDataDirectory,'.officebites-local/pg-staging-recovery-copy-20261027');
const require=createRequire(path.resolve('../../../.officebites-local/native-runtime/package.json'));const {Client}=require('pg');
const client=new Client({host:'127.0.0.1',port:55442,user:'postgres',password:'',database:pre.database,ssl:false,options:'',connectionTimeoutMillis:5000});
await client.connect();
try{
 const expected=pre.database+'|'+path.resolve(pre.restoreDataDirectory).replaceAll('\\','/').toLowerCase()+'|127.0.0.1';
 assert.equal((await client.query('SELECT public.native_fixture_identity() value')).rows[0].value,expected,'Restored disposable identity mismatch');
 await client.query('BEGIN READ ONLY');
 const restored=await digests((sql,args)=>client.query(sql,args));assert.deepEqual(restored,pre.tables);
 const flags=(await client.query('SELECT bool_and(NOT enabled) closed FROM private.gateway_settings')).rows[0].closed;assert.equal(flags,true);
 assert.equal((await client.query("SELECT count(*)::integer n FROM supabase_migrations.schema_migrations")).rows[0].n,56);
 await client.query('COMMIT');
 fs.writeFileSync('docs/release/staging-cold-restore-result.json',JSON.stringify({observedUtc:new Date().toISOString(),result:'passed',tablesCompared:restored.length,allCountsAndDigestsMatch:true,closedPaymentFlags:true,historyCount:56,type:'cold physical clone of disposable native PostgreSQL only',notVerified:'Hosted backup/PITR, RPO/RTO, Storage bytes, Auth/provider/Vercel configuration'},null,2));
 console.log('Restored disposable cluster: '+restored.length+' table counts/digests identical; flags closed; history preserved.');
}finally{await client.end();}
