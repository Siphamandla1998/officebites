// Deterministic local composition. Never connects to any database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=n=>fs.readFileSync('release/source-candidates/payment/'+n,'utf8').replaceAll('\r\n','\n');
const legal=source('20261016094201_legal_corporate_framework.sql');
const recovery=source('20261016074256_checkout_recovery_mobile_delivery_gateways.sql');
const manual=source('20261020090841_vendor_direct_manual_payments.sql');
function fn(s,name){const start=s.search(new RegExp('CREATE(?: OR REPLACE)? FUNCTION '+name.replaceAll('.','\\.')+'\\('));assert.ok(start>=0,name);const opening=s.indexOf('$$',start),end=s.indexOf('$$;',opening+2);assert.ok(end>opening,name);return s.slice(start,end+3)+'\n';}
const between=(s,a,b)=>{assert.ok(s.includes(a)&&s.includes(b));return s.slice(s.indexOf(a),s.indexOf(b));};
const body=[];
body.push(`-- LOCAL REVIEW ONLY. Production delta; not staging replay. No activation or legal text.
BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='90s';
DO $$ BEGIN
 IF current_user<>'postgres' OR to_regclass('private.manual_order_payments') IS NOT NULL
 OR to_regprocedure('private.active_account()') IS NULL
 OR (SELECT count(*) FROM supabase_migrations.schema_migrations)<>39
 OR (SELECT max(version) FROM supabase_migrations.schema_migrations)<>'20261027093453'
 OR NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261027093453' AND name='production_launch_browser_grants')
 THEN RAISE EXCEPTION 'Captured production baseline required; stop on drift'; END IF;
END $$;
`);
body.push(fn(recovery,'public.valid_sa_mobile'));
body.push("REVOKE ALL ON FUNCTION public.valid_sa_mobile(text,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.valid_sa_mobile(text,text) TO anon,authenticated,service_role;");
body.push("ALTER TABLE public.orders ADD COLUMN checkout_revision integer NOT NULL DEFAULT 0, ADD COLUMN delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK(delivery_fee=0);");
body.push(fn(recovery,'private.new_checkout_validation'));
body.push('CREATE TRIGGER new_checkout_validation BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.new_checkout_validation();');
let core=JSON.parse(fs.readFileSync('docs/release/repair-production-functions.json')).find(f=>f.proname==='create_order_from_cart').definition;
core=core.replace('FUNCTION public.create_order_from_cart(', 'FUNCTION private.create_order_core(').replace("SET search_path TO 'public'", "SET search_path TO ''");
core=core.replace(/\b(from|join|into) (meals|vendors|orders|order_suborders|order_items)\b/gi, '$1 public.$2').replace('return order_to_json(', 'return public.order_to_json(');
body.push(core+';');
body.push(`CREATE FUNCTION public.create_order_with_delivery(p_customer_id uuid,p_guest_name text,p_guest_contact text,p_guest_email text,p_delivery_date date,p_delivery_location text,p_items jsonb,p_quote_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF p_quote_id IS NOT NULL THEN RAISE EXCEPTION 'Quoted delivery is outside this release'; END IF;
RETURN private.create_order_core(p_customer_id,p_guest_name,p_guest_contact,p_guest_email,p_delivery_date,p_delivery_location,p_items); END $$;`);
let cancel=fn(recovery,'public.cancel_unpaid_order');
cancel=cancel.replace(" OR EXISTS(SELECT 1 FROM private.payment_attempts WHERE order_id=o.id AND state NOT IN('cancelled_verified','failed_verified'))",'');
body.push(cancel);
body.push(between(recovery,'CREATE TABLE private.gateway_settings','CREATE FUNCTION public.admin_update_payment_gateway').replace("VALUES('payfast',true,true)","VALUES('payfast',false,false)"));
body.push('ALTER TABLE private.gateway_settings ENABLE ROW LEVEL SECURITY;');
// Keep only the original versioned evidence store; no corporate/acquisition engine.
body.push(between(legal,'CREATE TABLE private.commercial_settings','CREATE TABLE private.corporate_accounts').replace(/business jsonb NOT NULL DEFAULT '[^']*'/,"business jsonb NOT NULL DEFAULT '{}'"));
body.push(between(legal,'CREATE TABLE private.commercial_audit','-- Future eligible events'));
body.push(fn(legal,'private.commercial_immutable'));
for(const name of ['legal_content_immutable','acceptance_immutable','commercial_audit_immutable']){const line=legal.split('\n').find(l=>l.startsWith('CREATE TRIGGER '+name+' '));assert.ok(line);body.push(line);}
for(const name of ['private.commercial_admin','private.commercial_business_ready','private.commercial_documents','private.legal_portal','public.get_legal_portal','private.validate_vendor_consent','private.prepare_vendor_consent','public.prepare_vendor_consent','private.accept_vendor_legal','public.accept_vendor_legal','private.enforce_vendor_consent']) body.push(fn(legal,name));
body.push('CREATE TRIGGER vendor_legal_application AFTER INSERT ON public.vendors FOR EACH ROW EXECUTE FUNCTION private.enforce_vendor_consent();');
let action=fn(legal,'private.commercial_admin_action').replace(' a private.corporate_agreements%ROWTYPE;','');
action=action.slice(0,action.indexOf(" WHEN 'account' THEN"))+action.slice(action.indexOf(" ELSE RAISE EXCEPTION 'Unknown commercial action'"));
body.push(action,fn(legal,'public.admin_commercial_action'));
body.push(`CREATE FUNCTION private.commercial_workspace() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE admin boolean:=private.is_admin(); vid uuid:=private.current_vendor_id(); BEGIN
 IF NOT private.active_account() OR (NOT admin AND vid IS NULL) THEN RAISE EXCEPTION 'Active administrator or vendor required' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('admin',admin,'enabled',false,'business',CASE WHEN admin THEN (SELECT business FROM private.commercial_settings) END,
 'documents',CASE WHEN admin THEN (SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY created_at DESC),'[]') FROM private.legal_versions d) ELSE private.commercial_documents() END,
 'acceptances',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY accepted_at DESC),'[]') FROM private.vendor_legal_acceptances a WHERE admin OR a.vendor_id=vid)); END $$;`);
body.push(fn(legal,'public.get_commercial_workspace'));
let m=manual.replace('BEGIN;','').replace(/COMMIT;\s*$/,'');
// Absent optional provider-attempt subsystem is deliberately not installed.
m=m.replace(/^CREATE TRIGGER marketplace_attempt_block.*\n/m,'');
body.push(m);
body.push(`DO $$ DECLARE t text; f record; BEGIN
 FOREACH t IN ARRAY ARRAY['commercial_settings','legal_versions','vendor_legal_acceptances','vendor_consent_intents','commercial_audit'] LOOP
 EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON private.%I FROM PUBLIC,anon,authenticated,service_role',t); END LOOP;
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p WHERE p.pronamespace='private'::regnamespace AND p.proname IN('create_order_core','new_checkout_validation','commercial_immutable','commercial_admin','commercial_business_ready','commercial_documents','legal_portal','validate_vendor_consent','prepare_vendor_consent','accept_vendor_legal','enforce_vendor_consent','commercial_admin_action','commercial_workspace') LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature); END LOOP; END $$;
REVOKE ALL ON FUNCTION public.get_legal_portal(),public.prepare_vendor_consent(jsonb,jsonb),public.accept_vendor_legal(uuid,jsonb,jsonb),public.admin_commercial_action(text,jsonb),public.get_commercial_workspace(),public.cancel_unpaid_order(uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.legal_portal(),public.get_legal_portal(),public.cancel_unpaid_order(uuid,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION private.prepare_vendor_consent(jsonb,jsonb),public.prepare_vendor_consent(jsonb,jsonb),private.accept_vendor_legal(uuid,jsonb,jsonb),public.accept_vendor_legal(uuid,jsonb,jsonb),private.commercial_admin_action(text,jsonb),public.admin_commercial_action(text,jsonb),private.commercial_workspace(),public.get_commercial_workspace() TO authenticated;
COMMIT;`);
const name='20261027112327_production_minimum_manual_legal_foundation.sql';
const generated='supabase/migrations/'+name;
const output='release/production-candidates/'+name;
assert.ok(fs.existsSync(generated)||fs.existsSync(output),'CLI-generated migration filename required');
fs.writeFileSync(output,body.join('\n\n'));
// Only remove the empty file created by this invocation, never historical migrations.
if(fs.existsSync(generated)){assert.equal(fs.readFileSync(generated,'utf8').trim(),'');fs.unlinkSync(generated);}
console.log('Prepared minimum production foundation; no database contacted.');
