// Local composition ONLY. Uses retained hosted evidence; never connects to Supabase.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
const json=p=>JSON.parse(read(p));
const sha=s=>createHash('sha256').update(s).digest('hex');
const history=json('docs/release/repair-staging-history.json').migrations;
assert.equal(history.length,54);assert.equal(history.at(-1).version,'20261021100655');
const ledger=history.map(x=>x.version+':'+x.name).sort().join('\n');
const ledgerMd5=createHash('md5').update(ledger).digest('hex');
const captured=json('checks/reference-regressions/checks/uat/fixtures/eft-staging-baseline-20261026.json');
assert.equal(captured.project,'eyhmarmekioovcjibcbr');
const expected=[...captured.functions.map(f=>[f.signature,f.md5]),...Object.entries(json('docs/release/repair-final-history-check.json').find(r=>r.value?.project_id===captured.project).value.evidence[0].security_function_hashes).map(([n,h])=>['public.'+n+'()',h])];
const values=expected.map(([s,h])=>`('${s}','${h}')`).join(',\n');
const guard=`DO $staging_preimage$
DECLARE e record; actual text;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'Reviewed application postgres executor required'; END IF;
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>54
 OR (SELECT md5(string_agg(version||':'||coalesce(name,''),E'\\n' ORDER BY version)) FROM supabase_migrations.schema_migrations)<>'${ledgerMd5}'
 THEN RAISE EXCEPTION 'Staging 54-entry history changed; obtain a fresh preimage'; END IF;
 FOR e IN SELECT * FROM (VALUES ${values}) x(signature,hash) LOOP
  SELECT md5(pg_get_functiondef(to_regprocedure(e.signature))) INTO actual;
  IF actual IS DISTINCT FROM e.hash THEN RAISE EXCEPTION 'Staging function preimage changed: %',e.signature; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled)
 OR EXISTS(SELECT 1 FROM private.commercial_settings WHERE onboarding_enforced OR acquisition_enabled OR standard_breakdown_enabled)
 OR to_regclass('private.vendor_activation_requirements') IS NOT NULL
 OR to_regclass('private.vendor_legal_assignments') IS NOT NULL
 OR to_regclass('private.vendor_compliance_events') IS NOT NULL
 OR to_regclass('private.order_legal_acceptances') IS NOT NULL
 OR to_regprocedure('public.admin_manual_settings_checked(boolean,boolean,integer,numeric,text,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'Closed, pre-B-E staging prerequisites required; no flag change or partial-install retry'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','private') AND c.relkind IN('r','p','v') AND pg_get_userbyid(c.relowner)<>'postgres')
 THEN RAISE EXCEPTION 'Unexpected application object owner'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='storage.objects'::regclass AND relrowsecurity)
 THEN RAISE EXCEPTION 'Existing managed Storage RLS required'; END IF;
END $staging_preimage$;
REVOKE TRUNCATE,TRIGGER,REFERENCES ON ALL TABLES IN SCHEMA public,private FROM PUBLIC,anon,authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public,private REVOKE TRUNCATE,TRIGGER,REFERENCES ON TABLES FROM PUBLIC,anon,authenticated;
`;
const production=json('docs/release/production-migration-manifest.json');
for(const s of production.steps)assert.equal(sha(fs.readFileSync(s.file)),s.sha256,'Production source must remain frozen');
let source=read(production.steps[2].file);
const begin=source.indexOf('DO $$ BEGIN IF current_user'),end=source.indexOf('-- Source: 20261026073911');
assert.ok(begin>0&&end>begin);
// Reuse reviewed B-E/fee/checked-settings bodies, never production history or singleton replay.
source=source.slice(0,begin)+guard+'\n'+source.slice(end);
source=source.replace('Minimum foundation prerequisite','Captured staging foundation prerequisite');
source=source.replaceAll('Closed production integrated foundation','Closed staging integrated foundation');
const application='20261027123110_staging_integrated_vendor_legal_payments.sql';
const policy='20261027123115_staging_compliance_storage_policies.sql';
const d=read('release/source-candidates/legal/20261026101346_phase_d_vendor_compliance.sql');
const start=d.indexOf("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='vendor-compliance'");
const finish=d.indexOf('CREATE FUNCTION private.reserve_vendor_evidence');assert.ok(start>0&&finish>start);
const policies=`-- Supported policy-only executor: postgres via configured supautils delegation.
-- Fallback: provider-approved existing managed owner; no role/ownership escalation.
-- Bucket is created separately via approved Storage Dashboard/API, never direct metadata INSERT.
BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s';
DO $$ BEGIN
 IF current_user NOT IN('postgres','supabase_storage_admin') THEN RAISE EXCEPTION 'Approved policy executor required'; END IF;
 IF current_user='postgres' THEN
  IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='${application.slice(0,14)}' AND name='${application.slice(15,-4)}') THEN
   RAISE EXCEPTION 'Recorded staging application delta required'; END IF;
 END IF;
 IF to_regclass('private.vendor_compliance_events') IS NULL OR to_regprocedure('private.vendor_launch_ready(uuid)') IS NULL THEN RAISE EXCEPTION 'Integrated compliance foundation required'; END IF;
END $$;
${d.slice(start,finish)}
COMMIT;
`;
fs.mkdirSync('release/staging-candidates',{recursive:true});
const files=[[application,source],[policy,policies]];
for(const [name,sql] of files){
 const generated='supabase/migrations/'+name,output='release/staging-candidates/'+name;
 assert.ok(fs.existsSync(generated)||fs.existsSync(output),'CLI-generated migration filename required');
 fs.writeFileSync(output,sql);
 if(fs.existsSync(generated)){assert.equal(read(generated).trim(),'');fs.unlinkSync(generated);}
 // Exact forward new-version recording is atomic with DDL. No historic ledger edits.
 const tag='$artifact_'+sha(sql).slice(0,16)+'$';assert.ok(!sql.includes(tag));
 const record=`INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('${name.slice(0,14)}','${name.slice(15,-4)}',ARRAY[${tag}${sql}${tag}]);\nCOMMIT;`;
 assert.ok(sql.trimEnd().endsWith('COMMIT;'));
 const bundle=sql.trimEnd().slice(0,-7)+record;
 fs.writeFileSync('release/staging-candidates/'+name.replace('.sql','.installation.sql'),bundle);
}
fs.writeFileSync('docs/release/staging-installation-manifest.json',JSON.stringify({preparedUtc:new Date().toISOString(),target:captured.project,hostedSqlExecuted:false,evidenceFreshness:'Retained SQL captures only; refresh forbidden during this task',baselineHistoryCount:54,baselineHistoryMd5:ledgerMd5,baselineFunctionEvidence:captured.observedUtc,sourceProductionPackage:production.steps.map(s=>({file:s.file,sha256:s.sha256})),steps:files.map(([name,sql],i)=>({order:i+1,version:name.slice(0,14),name:name.slice(15,-4),sql:'release/staging-candidates/'+name,sha256:sha(sql),installationBundle:'release/staging-candidates/'+name.replace('.sql','.installation.sql'),bundleSha256:sha(read('release/staging-candidates/'+name.replace('.sql','.installation.sql'))),executor:i?'postgres with verified policy delegation; provider-managed owner only if separately supported':'postgres',requires:i?'Step 1 recorded; approved private bucket settings; supported policy execution':'Exact guarded 54-history/13-function preimage, rollout closed'})),expectedFinalHistoryCount:56,approvedForHostedInstallation:false,productionPackageApplicable:false},null,2));
console.log('Prepared staging-only application/policy SQL, atomic installation bundles and manifest. No hosted calls.');
