// Isolated PostgreSQL (PGlite), not a live Supabase test. Auth/Storage schemas are fixtures.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw new Error('Set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js; no live DB is used.');
const { PGlite } = await import(pathToFileURL(path.resolve(modulePath)).href);
const db = new PGlite();
const baseline = JSON.parse(fs.readFileSync(new URL('./fixtures/live-contract-baseline.json', import.meta.url)));
const ident = value => '"' + value.replaceAll('"','""') + '"';
const literal = value => "'" + value.replaceAll("'","''") + "'";
let checks = 0;
async function expectReject(sql, pattern = /forbidden|permission|admin|active|not authorized/i) {
  try { await db.exec(sql); assert.fail('Unexpected permission/safety success: ' + sql); }
  catch (error) { assert.match(error.message,pattern); checks++; }
}
try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA private;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
 CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text,owner uuid);
 CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role') $$;
 GRANT USAGE ON SCHEMA public,auth,private,storage TO anon,authenticated,service_role;
 GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated,service_role;
 SET check_function_bodies=off;`);
 for(const e of baseline.enums) await db.exec(`CREATE TYPE public.${ident(e.name)} AS ENUM(${e.labels.map(literal).join(',')});`);
 for(const name of new Set(baseline.columns.map(c=>c.table_name))) {
  const columns = baseline.columns.filter(c=>c.table_name===name).map(c=>`${ident(c.column_name)} ${c.type}${c.default_expr?' DEFAULT '+c.default_expr:''}${c.not_null?' NOT NULL':''}`);
  await db.exec(`CREATE TABLE public.${ident(name)}(${columns.join(',')}); ALTER TABLE public.${ident(name)} ENABLE ROW LEVEL SECURITY;`);
 }
 for(const c of baseline.constraints.sort((a,b)=>(a.definition.startsWith('FOREIGN KEY')?1:0)-(b.definition.startsWith('FOREIGN KEY')?1:0))) await db.exec(`ALTER TABLE public.${ident(c.table_name)} ADD CONSTRAINT ${ident(c.name)} ${c.definition};`);
 for(const f of baseline.functions) await db.exec(f.definition);
 for(const t of baseline.triggers) await db.exec(t);
 for(const p of baseline.policies) await db.exec(`CREATE POLICY ${ident(p.policyname)} ON ${p.schemaname}.${ident(p.tablename)} FOR ${p.cmd} TO ${p.roles.map(ident).join(',')}${p.qual?' USING('+p.qual+')':''}${p.with_check?' WITH CHECK('+p.with_check+')':''};`);
 for(const g of baseline.grants) await db.exec(`GRANT ${g.privilege_type}(${ident(g.column_name)}) ON public.${ident(g.table_name)} TO ${ident(g.grantee)};`);
 await db.exec(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role; SET check_function_bodies=on;`);
 for(const name of fs.readdirSync('supabase/migrations').filter(n=>n.includes('_launch_')).sort()) {
   console.log('Apply isolated migration:',name);
   await db.exec(fs.readFileSync(path.join('supabase/migrations',name),'utf8')); checks++;
 }
 console.log('Migration compilation passed.');
 await db.exec(`INSERT INTO public.order_flow(status,step) VALUES('confirmed',1),('accepted',2),('preparing',3),('ready',4),('collected',5),('completed',6);`);
 // Assertions are extended below; these IDs exist only in this ephemeral database.
 const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0');
 await db.exec(`INSERT INTO auth.users(id,email) VALUES('${id(1)}','admin@test.invalid'),('${id(2)}','customer@test.invalid'),('${id(3)}','vendor@test.invalid');
 INSERT INTO public.profiles(id,name,email,role) VALUES('${id(1)}','Admin','admin@test.invalid','admin'),('${id(2)}','Customer','customer@test.invalid','customer'),('${id(3)}','Vendor','vendor@test.invalid','vendor');
 INSERT INTO public.vendors(id,owner_id,name,category,status,commission_rate) VALUES('${id(4)}','${id(3)}','Fixture vendor','Meals','approved',0.17);
 UPDATE public.profiles SET vendor_id='${id(4)}' WHERE id='${id(3)}';
 INSERT INTO public.meals(id,vendor_id,name,category,price) VALUES('${id(5)}','${id(4)}','Fixture lunch','Meals',100);
 INSERT INTO public.orders(id,ticket_number,customer_id,delivery_date,status,total,payment_method) VALUES('${id(6)}','OB-FIXTURE','${id(2)}',current_date+2,'pending_payment',100,'payfast');
 INSERT INTO public.order_suborders(id,order_id,vendor_id,status,payment_status,subtotal) VALUES('${id(7)}','${id(6)}','${id(4)}','pending_payment','unpaid',100);
 INSERT INTO public.order_items(suborder_id,meal_id,meal_name,qty,price) VALUES('${id(7)}','${id(5)}','Fixture lunch',1,100);
 SELECT public.confirm_payfast_payment('${id(6)}','FIXTURE-PAYMENT','OB-FIXTURE',100,'COMPLETE','{"amount_fee":"-2.30"}');`);
 const result = await db.query(`SELECT commission_amount,commission_rate_snapshot FROM public.order_suborders WHERE id='${id(7)}'`);
 assert.equal(Number(result.rows[0].commission_amount),17); checks++;
 assert.equal(Number((await db.query(`SELECT processor_fee FROM public.payfast_itn_log`)).rows[0].processor_fee),2.30); checks++;
 await db.exec(`UPDATE public.vendors SET commission_rate=0 WHERE id='${id(4)}'; DELETE FROM public.meals WHERE id='${id(5)}';
 SELECT set_config('request.jwt.claim.sub','${id(1)}',false),set_config('request.jwt.claim.role','authenticated',false); SET ROLE authenticated;`);
 const report = (await db.query(`SELECT public.get_financial_report(NULL,NULL,NULL) r`)).rows[0].r;
 assert.equal(Number(report.totals.grossCommission),17); checks++;
 assert.equal(Number(report.categories[0].revenue),100); checks++;
 assert.equal(report.meals[0].name,'Fixture lunch'); checks++;
 await expectReject(`SELECT public.admin_allocate_payout('${id(4)}',ARRAY['${id(7)}']::uuid[],'${id(8)}')`,/policy/i);
 await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id(2)}',false); SET ROLE authenticated;`);
 await expectReject(`SELECT public.get_financial_report(NULL,NULL,NULL)`);
 await expectReject(`SELECT public.admin_preview_account_removal('customer','${id(2)}')`);
 await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${id(3)}',false); SET ROLE authenticated;`);
 assert.equal(Number((await db.query(`SELECT public.get_financial_report('${id(4)}',NULL,NULL) r`)).rows[0].r.totals.gmv),100); checks++;
 await expectReject(`SELECT public.admin_set_fee_policy('platform_absorbs','A decision reason')`);
 await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false);
 UPDATE public.profiles SET suspended=true WHERE id='${id(3)}';
 SELECT set_config('request.jwt.claim.sub','${id(3)}',false),set_config('request.jwt.claim.role','authenticated',false); SET ROLE authenticated;`);
 await expectReject(`SELECT public.get_financial_report('${id(4)}',NULL,NULL)`);
 await expectReject(`INSERT INTO public.feedback(user_id,rating,comment) VALUES('${id(3)}',5,'Suspended fixture')`);
 await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','anon',false); SET ROLE anon;`);
 await expectReject(`SELECT public.get_financial_report(NULL,NULL,NULL)`);
 assert.equal((await db.query(`SELECT id FROM public.orders`)).rows.length,0); checks++;
 // Expanded safety checks use only synthetic fixture identities and orders.
 const as = async (who, role='authenticated') => db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${who ? id(who) : ''}',false),set_config('request.jwt.claim.role','${role}',false); SET ROLE ${role};`);
 const root = () => db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false);`);
 const scalar = async sql => (await db.query(sql)).rows[0];
 await root();
 await expectReject(`UPDATE public.order_suborders SET payment_status='unpaid' WHERE id='${id(7)}'`,/immutable/i);
 await expectReject(`UPDATE public.order_items SET price=90 WHERE suborder_id='${id(7)}'`,/immutable/i);
 await db.exec(`INSERT INTO public.orders(id,ticket_number,customer_id,delivery_date,status,total,payment_method) VALUES('${id(10)}','OB-ZERO','${id(2)}',current_date+2,'pending_payment',100,'payfast'); INSERT INTO public.order_suborders(id,order_id,vendor_id,status,payment_status,subtotal) VALUES('${id(11)}','${id(10)}','${id(4)}','pending_payment','unpaid',100); SELECT public.confirm_payfast_payment('${id(10)}','ZERO-PAYMENT','OB-ZERO',100,'COMPLETE','{"amount_fee":"1.25"}');`);
 assert.equal(Number((await scalar(`SELECT commission_amount FROM public.order_suborders WHERE id='${id(11)}'`)).commission_amount),0); checks++;
 await as(1);
 await expectReject(`SELECT public.confirm_payfast_payment('${id(10)}','ANOTHER','OB-ZERO',100,'COMPLETE','{}')`,/permission/i);
 await db.exec(`SELECT public.admin_set_fee_policy('platform_absorbs','Fixture fee policy decision');`);
 await expectReject(`SELECT public.admin_allocate_payout('${id(4)}',ARRAY['${id(7)}']::uuid[],'${id(8)}')`,/incomplete/i);
 await root(); for (const status of ['accepted','preparing','ready','collected','completed']) await db.exec(`UPDATE public.orders SET status='${status}'; UPDATE public.order_suborders SET status='${status}';`);
 await as(1);
 const payout = (await scalar(`SELECT public.admin_allocate_payout('${id(4)}',ARRAY['${id(7)}']::uuid[],'${id(8)}') r`)).r;
 assert.equal(Number(payout.amount),83); checks++;
 assert.equal((await scalar(`SELECT public.admin_allocate_payout('${id(4)}',ARRAY['${id(7)}']::uuid[],'${id(8)}') r`)).r.id,payout.id); checks++;
 await expectReject(`SELECT public.admin_allocate_payout('${id(4)}',ARRAY['${id(11)}']::uuid[],'${id(8)}')`,/conflict/i);
 await expectReject(`SELECT public.admin_allocate_payout('${id(4)}',ARRAY['${id(7)}']::uuid[],'${id(9)}')`,/allocated/i);
 await expectReject(`SELECT public.admin_classify_test_order('${id(6)}','Fixture exact review',0)`,/allocation/i);
 await expectReject(`SELECT public.admin_set_fee_policy('vendor_proportional','Fixture new fee decision')`,/reconcile/i);
 await db.exec(`SELECT public.admin_reconcile_payout('${payout.id}','void','Fixture reservation cancelled'); SELECT public.admin_set_fee_policy('vendor_proportional','Fixture proportional fee decision');`);
 const paid = (await scalar(`SELECT public.admin_allocate_payout('${id(4)}',ARRAY['${id(7)}']::uuid[],'${id(9)}') r`)).r;
 assert.equal(Number(paid.amount),80.70); checks++;
 await db.exec(`SELECT public.admin_reconcile_payout('${paid.id}','paid','TEST external bank reference');`);
 await expectReject(`SELECT public.admin_reconcile_payout('${paid.id}','void','Cannot undo paid history')`,/allocated/i);
 const before = (await scalar(`SELECT public.get_financial_report(NULL,NULL,NULL) r`)).r;
 assert.equal(Number(before.totals.gmv),200); checks++;
 const classified = (await scalar(`SELECT public.admin_classify_test_order('${id(10)}','Fixture exact-ID approved test',0) r`)).r;
 assert.equal(Number(classified.before.gmv),100); checks++;
 assert.equal((await scalar(`SELECT public.get_payout_ledger(NULL) r`)).r.eligible.length,0); checks++;
 await expectReject(`SELECT public.admin_classify_test_order('${id(10)}','Fixture duplicate decision',0)`,/changed/i);
 assert.equal(Number((await scalar(`SELECT public.get_admin_platform_analytics(28) r`)).r.gmv),100); checks++;
 await expectReject(`SELECT public.admin_preview_account_removal('customer','${id(1)}')`,/self/i);
 await as(2);
 await expectReject(`SELECT private.account_removal_preview('${id(1)}','customer','${id(2)}')`,/identity/i);
 await expectReject(`SELECT public.prepare_account_removal('${id(1)}','customer','${id(2)}','x','x')`,/permission/i);
 await as(1);
 await root();await db.exec(`INSERT INTO storage.objects(bucket_id,name,owner_id,owner) VALUES('fixture','modern-file','${id(2)}',NULL),('fixture','legacy-file',NULL,'${id(2)}');`);await as(1);
 const preview=(await scalar(`SELECT public.admin_preview_account_removal('customer','${id(2)}') r`)).r;
 assert.equal(preview.storage.length,2);checks++;

 assert.equal(preview.orders,2); checks++;
 await root();
 const prepared=(await scalar(`SELECT public.prepare_account_removal('${id(1)}','customer','${id(2)}','${preview.fingerprint}','${preview.confirmation}') r`)).r;
 await expectReject(`SELECT public.complete_account_removal('${id(1)}','${prepared.jobId}')`,/Auth identity/i);
 await db.exec(`INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('fixture','late-file','${id(2)}');`);
 await expectReject(`SELECT public.prepare_account_removal('${id(1)}','customer','${id(2)}','${preview.fingerprint}','wrong')`,/confirmation/i);
 const resumed=(await scalar(`SELECT public.prepare_account_removal('${id(1)}','customer','${id(2)}','${preview.fingerprint}','${preview.confirmation}') r`)).r;
 assert.equal(resumed.manifest.storage.length,3);checks++;
 await db.exec(`DELETE FROM storage.objects WHERE owner_id='${id(2)}' OR owner='${id(2)}'; DELETE FROM auth.users WHERE id='${id(2)}'; SELECT public.complete_account_removal('${id(1)}','${prepared.jobId}');`);

 assert.equal(Number((await scalar('SELECT count(*) n FROM public.orders')).n),2); checks++;
 assert.equal((await scalar(`SELECT name,deleted_at FROM public.profiles WHERE id='${id(2)}'`)).name,'Removed account'); checks++;
 await as(2);
 assert.equal((await db.query('SELECT id FROM public.orders')).rows.length,0); checks++;
 await expectReject(`INSERT INTO public.feedback(user_id,rating,comment) VALUES('${id(2)}',5,'Deleted fixture access')`);
 await as(1);
 const retention=(await scalar('SELECT public.admin_preview_retention() r')).r;
 assert.equal(retention.enabled,false); checks++;
 await db.exec(`SELECT public.admin_configure_retention(45,'0 1 * * *');`);
 await expectReject('SELECT public.erase_old_conversations()',/permission/i);
 await root();
 assert.equal((await scalar('SELECT private.conversation_retention_tick() r')).r.dryRun,true); checks++;
 // Historical records are synthetic; no live rate is inferred or overwritten.
 await root();
 await db.exec(`INSERT INTO public.orders(id,ticket_number,delivery_date,status,total,payment_method,created_at,guest_name) VALUES('${id(30)}','OB-LEGACY',current_date+2,'completed',50,'payfast','2020-01-01T22:30:00Z','Synthetic guest'); ALTER TABLE public.order_suborders DISABLE TRIGGER snapshot_paid_commission; INSERT INTO public.order_suborders(id,order_id,vendor_id,status,payment_status,subtotal) VALUES('${id(31)}','${id(30)}','${id(4)}','completed','paid',50); ALTER TABLE public.order_suborders ENABLE TRIGGER snapshot_paid_commission;`);
 await as(1);
 let historical=(await scalar('SELECT public.get_financial_report(NULL,NULL,NULL) r')).r;
 assert.equal(Number(historical.totals.unresolvedCommission),1);checks++;
 assert.equal(historical.totals.grossCommission,null);checks++;
 assert.equal(historical.rows.find(r=>r.order_id===id(30)).financial_date,'2020-01-02');checks++;
 assert.equal(Number((await scalar(`SELECT public.get_financial_report(NULL,'2020-01-02','2020-01-02') r`)).r.totals.gmv),50);checks++;
 await expectReject(`SELECT public.admin_record_historical_commission('${id(31)}',0.17,'')`,/evidence/i);
 await db.exec(`SELECT public.admin_record_historical_commission('${id(31)}',0.15,'Synthetic historical invoice explicitly records 15 percent');`);
 assert.equal(Number((await scalar('SELECT public.get_financial_report(NULL,NULL,NULL) r')).r.totals.grossCommission),24.5);checks++;
 await expectReject(`SELECT public.admin_record_historical_commission('${id(31)}',0.17,'Must not overwrite recorded history')`,/unresolved/i);
 // Vendor archival does not hard-delete the vendor or its financial suborders.
 const vendorPreview=(await scalar(`SELECT public.admin_preview_account_removal('vendor','${id(4)}') r`)).r;
 await root();
 const removal=(await scalar(`SELECT public.prepare_account_removal('${id(1)}','vendor','${id(4)}','${vendorPreview.fingerprint}','${vendorPreview.confirmation}') r`)).r;
 await db.exec(`DELETE FROM auth.users WHERE id='${id(3)}'; SELECT public.complete_account_removal('${id(1)}','${removal.jobId}');`);
 assert.ok((await scalar(`SELECT archived_at FROM public.vendors WHERE id='${id(4)}'`)).archived_at);checks++;
 assert.equal(Number((await scalar('SELECT count(*) n FROM public.order_suborders')).n),3);checks++;
 await expectReject(`UPDATE public.vendors SET status='approved' WHERE id='${id(4)}'`,/archived_vendor_inactive/i);
 // Anonymous feedback remains insert-only; suspension does not widen any anonymous read.
 await as(null,'anon');await db.exec(`INSERT INTO public.feedback(rating,comment) VALUES(4,'Anonymous fixture');`);
 await expectReject('SELECT id FROM public.feedback',/permission/i);
 await expectReject('SELECT public.admin_preview_retention()',/permission/i);
 await as(1);assert.equal(Number((await scalar('SELECT public.get_financial_report(NULL,NULL,NULL) r')).r.totals.gmv),150);checks++;
 // Fee rounding and independent multi-vendor progression use actual fixture RPCs.
 await root();
 await db.exec(`INSERT INTO auth.users(id,email) VALUES('${id(12)}','second@test.invalid'),('${id(18)}','third@test.invalid'); INSERT INTO public.profiles(id,name,email,role) VALUES('${id(12)}','Second','second@test.invalid','vendor'),('${id(18)}','Third','third@test.invalid','vendor'); INSERT INTO public.vendors(id,owner_id,name,category,status) VALUES('${id(13)}','${id(12)}','Second fixture','Meals','approved'); INSERT INTO public.vendors(id,owner_id,name,category,status,commission_rate) VALUES('${id(19)}','${id(18)}','Third fixture','Meals','approved',0); UPDATE public.profiles SET vendor_id='${id(13)}' WHERE id='${id(12)}'; UPDATE public.profiles SET vendor_id='${id(19)}' WHERE id='${id(18)}'; INSERT INTO public.orders(id,ticket_number,guest_name,delivery_date,status,total,payment_method) VALUES('${id(15)}','OB-ROUNDING','Fixture guest',current_date+2,'pending_payment',100,'payfast'); INSERT INTO public.order_suborders(id,order_id,vendor_id,status,payment_status,subtotal) VALUES('${id(16)}','${id(15)}','${id(13)}','pending_payment','unpaid',33.33),('${id(17)}','${id(15)}','${id(19)}','pending_payment','unpaid',66.67); SELECT public.confirm_payfast_payment('${id(15)}','ROUNDING-PAYMENT','OB-ROUNDING',100,'COMPLETE','{"amount_fee":"-1.01"}');`);
 assert.equal(Number((await scalar(`SELECT commission_rate FROM public.vendors WHERE id='${id(13)}'`)).commission_rate),0.17);checks++;
 await as(1);
 const rounding=(await scalar('SELECT public.get_financial_report(NULL,NULL,NULL) r')).r.rows.filter(r=>r.order_id===id(15));
 assert.equal(rounding.reduce((s,r)=>s+Math.round(Number(r.processor_fee)*100),0),101);checks++;
 assert.equal(Number(rounding.find(r=>r.vendor_id===id(13)).commission),5.67);checks++;
 await as(12);
 assert.equal(Number((await scalar(`SELECT public.get_financial_report('${id(13)}',NULL,NULL) r`)).r.totals.processorFees),0.34);checks++;
 await expectReject(`SELECT public.get_financial_report('${id(19)}',NULL,NULL)`,/forbidden/i);
 await db.exec(`SELECT public.update_suborder_status_and_notify('${id(15)}','accepted');`);
 await root();assert.equal((await scalar(`SELECT status FROM public.orders WHERE id='${id(15)}'`)).status,'confirmed');checks++;
 assert.equal((await scalar(`SELECT status FROM public.order_suborders WHERE id='${id(17)}'`)).status,'confirmed');checks++;
 await as(18);await db.exec(`SELECT public.update_suborder_status_and_notify('${id(15)}','accepted');`);
 await root();assert.equal((await scalar(`SELECT status FROM public.orders WHERE id='${id(15)}'`)).status,'accepted');checks++;
 await db.exec(`UPDATE public.vendors SET status='suspended' WHERE id='${id(19)}';`);await as(18);
 await expectReject(`SELECT public.update_suborder_status_and_notify('${id(15)}','preparing')`,/active/i);
 await expectReject(`SELECT public.create_support_ticket('Fixture suspended','general','Fixture suspended body','Fixture','fixture@test.invalid','fixture')`,/active/i);
 await root();await db.exec(`UPDATE public.profiles SET suspended=true WHERE id='${id(1)}';`);await as(1);
 await expectReject(`SELECT public.admin_set_fee_policy('platform_absorbs','Suspended admin cannot change policy')`,/active/i);
 console.log(`${checks} isolated PostgreSQL migration/accounting/role checks passed.`);
} catch(error) { console.error('Isolated database check failed:',error.message); process.exitCode=1; }
finally { await db.close(); }
