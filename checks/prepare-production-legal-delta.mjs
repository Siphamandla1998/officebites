import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
const transactionBody=s=>s.replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'');
const parts=['-- LOCAL REVIEW ONLY. Minimum foundation prerequisite; all rollout states must remain OFF.\nBEGIN; SET LOCAL lock_timeout=\'5s\'; SET LOCAL statement_timeout=\'90s\';'];
parts.push(`DO $$ BEGIN IF current_user<>'postgres' OR (SELECT count(*) FROM supabase_migrations.schema_migrations)<>40
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261027112327' AND name='production_minimum_manual_legal_foundation')
 THEN RAISE EXCEPTION 'Recorded production minimum foundation prerequisite required'; END IF; END $$;`);
parts.push(transactionBody(read('release/source-candidates/payment/20261021094956_fix_admin_manual_settings_singleton.sql')));
let storagePolicies;
for(const name of fs.readdirSync('release/source-candidates/legal').filter(n=>n.endsWith('.sql')).sort()) {
 let source=read('release/source-candidates/legal/'+name);
 if(name.includes('phase_d_')){
  const start=source.indexOf('INSERT INTO storage.buckets'),end=source.indexOf('CREATE FUNCTION private.reserve_vendor_evidence');
  if(start<0||end<start)throw new Error('Phase D managed Storage boundary changed');
  storagePolicies=source.slice(start,end);source=source.slice(0,start)+source.slice(end);
 }
 parts.push('-- Source: '+name+'\n'+transactionBody(source));
}
parts.push(`-- Narrow managed-owner dependency for defining scoped Storage policies.
-- Does not grant table access, application admin privileges, role membership or BYPASSRLS.
GRANT USAGE ON SCHEMA private TO supabase_storage_admin;
GRANT EXECUTE ON FUNCTION private.compliance_storage_access(text,boolean) TO supabase_storage_admin;`);
const launchGuards=transactionBody(read('release/production-candidates/20261027094852_production_manual_legal_transition_guards.sql'));
if(!launchGuards.includes("AND status='approved' AND archived_at IS NULL"))throw new Error('Launch vendor prerequisite changed');
parts.push(launchGuards.replace("AND status='approved' AND archived_at IS NULL", "AND status='approved' AND archived_at IS NULL AND commission_rate=0.17"));
// Freeze the accepted fee basis at order creation; a later admin rate edit must
// not reprice an already issued manual instruction. No historical backfill.
parts.push(`ALTER TABLE private.manual_order_payments ADD COLUMN vendor_acceptance_id uuid REFERENCES private.vendor_legal_acceptances(id), ADD COLUMN fee_snapshot jsonb;
CREATE FUNCTION private.manual_contract_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rate numeric; receipt private.vendor_legal_acceptances%ROWTYPE;
BEGIN
 SELECT v.commission_rate INTO rate FROM public.vendors v WHERE v.id=NEW.vendor_id FOR SHARE;
 IF rate IS DISTINCT FROM 0.17 THEN RAISE EXCEPTION 'Reviewed 15 percent plus 2 percent launch fee basis required'; END IF;
 SELECT a.* INTO receipt FROM private.vendor_activation_reviews r JOIN private.vendor_legal_acceptances a ON a.id=r.acceptance_id
 JOIN public.vendors v ON v.id=r.vendor_id AND v.owner_id=r.owner_id
 WHERE r.vendor_id=NEW.vendor_id ORDER BY r.reviewed_at DESC,r.id DESC LIMIT 1;
 IF receipt.id IS NULL OR receipt.assignment_id IS NULL THEN RAISE EXCEPTION 'Assigned vendor contract receipt required'; END IF;
 NEW.vendor_acceptance_id:=receipt.id;
 NEW.fee_snapshot:=jsonb_build_object('platformRate',0.15,'transactionRate',0.02,'combinedRate',0.17,
 'feeVersion',receipt.documents->'vendor-fees'->>'version','scheduleHash',receipt.documents->'vendor-fees'->>'content_hash',
 'calculation','round(product subtotal * combinedRate, 2)','taxTreatment','unresolved; VAT not calculated','marketingEnabled',false);
 RETURN NEW;
END $$;
CREATE TRIGGER manual_contract_snapshot BEFORE INSERT ON private.manual_order_payments FOR EACH ROW EXECUTE FUNCTION private.manual_contract_snapshot();
CREATE TRIGGER manual_contract_immutable BEFORE UPDATE OF vendor_acceptance_id,fee_snapshot ON private.manual_order_payments FOR EACH ROW EXECUTE FUNCTION private.manual_immutable();
REVOKE ALL ON FUNCTION private.manual_contract_snapshot() FROM PUBLIC,anon,authenticated,service_role;`);
let paid=JSON.parse(read('docs/release/repair-production-functions.json')).find(f=>f.proname==='snapshot_paid_commission').definition;
const old='SELECT commission_rate,name INTO NEW.commission_rate_snapshot,NEW.vendor_name_snapshot FROM public.vendors WHERE id=NEW.vendor_id FOR SHARE;';
if(!paid.includes(old))throw new Error('Captured production commission trigger changed');
paid=paid.replace(old,`SELECT coalesce((m.fee_snapshot->>'combinedRate')::numeric,v.commission_rate),v.name INTO NEW.commission_rate_snapshot,NEW.vendor_name_snapshot
 FROM public.vendors v LEFT JOIN private.manual_order_payments m ON m.order_id=NEW.order_id WHERE v.id=NEW.vendor_id FOR SHARE OF v;`);
parts.push(paid+';');
let checked=read('release/source-candidates/payment/manual-settings-concurrency-candidate.sql');
const start=checked.indexOf(" IF current_setting('officebites.local_fixture'");
const end=checked.indexOf(" IF current_user<>'postgres'",start);
assert.ok(start>0&&end>start);
checked=checked.slice(0,start)+` IF to_regprocedure('private.vendor_launch_ready(uuid)') IS NULL OR to_regclass('private.order_legal_acceptances') IS NULL
 OR EXISTS(SELECT 1 FROM private.gateway_settings WHERE enabled)
 THEN RAISE EXCEPTION 'Closed production integrated foundation required'; END IF;
`+checked.slice(end);
parts.push(transactionBody(checked),'COMMIT;');
const name='20261027112437_production_checked_settings.sql';
const generated='supabase/migrations/'+name, output='release/production-candidates/'+name;
assert.ok(fs.existsSync(generated)||fs.existsSync(output));
fs.writeFileSync(output,parts.join('\n\n'));
if(fs.existsSync(generated)){assert.equal(read(generated).trim(),'');fs.unlinkSync(generated);}
console.log('Prepared integrated legal/compliance/checked-settings delta. No database access.');
const ownerName='20261027115843_production_compliance_storage_owner_policies.sql';
const ownerGenerated='supabase/migrations/'+ownerName,ownerOutput='release/production-candidates/'+ownerName;
assert.ok(fs.existsSync(ownerGenerated)||fs.existsSync(ownerOutput),'CLI-generated Storage-owner migration required');
assert.ok(storagePolicies);
fs.writeFileSync(ownerOutput,`-- LOCAL REVIEW ONLY. Separate managed Storage-owner executor required.
-- Ordinary application postgres MUST NOT acquire managed-role membership to run this.
-- Apply after the recorded three application steps, with all rollout flags closed.
BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s';
DO $$ BEGIN
 IF current_user<>'supabase_storage_admin' OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='storage' AND c.relname='objects' AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND c.relrowsecurity)
 OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname='compliance_storage_access')
 THEN RAISE EXCEPTION 'Approved managed Storage-owner execution and installed compliance foundation required'; END IF;
END $$;
${storagePolicies}
COMMIT;
`);
if(fs.existsSync(ownerGenerated)){assert.equal(read(ownerGenerated).trim(),'');fs.unlinkSync(ownerGenerated);}
