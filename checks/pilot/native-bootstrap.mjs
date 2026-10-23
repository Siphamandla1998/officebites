import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(path.resolve('.officebites-local/native-runtime/package.json'));
const {Client}=require('pg');
const c=new Client({host:'127.0.0.1',port:55432,user:'postgres',database:'postgres',connectionTimeoutMillis:5000});
try {
 await c.connect();
 const identity=await c.query("SELECT current_setting('data_directory') dir");
 if(path.resolve(identity.rows[0].dir).toLowerCase()!==path.resolve('.officebites-local/pg-atomic-data').toLowerCase())throw new Error('Not the disposable workspace test cluster');
 if(process.argv.includes('--reset')){
  await c.query('DROP DATABASE IF EXISTS officebites_local_atomic WITH (FORCE)');
  await c.query('DROP ROLE IF EXISTS anon,authenticated,service_role,authenticator,supabase_auth_admin,uat_recovery_owner');
 }
 const {rows}=await c.query("SELECT 1 FROM pg_database WHERE datname='officebites_local_atomic'");
 if(!rows.length)await c.query('CREATE DATABASE officebites_local_atomic');
 console.log('Disposable loopback test database prepared');
}finally{await c.end();}
