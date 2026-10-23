// OFFLINE ONLY: writes review artifacts; never contacts a service or installs SQL.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const project='eyhmarmekioovcjibcbr';
const out='supabase/staging-release/20261023';
const sources=['checks/uat/staging-security.sql','checks/pilot/booking-candidate.sql','checks/pilot/atomic-collection-candidate.sql','checks/pilot/assisted-cash-candidate.sql','checks/pilot/cash-custody-candidate.sql'];
const hash=s=>createHash('sha256').update(s).digest('hex');
if(process.argv.includes('--verify')){
 const m=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
 if(m.project!==project)throw Error('Wrong target');
 for(const f of m.files)if(hash(fs.readFileSync(path.join(out,f.file)))!==f.sha256)throw Error('Package hash changed: '+f.file);
 for(const f of m.sourceFiles)if(hash(fs.readFileSync(f.file))!==f.sha256)throw Error('Source hash changed: '+f.file);
 const request=JSON.parse(fs.readFileSync(path.join(out,'apply-migration-request.json'),'utf8'));
 if(request.arguments.project_id!==project||request.arguments.query!==fs.readFileSync(path.join(out,'install.sql'),'utf8')||request.arguments.name!==m.migrationName)throw Error('Apply request mismatch');
 console.log('OFFLINE package/source/target/request checks passed; no service contacted');process.exit(0);
}
const targetGuard=`DO $$ BEGIN IF current_setting('officebites.verified_project_ref',true) IS DISTINCT FROM '${project}' THEN RAISE EXCEPTION 'Verified staging target required';END IF;END $$;`;
const definitions=[
 ['private.active_account()','5bda4a148d4f52474014f31f90b49cdf'],
 ['public.admin_manual_settings(boolean,boolean,integer,numeric,text)','7c0a398be18ece9e1940840fe692ea6c'],
 ['public.cancel_unpaid_order(uuid,text,text)','6a52338e78c097c55bb8721bbcf451fe'],
 ['public.create_manual_order(uuid,text,text,text,date,text,jsonb,uuid,text,uuid)','c4dc553530f2998f26e91475b7503a5e'],
 ['private.create_order_core(uuid,text,text,text,date,text,jsonb)','d66dff3346ea0241a989a2c060227236'],
 ['private.create_order_with_delivery(uuid,text,text,text,date,text,jsonb,uuid)','36d73e384b63626498cbe054c1d5da31'],
 ['public.get_vendor_manual_methods(uuid)','52ac2c375a04a31aa46470456260c929'],
 ['public.order_to_json(public.orders)','1185d494ac41ab09d2b83f3e263582cd'],
 ['public.record_manual_refund_status(uuid,text,numeric,numeric,text)','7996f9c65a3cf770c3eb91f7a2b650a2'],
 ['public.verify_manual_payment(uuid,numeric,text,boolean)','c35b9e7c3fecb979f70c81cda16938cb'],
];
const acls=[
 '{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres}',
 '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}',
 '{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}',
 '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres,anon=X/postgres}',
 '{postgres=X/postgres}','{postgres=X/postgres}',
 '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres,anon=X/postgres}',
 '{postgres=X/postgres,service_role=X/postgres}',
 '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}',
 '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}',
];
const values=definitions.map(([s,h],i)=>`('${s}','${h}','${acls[i]}')`).join(',');
const preflight=`-- Read-only baseline assertion; use the verified staging connection only.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM (VALUES ${values}) x(signature,digest,acl) WHERE to_regprocedure(signature) IS NULL OR md5(pg_get_functiondef(to_regprocedure(signature)))<>digest OR (SELECT pg_get_userbyid(proowner)<>'postgres' OR proacl::text IS DISTINCT FROM x.acl FROM pg_proc WHERE oid=to_regprocedure(signature))) THEN RAISE EXCEPTION 'Baseline function/owner/ACL drift; stop and review';END IF;
 IF (SELECT count(*) FROM public.orders)<>15 OR (SELECT count(*) FROM public.order_suborders)<>15 OR (SELECT count(*) FROM public.order_items)<>15 OR (SELECT count(*) FROM private.manual_payment_events)<>18 OR (SELECT count(*) FROM private.manual_order_payments)<>0 OR (SELECT count(*) FROM private.vendor_payment_profiles)<>0 THEN RAISE EXCEPTION 'Baseline record counts changed';END IF;
 IF to_regclass('private.uat_security') IS NOT NULL OR to_regclass('private.pilot_policy') IS NOT NULL THEN RAISE EXCEPTION 'Partial or previous installation requires reconciliation';END IF;
 IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261021100655') THEN RAISE EXCEPTION 'Singleton migration dependency missing';END IF;
END $$;
`;
const locks=`DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled) THEN RAISE EXCEPTION 'Payment method enabled';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.manual_payment_settings WHERE singleton AND deadline_minutes=15 AND review_threshold=500) THEN RAISE EXCEPTION 'Settings baseline differs';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.delivery_settings WHERE NOT enabled AND paid_fee=15) THEN RAISE EXCEPTION 'Delivery baseline differs';END IF;
END $$;
`;
const post=`${locks}DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM private.uat_security WHERE expires_at IS NOT NULL OR capability_hash IS NOT NULL) THEN RAISE EXCEPTION 'UAT access window not closed';END IF;
 IF NOT EXISTS(SELECT 1 FROM private.pilot_policy WHERE singleton AND NOT enabled AND collection_fee=0) THEN RAISE EXCEPTION 'Collection unlocked or price differs';END IF;
 IF EXISTS(SELECT 1 FROM private.collection_activation WHERE eft_until IS NOT NULL) OR EXISTS(SELECT 1 FROM private.assisted_controls WHERE assisted_until IS NOT NULL OR cash_until IS NOT NULL OR requests_until IS NOT NULL) OR EXISTS(SELECT 1 FROM private.cash_custody_policy WHERE admin_cash_until IS NOT NULL OR partial_handovers OR bank_handovers) THEN RAISE EXCEPTION 'Entry lock not closed';END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN('private.cash_events'::regclass,'private.cash_handovers'::regclass,'private.manual_order_payments'::regclass,'private.uat_security'::regclass) AND (NOT relrowsecurity OR has_table_privilege('anon',oid,'SELECT') OR has_table_privilege('authenticated',oid,'UPDATE'))) THEN RAISE EXCEPTION 'Direct financial/security privilege violation';END IF;
 IF has_function_privilege('anon','public.create_assisted_order(uuid,jsonb,jsonb,uuid,uuid,bigint,bigint,text,uuid,numeric,text,text,text)','EXECUTE') OR has_function_privilege('authenticated','private.uat_send_email(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'RPC privilege violation';END IF;
END $$;
`;
// Exclude only the newly added order_source column when comparing historical rows.
const fingerprint=`SELECT md5(jsonb_build_array(
 (SELECT jsonb_agg(to_jsonb(o)-'order_source' ORDER BY id) FROM public.orders o),
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
 (SELECT jsonb_agg(to_jsonb(o) ORDER BY to_jsonb(o)::text) FROM private.acquisition_ledger o)
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
SELECT pg_advisory_xact_lock(hashtextextended('officebites-staging-install-20261023',0));
SELECT set_config('officebites.verified_project_ref','${project}',true);
${locks}
DO $package$ DECLARE original text; restored text; functions jsonb; recorded jsonb; digest text; BEGIN
 IF to_regclass('private.officebites_release_installations') IS NOT NULL THEN
  EXECUTE 'SELECT payload_sha256,functions FROM private.officebites_release_installations WHERE name=$1' INTO digest,recorded USING 'officebites_20261023';
  IF digest IS DISTINCT FROM '${payloadHash}' THEN RAISE EXCEPTION 'Different or partial package installed';END IF;
  ${catalog} INTO functions;
  IF functions IS DISTINCT FROM recorded THEN RAISE EXCEPTION 'Installed function/ACL drift';END IF;
  RETURN;
 END IF;
 EXECUTE $baseline$${preflight}$baseline$;
 LOCK TABLE public.orders,public.order_suborders,public.order_items,public.profiles,public.vendors,private.manual_receivables,private.manual_receivable_entries,private.manual_payment_events,private.manual_order_payments,private.vendor_payment_profiles,private.payment_attempts,private.ozow_attempts,private.standard_fee_ledger,private.acquisition_ledger,private.gateway_settings,private.manual_payment_settings IN SHARE ROW EXCLUSIVE MODE;
 ${fingerprint} INTO original;
 EXECUTE $release_sql$${payload}$release_sql$;
 ${fingerprint} INTO restored;
 IF original IS DISTINCT FROM restored THEN RAISE EXCEPTION 'Historical financial/order data changed';END IF;
 CREATE TABLE private.officebites_release_installations(name text PRIMARY KEY,payload_sha256 text NOT NULL,functions jsonb NOT NULL,historical_fingerprint text NOT NULL,installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
 ALTER TABLE private.officebites_release_installations ENABLE ROW LEVEL SECURITY;
 REVOKE ALL ON private.officebites_release_installations FROM PUBLIC,anon,authenticated,service_role;
 ${catalog} INTO functions;
 INSERT INTO private.officebites_release_installations(name,payload_sha256,functions,historical_fingerprint) VALUES('officebites_20261023','${payloadHash}',functions,original);
END $package$;
${post}`;
const recovery=`-- Forward containment only, separate approval required; never restores no-hook Auth delivery.
${targetGuard}
DO $$ BEGIN IF to_regclass('private.officebites_release_installations') IS NULL THEN RAISE EXCEPTION 'Unrecognised installation';END IF;END $$;
UPDATE private.collection_activation SET eft_until=NULL WHERE singleton;
UPDATE private.assisted_controls SET assisted_until=NULL,cash_until=NULL,requests_until=NULL WHERE singleton;
UPDATE private.cash_custody_policy SET admin_cash_until=NULL,partial_handovers=false,bank_handovers=false WHERE singleton;
UPDATE private.uat_security SET expires_at=NULL,capability_hash=NULL WHERE singleton;
-- Do not mutate gateway/audit history through direct SQL. If a gateway is enabled,
-- the lock assertion stops; use a separately approved authenticated admin restoration.
${post}`;
fs.mkdirSync(out,{recursive:true});
const indexRepair=`-- Narrow, repeatable forward repair only. Separate incident approval required.
${targetGuard}
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM private.officebites_release_installations WHERE name='officebites_20261023' AND payload_sha256='${payloadHash}') THEN RAISE EXCEPTION 'Unrecognised package';END IF;END $$;
CREATE INDEX IF NOT EXISTS cash_order_events ON private.cash_events(order_id);
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indexrelid='private.cash_order_events'::regclass AND i.indrelid='private.cash_events'::regclass AND i.indisvalid AND pg_get_indexdef(i.indexrelid,1,true)='order_id') THEN RAISE EXCEPTION 'Cash index differs; manual review required';END IF;END $$;
${post}`;
const files={'preflight.sql':preflight+locks,'install.sql':install,'post-install.sql':post,'forward-containment.sql':recovery,'repair-cash-index.sql':indexRepair,'post-recovery.sql':post};
for(const [name,sql]of Object.entries(files))fs.writeFileSync(path.join(out,name),sql);
const manifest={project,previewProject:'prj_bGDTykMMQufLAJ2CkjvnOAq4KQ71',migrationName:'officebites_staging_locked_release_20261023',payloadSha256:payloadHash,notApproved:true,sourceFiles:rows.map(({file,sha256})=>({file,sha256})),files:Object.entries(files).map(([file,sql])=>({file,sha256:hash(sql)}))};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(out,'apply-migration-request.json'),JSON.stringify({tool:'supabase.apply_migration',arguments:{project_id:project,name:manifest.migrationName,query:install}},null,2)+'\n');
console.log(JSON.stringify({offlineOnly:true,output:out,files:manifest.files},null,2));
