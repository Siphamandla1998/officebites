// OFFLINE ONLY: writes review artifacts; never contacts a service or installs SQL.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const project='eyhmarmekioovcjibcbr';
const out='supabase/staging-release/20261026-eft';
const builderPath='checks/uat/prepare-eft-installation-package.mjs';
const baselinePath='checks/uat/fixtures/eft-staging-baseline-20261026.json';
function rejectLinks(relative){
 let current=process.cwd();for(const part of relative.split('/')){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Linked package path rejected: '+relative);}
}
for(const file of [out,baselinePath,builderPath,'checks/uat/staging-security.sql','checks/pilot/booking-candidate.sql','checks/pilot/atomic-collection-candidate.sql'])rejectLinks(file);
const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
if(baseline.project!==project || baseline.gatewayFlags.some(g=>g.enabled))throw Error('Wrong or unlocked baseline');
const sources=['checks/uat/staging-security.sql','checks/pilot/booking-candidate.sql','checks/pilot/atomic-collection-candidate.sql'];
const hash=s=>createHash('sha256').update(s).digest('hex');
if(process.argv.includes('--verify')){
 const m=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
 if(m.builderSha256!==hash(fs.readFileSync(builderPath)))throw Error('Builder changed');
 if(m.project!==project)throw Error('Wrong target');
 for(const f of m.files){if(path.basename(f.file)!==f.file)throw Error('Invalid package path');rejectLinks(out+'/'+f.file);}
 for(const f of m.files)if(hash(fs.readFileSync(path.join(out,f.file)))!==f.sha256)throw Error('Package hash changed: '+f.file);
 for(const f of m.sourceFiles)if(hash(fs.readFileSync(f.file))!==f.sha256)throw Error('Source hash changed: '+f.file);
 const request=JSON.parse(fs.readFileSync(path.join(out,'apply-migration-request.json'),'utf8'));
 if(request.arguments.project_id!==project||request.arguments.query!==fs.readFileSync(path.join(out,'install.sql'),'utf8')||request.arguments.name!==m.migrationName)throw Error('Apply request mismatch');
 if(m.baselineSha256!==hash(fs.readFileSync(baselinePath)))throw Error('Baseline changed');
 console.log('OFFLINE EFT package/source/baseline/target/request checks passed; no service contacted');process.exit(0);
}
const targetGuard=`DO $$ BEGIN IF current_setting('officebites.verified_project_ref',true) IS DISTINCT FROM '${project}' THEN RAISE EXCEPTION 'Verified staging target required';END IF;END $$;`;

const capture=String.raw`SELECT jsonb_build_object(
'gatewayFlags',(SELECT jsonb_agg(jsonb_build_object('provider',provider,'enabled',enabled,'ready',ready,'maintenance',maintenance) ORDER BY provider) FROM private.gateway_settings),
'manual',(SELECT jsonb_build_object('minutes',deadline_minutes,'threshold',review_threshold) FROM private.manual_payment_settings WHERE singleton),
'delivery',(SELECT jsonb_build_object('enabled',enabled,'fee',paid_fee,'revision',revision) FROM private.delivery_settings),
'functions',(SELECT jsonb_agg(jsonb_build_object('signature',n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')','owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'md5',md5(pg_get_functiondef(p.oid)),'securityDefiner',p.prosecdef,'config',p.proconfig) ORDER BY n.nspname,p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prokind='f' AND ((n.nspname='private' AND p.proname IN('active_account','create_order_core','create_order_with_delivery')) OR(n.nspname='public' AND p.proname IN('admin_manual_settings','cancel_unpaid_order','create_manual_order','get_vendor_manual_methods','order_to_json','record_manual_refund_status','verify_manual_payment')))),
 'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'rls',c.relrowsecurity,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='private' AND c.relname IN('gateway_settings','manual_payment_settings','vendor_payment_profiles','manual_order_payments')) OR(n.nspname='public' AND c.relname IN('orders','profiles','vendors'))),
 'counts',jsonb_build_object('orders',(SELECT count(*) FROM public.orders),'suborders',(SELECT count(*) FROM public.order_suborders),'items',(SELECT count(*) FROM public.order_items),'manualEvents',(SELECT count(*) FROM private.manual_payment_events),'manualPayments',(SELECT count(*) FROM private.manual_order_payments),'bankProfiles',(SELECT count(*) FROM private.vendor_payment_profiles)))`;
const baselineLiteral='$eft_baseline$'+JSON.stringify(baseline)+'$eft_baseline$::jsonb';
const settings=`SELECT jsonb_build_object('gatewayFlags',(SELECT jsonb_agg(jsonb_build_object('provider',provider,'enabled',enabled,'ready',ready,'maintenance',maintenance) ORDER BY provider) FROM private.gateway_settings),'manual',(SELECT jsonb_build_object('minutes',deadline_minutes,'threshold',review_threshold) FROM private.manual_payment_settings WHERE singleton),'delivery',(SELECT jsonb_build_object('enabled',enabled,'fee',paid_fee,'revision',revision) FROM private.delivery_settings))`;
const locks=`DO $$ DECLARE expected jsonb:=${baselineLiteral};actual jsonb; BEGIN
 ${settings} INTO actual;
 IF actual IS DISTINCT FROM jsonb_build_object('gatewayFlags',expected->'gatewayFlags','manual',expected->'manual','delivery',expected->'delivery') OR EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled) THEN RAISE EXCEPTION 'Payment/settings/ready/maintenance baseline drift; no changes authorised'; END IF;
END $$;`;
const preflight=`DO $$ DECLARE expected jsonb:=${baselineLiteral};actual jsonb;k text;BEGIN
 ${capture} INTO actual;
 FOREACH k IN ARRAY ARRAY['functions','tables','counts','gatewayFlags','manual','delivery'] LOOP
 IF actual->k IS DISTINCT FROM expected->k THEN RAISE EXCEPTION 'Baseline % drift; recapture and review, never bypass',k;END IF;END LOOP;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['private.uat_security','private.pilot_policy','private.officebites_release_installations','private.assisted_controls','private.vendor_activation_requirements','private.vendor_legal_assignments','private.vendor_compliance_events','private.order_legal_acceptances']) n WHERE to_regclass(n) IS NOT NULL) THEN RAISE EXCEPTION 'Partial/full/legal installation conflict; integrated review required';END IF;
 IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261020100740') OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261021100655') THEN RAISE EXCEPTION 'Hosted semantic migration dependency missing';END IF;
END $$;`;
const post=`${locks}DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.uat_security WHERE expires_at IS NOT NULL OR capability_hash IS NOT NULL) OR EXISTS(SELECT 1 FROM private.uat_actors) THEN RAISE EXCEPTION 'UAT actor/window not closed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.pilot_policy WHERE singleton AND NOT enabled AND collection_fee=0 AND NOT delivery_settlement_approved AND delivery_recipient IS NULL) OR EXISTS(SELECT 1 FROM private.collection_activation WHERE eft_until IS NOT NULL) THEN RAISE EXCEPTION 'Collection/settlement gate not closed';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='private' AND (c.relname LIKE 'pilot_%' OR c.relname LIKE 'collection_%' OR c.relname LIKE 'uat_%' OR c.relname='officebites_eft_release_installations') AND c.relkind='r' AND (NOT c.relrowsecurity OR pg_get_userbyid(c.relowner)<>'postgres' OR has_table_privilege('anon',c.oid,'SELECT') OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') OR has_table_privilege('service_role',c.oid,'SELECT,INSERT,UPDATE,DELETE'))) THEN RAISE EXCEPTION 'Private table/RLS/ACL violation';END IF;
 IF has_function_privilege('authenticated','private.uat_send_email(jsonb)','EXECUTE') OR has_function_privilege('anon','public.admin_collection_config(jsonb,bigint,uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'RPC privilege violation';END IF;
 IF to_regclass('private.assisted_controls') IS NOT NULL OR to_regclass('private.cash_custody_policy') IS NOT NULL THEN RAISE EXCEPTION 'Unexpected cash/assisted scope';END IF;
END $$;`;
// Compare every historical row and settings value without logging their contents.
const fingerprint=`SELECT md5(jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.orders o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.order_suborders o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.order_items o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY order_id) FROM private.manual_receivables o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM private.manual_receivable_entries o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM private.manual_payment_events o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.profiles o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM public.vendors o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY order_id) FROM private.manual_order_payments o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY id) FROM private.vendor_payment_profiles o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.payment_attempts o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.ozow_attempts o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.standard_fee_ledger o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.acquisition_ledger o),
 (SELECT to_jsonb(o) FROM private.manual_payment_settings o),
 (SELECT to_jsonb(o) FROM private.delivery_settings o),
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY provider) FROM private.gateway_settings o)
 )::text)`;
const rows=sources.map(file=>{const raw=fs.readFileSync(file,'utf8');let sql=raw.replace(/^\s*BEGIN;\s*$/gm,'').replace(/^\s*COMMIT;\s*$/gm,'');
 const guard=/DO \$\$\s*BEGIN[\s\S]*?END\s*\$\$;/;
 if(!guard.test(sql))throw Error('Missing guard: '+file);
 sql=sql.replace(guard,()=>targetGuard);
 if(sql.includes("current_setting('officebites.local_fixture'"))throw Error('Unconverted fixture guard');
 return {file,sha256:hash(raw),sql};});
const payload=rows.map(r=>`-- SOURCE ${r.file}\n${r.sql}`).join('\n');
const payloadHash=hash(payload+preflight+post+fingerprint+locks);
const catalog=`SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),md5(pg_get_functiondef(p.oid)),p.proowner,p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','private') AND p.prokind='f'`;
const install=`-- STAGING ONLY. Apply only as ONE approved Supabase apply_migration transaction.
-- The control-plane project_id MUST be ${project}. SQL settings alone do not prove target identity.
-- No Auth/REST/Vercel configuration, actor provisioning, activation or notifications are authorised by this file.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
SELECT pg_advisory_xact_lock(hashtextextended('officebites-staging-eft-install-20261026',0));
SELECT set_config('officebites.verified_project_ref','${project}',true);
${locks}
DO $package$ DECLARE original text; restored text; functions jsonb; recorded jsonb; digest text; BEGIN
 IF to_regclass('private.officebites_eft_release_installations') IS NOT NULL THEN
  EXECUTE 'SELECT payload_sha256,functions FROM private.officebites_eft_release_installations WHERE name=$1' INTO digest,recorded USING 'officebites_eft_20261026';
  IF digest IS DISTINCT FROM '${payloadHash}' THEN RAISE EXCEPTION 'Different or partial package installed';END IF;
  ${catalog} INTO functions;
  IF functions IS DISTINCT FROM recorded THEN RAISE EXCEPTION 'Installed function/ACL drift';END IF;
  RETURN;
 END IF;
 LOCK TABLE public.orders,public.order_suborders,public.order_items,public.profiles,public.vendors,private.manual_receivables,private.manual_receivable_entries,private.manual_payment_events,private.manual_order_payments,private.vendor_payment_profiles,private.payment_attempts,private.ozow_attempts,private.standard_fee_ledger,private.acquisition_ledger,private.gateway_settings,private.manual_payment_settings,private.delivery_settings IN SHARE ROW EXCLUSIVE MODE;
 EXECUTE $baseline$${preflight}$baseline$;
 ${fingerprint} INTO original;
 EXECUTE $release_sql$${payload}$release_sql$;
 ${fingerprint} INTO restored;
 IF original IS DISTINCT FROM restored THEN RAISE EXCEPTION 'Historical financial/order data changed';END IF;
 CREATE TABLE private.officebites_eft_release_installations(name text PRIMARY KEY,payload_sha256 text NOT NULL,functions jsonb NOT NULL,historical_fingerprint text NOT NULL,installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
 ALTER TABLE private.officebites_eft_release_installations ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON private.officebites_eft_release_installations FROM PUBLIC,anon,authenticated,service_role;
 CREATE TRIGGER eft_installation_immutable BEFORE UPDATE OR DELETE ON private.officebites_eft_release_installations FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();
 ${catalog} INTO functions;
 INSERT INTO private.officebites_eft_release_installations(name,payload_sha256,functions,historical_fingerprint) VALUES('officebites_eft_20261026','${payloadHash}',functions,original);
END $package$;
${post}`;
const containmentPost=post.replace(" OR EXISTS(SELECT 1 FROM private.uat_actors)",'');
const recovery=`-- Forward containment only, separate approval required; never restores no-hook Auth delivery.
${targetGuard}
DO $$ BEGIN IF to_regclass('private.officebites_eft_release_installations') IS NULL THEN RAISE EXCEPTION 'Unrecognised installation';END IF; IF NOT EXISTS(SELECT 1 FROM private.officebites_eft_release_installations WHERE name='officebites_eft_20261026' AND payload_sha256='${payloadHash}') THEN RAISE EXCEPTION 'Package identity mismatch';END IF;END $$;
${locks}
UPDATE private.collection_activation SET eft_until=NULL WHERE singleton;
UPDATE private.pilot_policy SET enabled=false WHERE singleton;
UPDATE private.uat_security SET expires_at=NULL,capability_hash=NULL WHERE singleton;
-- Do not mutate gateway/audit history through direct SQL. If a gateway is enabled,
-- the lock assertion stops; use a separately approved authenticated admin restoration.
${containmentPost}`;
fs.mkdirSync(out,{recursive:true});
const files={'preflight.sql':preflight+locks,'baseline-capture.sql':capture+';','readiness.sql':`-- SELECT only. Metadata comparison, not service attestation or permission.\nWITH actual AS (${capture}), expected AS (SELECT ${baselineLiteral} AS value) SELECT k AS check_name,actual.jsonb_build_object->k IS NOT DISTINCT FROM expected.value->k AS passed FROM actual,expected,unnest(ARRAY['functions','tables','counts','gatewayFlags','manual','delivery']) k;`,'install.sql':install,'post-install.sql':post,'forward-containment.sql':recovery,'post-recovery.sql':containmentPost};
for(const name of [...Object.keys(files),'manifest.json','apply-migration-request.json'])rejectLinks(out+'/'+name);
for(const [name,sql]of Object.entries(files))fs.writeFileSync(path.join(out,name),sql);
const manifest={project,builderSha256:hash(fs.readFileSync(builderPath)),previewProject:'prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71',migrationName:'officebites_staging_eft_locked_20261026',payloadSha256:payloadHash,notApproved:true,scope:"R0 customer-web EFT only; no assisted/cash/custody or B-E",baselineSha256:hash(fs.readFileSync(baselinePath)),externalBlockers:["effective REST/Auth/notification attestation","backup/maintenance acceptance","PayFast maintenance provenance","owner installation approval","pending banking/B-E integration and native transport"],sourceFiles:rows.map(({file,sha256})=>({file,sha256})),files:Object.entries(files).map(([file,sql])=>({file,sha256:hash(sql)}))};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(out,'apply-migration-request.json'),JSON.stringify({tool:'supabase.apply_migration',arguments:{project_id:project,name:manifest.migrationName,query:install}},null,2)+'\n');
console.log(JSON.stringify({offlineOnly:true,output:out,files:manifest.files},null,2));
