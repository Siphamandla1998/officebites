import fs from 'node:fs';
import assert from 'node:assert/strict';
export async function verifyInstallationPackage(db){
 const folder='supabase/staging-release/20261023/';let checks=0;
 const q=async(s,p=[])=>(await db.query(s,p)).rows[0];
 await db.exec("RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false)");
 const before=(await q("SELECT pg_get_functiondef('private.active_account()'::regprocedure) d")).d;
 const raw=fs.readFileSync(folder+'install.sql','utf8');
 await db.exec('BEGIN');
 await assert.rejects(()=>db.exec(raw),/Baseline|baseline|dependency/);checks++;
 await db.exec('ROLLBACK');
 // Only staging-baseline assertions differ in the synthetic local fixture.
 // All install DDL, lock assertions, fingerprints, retry checks and containment
 // use the generated package bytes. Never save this fixture variant as an installer.
 const local=raw.replace(/EXECUTE \$baseline\$[\s\S]*?\$baseline\$;/,()=>`IF to_regclass('private.pilot_policy') IS NOT NULL THEN RAISE EXCEPTION 'Local fixture not clean';END IF;`);
 await db.exec('BEGIN');
 try{
  await db.exec("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN;END IF;END $$;");
  await db.exec(local);checks++;
  await db.exec(local);checks++;
  assert.equal(Number((await q('SELECT count(*) n FROM private.officebites_release_installations')).n),1);checks++;
  await db.exec(fs.readFileSync(folder+'forward-containment.sql','utf8'));checks++;
  await db.exec(fs.readFileSync(folder+'post-recovery.sql','utf8'));checks++;
  await db.exec('DROP INDEX private.cash_order_events');
  await db.exec(fs.readFileSync(folder+'repair-cash-index.sql','utf8'));checks++;
  await db.exec(fs.readFileSync(folder+'repair-cash-index.sql','utf8'));checks++;
 }finally{await db.exec('ROLLBACK');}
 assert.equal((await q("SELECT pg_get_functiondef('private.active_account()'::regprocedure) d")).d,before);checks++;
 assert.equal((await q("SELECT to_regclass('private.officebites_release_installations') r")).r,null);checks++;
 console.log(`${checks} generated installation/retry/containment/rollback assertions passed in a disposable fixture; hosted baseline assertion substituted only for this local rehearsal.`);
}
