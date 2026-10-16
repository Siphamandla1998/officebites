// Isolated PostgreSQL (PGlite), not a live Supabase test. Auth/Storage schemas are fixtures.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const modulePath = process.env.PGLITE_MODULE || 'node_modules/@electric-sql/pglite/dist/index.js';
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

 for(const f of JSON.parse(fs.readFileSync(new URL('./fixtures/checkout-prerequisites.json',import.meta.url)))) await db.exec(f.definition);
 await db.exec(fs.readFileSync('supabase/migrations/20261016074256_checkout_recovery_mobile_delivery_gateways.sql','utf8'));
 await db.exec("INSERT INTO public.event_booking_requests(id,business_name,contact_name,contact_phone,event_type,event_date,guest_count,location) VALUES('00000000-0000-4000-8000-000000000099','Synthetic','Synthetic','legacy-contact','meeting',current_date+7,10,'Synthetic')");
 await db.exec(fs.readFileSync('supabase/migrations/20261016081336_booking_mobile_validation.sql','utf8'));
 await db.exec("UPDATE public.event_booking_requests SET notes='Unrelated edit preserves historical contact' WHERE id='00000000-0000-4000-8000-000000000099'");checks++;
 await expectReject("UPDATE public.event_booking_requests SET contact_phone='bad' WHERE id='00000000-0000-4000-8000-000000000099'",/mobile/i);
 await db.exec("UPDATE public.event_booking_requests SET contact_phone='+14155552671' WHERE id='00000000-0000-4000-8000-000000000099'");checks++;
 for(const value of ['+14155552671','+27821234567','0821234567']) { assert.equal((await db.query('SELECT public.valid_sa_mobile($1, $2) ok',[value,'international'])).rows[0].ok,true);checks++; }
 const scalar=async sql=>(await db.query(sql)).rows[0];
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const root=()=>db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false);");
 const as=async n=>{await root();await db.exec(`SELECT set_config('request.jwt.claim.sub','${id(n)}',false),set_config('request.jwt.claim.role','authenticated',false); SET ROLE authenticated;`);};
 await db.exec(`INSERT INTO public.order_flow(status,step) VALUES('confirmed',1),('accepted',2),('preparing',3),('ready',4),('collected',5),('completed',6);
 INSERT INTO auth.users(id,email) VALUES('${id(1)}','admin@test.invalid'),('${id(2)}','customer@test.invalid'),('${id(3)}','vendor@test.invalid');
 INSERT INTO public.profiles(id,name,email,role) VALUES('${id(1)}','Admin','admin@test.invalid','admin'),('${id(2)}','Customer','customer@test.invalid','customer'),('${id(3)}','Vendor','vendor@test.invalid','vendor');
 INSERT INTO public.vendors(id,owner_id,name,category,status,commission_rate,latitude,longitude,delivery_radius) VALUES('${id(4)}','${id(3)}','Synthetic vendor','Meals','approved',0.17,-29.721180,31.071621,100);
 UPDATE public.profiles SET vendor_id='${id(4)}' WHERE id='${id(3)}';
 INSERT INTO public.meals(id,vendor_id,name,category,price) VALUES('${id(5)}','${id(4)}','Synthetic meal','Meals',100);`);
 const cart=JSON.stringify([{mealId:id(5),qty:1}]).replaceAll("'","''");
 const create=async (customer='NULL',phone='0821234567',quote='NULL')=>(await scalar(`SELECT public.create_order_with_delivery(${customer},'Synthetic guest','${phone}',NULL,current_date+2,'Synthetic destination','${cart}'::jsonb,${quote}) r`)).r;
 await db.exec("SET ROLE anon");
 await expectReject(`SELECT public.create_order_from_cart(NULL,'Guest','123',NULL,current_date+2,'Synthetic','${cart}')`,/mobile/i);
 const cancelled=await create();
 await expectReject(`SELECT public.cancel_unpaid_order('${cancelled.id}','${cancelled.ticket_number}','0810000000')`,/proof/i);
 const result=(await scalar(`SELECT public.cancel_unpaid_order('${cancelled.id}','${cancelled.ticket_number}','0821234567') r`)).r;
 assert.equal(result.status,'cancelled');checks++;
 assert.equal((await scalar(`SELECT public.cancel_unpaid_order('${cancelled.id}','${cancelled.ticket_number}','0821234567') r`)).r.status,'cancelled');checks++;
 await root();assert.equal((await scalar(`SELECT bool_and(status='cancelled') ok FROM public.order_suborders WHERE order_id='${cancelled.id}'`)).ok,true);checks++;
 const pending=await create();
 await db.exec(`SELECT public.prepare_payfast_order('${pending.id}',NULL,'0821234567')`);
 await expectReject(`SELECT public.cancel_unpaid_order('${pending.id}','${pending.ticket_number}','0821234567')`,/processing/i);
 await db.exec(`SELECT public.confirm_payfast_payment('${pending.id}','SYNTHETIC-PAYMENT','${pending.ticket_number}',100,'COMPLETE','{"amount_fee":"-2.30"}')`);
 await expectReject(`SELECT public.cancel_unpaid_order('${pending.id}','${pending.ticket_number}','0821234567')`,/cannot be cancelled/i);
 assert.equal(Number((await scalar(`SELECT commission_amount FROM public.order_suborders WHERE order_id='${pending.id}'`)).commission_amount),17);checks++;
 assert.equal(Number((await scalar("SELECT processor_fee FROM public.payfast_itn_log")).processor_fee),2.3);checks++;
 const legacy=await create();await db.exec(`UPDATE public.orders SET checkout_revision=0 WHERE id='${legacy.id}'`);
 await expectReject(`SELECT public.cancel_unpaid_order('${legacy.id}','${legacy.ticket_number}','0821234567')`,/processing/i);
 await as(2);const member=await create("auth.uid()");
 await root();await expectReject(`SELECT public.cancel_unpaid_order('${member.id}',NULL,NULL)`,/ownership/i);
 await as(1);await db.exec("SELECT public.admin_update_payment_gateway('payfast',false,false,'Synthetic maintenance')");
 await root();const disabled=await create();
 await expectReject(`SELECT public.prepare_payfast_order('${disabled.id}',NULL,'0821234567')`,/unavailable/i);
 await db.exec(`SELECT public.confirm_payfast_payment('${disabled.id}','SYNTHETIC-DISABLED','${disabled.ticket_number}',100,'COMPLETE','{"amount_fee":"-1.25"}')`);
 assert.equal((await scalar(`SELECT status FROM public.orders WHERE id='${disabled.id}'`)).status,'confirmed');checks++;
 await as(2);await expectReject("SELECT public.admin_update_payment_gateway('payfast',true,false,'')",/admin/i);
 await as(1);await expectReject("SELECT public.admin_update_payment_gateway('ozow',true,false,'')",/not verified ready/i);
 await db.exec("SELECT public.admin_update_payment_gateway('payfast',true,false,'')");
 await db.exec("SELECT public.admin_update_delivery_settings(true,-29.721180,31.071621,1,2,15)");
 await root();await expectReject(`SELECT public.create_order_from_cart(NULL,'Guest','0821234567',NULL,current_date+2,'Synthetic','${cart}')`,/quote/i);
 const quote=async km=>{
  const lat=-29.721180+km/6371.0088*180/Math.PI;
  return (await scalar(`SELECT public.quote_delivery(jsonb_build_object('latitude',${lat},'longitude',31.071621,'accuracy',10,'capturedAt',clock_timestamp()),'${cart}','0821234567') r`)).r;
 };
 for(const [km,fee] of [[0,0],[0.999,0],[1,0],[1.001,15],[2,15]]){const q=await quote(km);assert.equal(Number(q.fee),fee);checks++;}
 await expectReject(`SELECT public.quote_delivery(jsonb_build_object('latitude',-29.5,'longitude',31.071621,'accuracy',10,'capturedAt',clock_timestamp()),'${cart}','0821234567')`,/outside/i);
 await expectReject(`SELECT public.quote_delivery('{}','${cart}','0821234567')`,/coordinates/i);
 await expectReject(`SELECT public.quote_delivery(jsonb_build_object('latitude',-29.721180,'longitude',31.071621,'accuracy',500,'capturedAt',clock_timestamp()),'${cart}','0821234567')`,/coordinates/i);
 const q=await quote(1.1);const delivery=await create('NULL','0821234567',`'${q.id}'`);
 assert.equal(Number(delivery.total),115);checks++;assert.equal(Number(delivery.delivery_fee),15);checks++;
 await db.exec(`SELECT public.confirm_payfast_payment('${delivery.id}','SYNTHETIC-DELIVERY','${delivery.ticket_number}',115,'COMPLETE','{"amount_fee":"-3.12"}')`);
 await as(1);
 const finance=(await scalar('SELECT public.get_financial_report(NULL,NULL,NULL) r')).r;
 const reconciliation=finance.reconciliation.find(row=>row.order_id===delivery.id);
 assert.equal(Number(reconciliation.deliveryFee),15);checks++;
 assert.equal(Number(reconciliation.orderAmountDifference),0);checks++;
 await root();
 await expectReject(`SELECT public.create_order_with_delivery(NULL,'Guest','0821234567',NULL,current_date+2,'Synthetic','${cart}','${q.id}')`,/expired/i);
 const missingVendor=await quote(0);await db.exec(`UPDATE public.vendors SET latitude=NULL WHERE id='${id(4)}'`);
 await expectReject(`SELECT public.create_order_with_delivery(NULL,'Guest','0821234567',NULL,current_date+2,'Synthetic','${cart}','${missingVendor.id}')`,/vendor/i);
 console.log(`${checks} isolated checkout/mobile/cancellation/delivery/gateway assertions passed. No hosted writes or native concurrency claims.`);
 await (await import('./ozow-subscription-database.mjs')).verifyOzowSubscriptions(db);
} catch(error) {console.error('Checkout database checks failed:',error.message);process.exitCode=1;} finally {await db.close();}
