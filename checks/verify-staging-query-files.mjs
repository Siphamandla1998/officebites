// Syntax and synthetic existing-account checks on the pre-verified disposable DB.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
assert.ok(!process.env.DATABASE_URL&&!process.env.PGHOST&&!process.env.PGPORT);
const pre=JSON.parse(fs.readFileSync('docs/release/staging-cold-restore-preimage.json','utf8'));assert.equal(pre.syntheticOnly,true);assert.match(pre.database,/^officebites_staging_disposable_[0-9]+$/);
const require=createRequire(path.resolve('../../../.officebites-local/native-runtime/package.json'));const {Client}=require('pg');const c=new Client({host:'127.0.0.1',port:55441,user:'postgres',password:'',database:pre.database,ssl:false,options:'',connectionTimeoutMillis:5000});await c.connect();
try{
 const expected=pre.database+'|'+path.resolve('.officebites-local/pg-release-owner-data').replaceAll('\\','/').toLowerCase()+'|127.0.0.1';assert.equal((await c.query('SELECT public.native_fixture_identity() value')).rows[0].value,expected);
 await c.query('BEGIN READ ONLY');
 for(const file of ['checks/staging-installation-preflight.sql','checks/staging-installation-postflight.sql','checks/she-cooks-existing-account-preflight.sql'])await c.query(fs.readFileSync(file,'utf8'));
 await c.query('COMMIT');
 await c.query('BEGIN');await c.query("UPDATE public.vendors SET name='SHE COOKS BY SNE' WHERE id='10000000-0000-4000-8000-000000000004'");
 const found=(await c.query(fs.readFileSync('checks/she-cooks-existing-account-preflight.sql','utf8'))).rows[0];assert.equal(Number(found.candidate_count),1);assert.equal(found.ownership_link_valid,true);assert.equal(found.one_vendor_per_owner,true);await c.query('ROLLBACK');
 fs.writeFileSync('docs/release/staging-query-file-tests.json',JSON.stringify({observedUtc:new Date().toISOString(),result:'passed',readOnlyQueryFiles:3,syntheticExistingVendorLink:true,realVendorLookupPerformed:false},null,2));console.log('Three operator query files passed; synthetic existing-vendor match preserves one account. No hosted SQL.');
}finally{await c.end();}
