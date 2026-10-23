// Fixed loopback test target; no hosted URL, credentials or environment fallback.
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(path.resolve('.officebites-local/native-runtime/package.json'));
const {Client,types}=require('pg');
types.setTypeParser(20,Number);
export async function localNativeClient() {
 const client=new Client({host:'127.0.0.1',port:55432,database:'officebites_local_atomic',user:'postgres',connectionTimeoutMillis:5000});
 await client.connect();
 const result=await client.query("SELECT current_database() db,host(inet_server_addr()) host,current_setting('data_directory') dir");
 if(result.rows[0].db!=='officebites_local_atomic'||result.rows[0].host!=='127.0.0.1'||path.resolve(result.rows[0].dir).toLowerCase()!==path.resolve('.officebites-local/pg-atomic-data').toLowerCase()){await client.end();throw new Error('Local test target mismatch');}
 // The fixture's structured parameters are JSONB. node-postgres otherwise turns
 // JS arrays into PostgreSQL array literals instead of JSON (unlike PGlite).
 return {query:(sql,args=[])=>client.query(sql,args.map(value=>Array.isArray(value)?JSON.stringify(value):value)),exec:sql=>client.query(sql),close:()=>client.end()};
}
