import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function verifyLegalCorporate(db) {
 let checks=0;
 const scalar=async(sql,args)=>(await db.query(sql,args)).rows[0];
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const root=()=>db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");
 const as=async n=>{await root();await db.exec(`SELECT set_config('request.jwt.claim.sub','${id(n)}',false),set_config('request.jwt.claim.role','authenticated',false); SET ROLE authenticated`);};
 const reject=async(sql,pattern)=>{let error;try{await db.exec(sql);}catch(e){error=e;}assert.ok(error,'Expected rejection');assert.match(error.message,pattern);checks++;};
 const action=async(a,v)=>(await scalar('SELECT public.admin_commercial_action($1,$2) r',[a,JSON.stringify(v)])).r;
 await root();
 const historic=(await db.query('SELECT id,commission_amount,commission_rate_snapshot,paid_at FROM public.order_suborders WHERE commission_amount IS NOT NULL ORDER BY id')).rows;
 await db.exec(fs.readFileSync('supabase/migrations/20261016094201_legal_corporate_framework.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261016100142_commercial_reporting_contract_locks.sql','utf8'));
 await db.exec('SET ROLE anon');
 const publicData=(await scalar('SELECT public.get_legal_portal() r')).r;
 assert.equal(publicData.business.registrationNumber,'K2026677349');checks++;
 assert.deepEqual(publicData.documents,{});checks++;
 assert.equal(publicData.businessReady,false);checks++;
 await reject('SELECT public.get_commercial_workspace()',/permission/i);
 await root();await as(2);await reject("SELECT public.admin_commercial_action('business','{}')",/administrator/i);
 await reject('SELECT public.get_commercial_workspace()',/vendor/i);
 await as(1);
 await reject("SELECT public.admin_commercial_action('approve_document','{}')",/disclosures/i);
 await action('business',{businessAddress:'SYNTHETIC STAGING ONLY',legalNoticeAddress:'SYNTHETIC STAGING ONLY',vatTreatment:'SYNTHETIC TEST ONLY - NOT A TAX ELECTION',informationOfficer:'Synthetic officer',informationOfficerContact:'synthetic@test.invalid'});
 const documents={};
 for(const kind of ['terms','privacy','refund-policy','vendor-agreement','vendor-fees']) {
  const d=await action('document',{kind,version:'synthetic-v1',title:'SYNTHETIC TEST ONLY',content:'SYNTHETIC TEST ONLY — not an approved legal agreement. Used only in isolated tests.',effective_at:'2026-01-01T00:00:00Z'});
  await action('approve_document',{id:d.id,approvalReference:'SYNTHETIC ISOLATED TEST APPROVAL'});documents[kind]=d.id;
 }
 await root();await reject("UPDATE private.legal_versions SET content='Forged'",/immutable/i);
 await reject('UPDATE private.commercial_settings SET acquisition_enabled=true',/check constraint/i);
 // Feature gate intentionally cannot be enabled by the deployed admin surface.
 await as(1);await reject("SELECT public.admin_commercial_action('activate','{}')",/disabled/i);
 await action('onboarding',{enabled:true,documents});
 await root();
 await reject(`INSERT INTO public.vendors(owner_id,name,category) VALUES('${id(2)}','No consent','Meals')`,/documents|acknowledgements/i);
 await as(2);await reject(`SELECT public.prepare_vendor_consent('${JSON.stringify(documents)}','[true]')`,/Eight/i);
 await db.query('SELECT public.prepare_vendor_consent($1,$2)',[JSON.stringify(documents),JSON.stringify(Array(8).fill(true))]);
 await root();const v=(await scalar(`INSERT INTO public.vendors(owner_id,name,category) VALUES('${id(2)}','Synthetic consent vendor','Meals') RETURNING id`)).id;
 assert.equal(Number((await scalar(`SELECT count(*) n FROM private.vendor_legal_acceptances WHERE vendor_id='${v}'`)).n),1);checks++;
 await reject('UPDATE private.vendor_legal_acceptances SET fee_version=\'forged\'',/immutable/i);
 await as(1);await action('onboarding',{enabled:false});
 const c=await action('account',{name:'Synthetic workplace',internal_identifier:'SYNTHETIC-CORP',status:'active'});
 await action('membership',{account_id:c.id,customer_id:id(2),evidence:'Synthetic verified workplace association'});
 const offer=await action('offer',{account_id:c.id,vendor_id:id(4),document_id:documents['vendor-agreement'],starts_at:'2026-01-01T00:00:00Z',ends_at:'2027-01-01T00:00:00Z'});
 await as(310);await reject(`SELECT public.respond_corporate_agreement('${offer.id}',true)`,/owner/i);
 await as(3);await db.query('SELECT public.respond_corporate_agreement($1,true)',[offer.id]);checks++;
 await db.query('SELECT public.accept_vendor_legal($1,$2,$3)',[id(4),JSON.stringify(documents),JSON.stringify(Array(8).fill(true))]);
 await reject(`SELECT public.accept_vendor_legal('${id(311)}','${JSON.stringify(documents)}','[true,true,true,true,true,true,true,true]')`,/owner/i);
 await reject(`SELECT public.respond_corporate_agreement('${offer.id}',true)`,/unavailable/i);
 const ws=(await scalar('SELECT public.get_commercial_workspace() r')).r;
 assert.equal(ws.agreements.length,1);checks++;
 assert.deepEqual(ws.accounts,[]);checks++;
 assert.deepEqual(ws.memberships,[]);checks++;
 await as(310);assert.deepEqual((await scalar('SELECT public.get_commercial_workspace() r')).r.agreements,[]);checks++;
 await root();
 await reject(`UPDATE private.corporate_agreements SET terms='{}' WHERE id='${offer.id}'`,/immutable/i);
 for(const [pos,rate] of [[0,null],[1,.05],[49,.05],[50,.075],[99,.075],[100,.1],[101,.1],[120,.1]]){
  const val=(await scalar(`SELECT private.acquisition_rate(${pos}) r`)).r;assert.equal(val==null?null:Number(val),rate);checks++;
 }
 for(const [n,acquisition] of [[49,171.5],[50,176.75],[99,434],[100,441],[120,581]]) {
  const x=await scalar(`SELECT sum(round(70*private.acquisition_rate(i),2)) acq,${n}*70*.15 platform,${n}*70*.02 processing FROM generate_series(1,${n}) i`);
  assert.equal(Number(x.acq),acquisition);checks++;assert.equal(Math.round((Number(x.platform)+Number(x.processing))*100),n*70*17);checks++;
 }
 for(const [ts,date] of [['2026-10-18T21:59:59.999Z','2026-10-12'],['2026-10-18T22:00:00Z','2026-10-19']]) {
  assert.equal((await scalar("SELECT to_char(date_trunc('week',$1::timestamptz AT TIME ZONE 'Africa/Johannesburg'),'YYYY-MM-DD') d",[ts])).d,date);checks++;
 }
 // Isolated-only activation bypass exercises the private engine. Hosted activation stays blocked.
 await db.exec(`ALTER TABLE private.commercial_settings DROP CONSTRAINT commercial_settings_acquisition_enabled_check;
 ALTER TABLE private.commercial_settings DROP CONSTRAINT commercial_settings_standard_breakdown_enabled_check;
 UPDATE private.commercial_settings SET acquisition_enabled=true,standard_breakdown_enabled=true;
 UPDATE private.corporate_agreements SET status='active' WHERE id='${offer.id}';
 UPDATE public.meals SET price=70 WHERE id='${id(5)}'`);
 let lastOrder;
 for(let i=1;i<=120;i++) {
  await as(2);
  const order=(await scalar(`SELECT public.create_order_from_cart(auth.uid(),NULL,NULL,NULL,current_date+7,'Synthetic','[{"mealId":"${id(5)}","qty":1}]') r`)).r;
  await root();await db.exec(`SELECT public.confirm_payfast_payment('${order.id}','SYNTHETIC-CORP-${i}','${order.ticket_number}',70,'COMPLETE','{"amount_fee":"-1"}')`);
  for(const status of ['accepted','preparing','ready','collected','completed']) await db.exec(`UPDATE public.order_suborders SET status='${status}' WHERE order_id='${order.id}'`);
  await db.exec(`SELECT private.record_acquisition('${order.id}','${id(4)}')`);
  lastOrder=order.id;
 }
 const total=await scalar(`SELECT count(*) n,sum(amount) acquisition,sum(eligible_subtotal) sales,min(position) first,max(position) last FROM private.acquisition_ledger`);
 assert.equal(Number(total.n),120);checks++;assert.equal(Number(total.acquisition),581);checks++;assert.equal(Number(total.sales),8400);checks++;
 assert.equal(Number(total.first),1);assert.equal(Number(total.last),120);checks+=2;
 const fees=await scalar('SELECT sum(platform_amount) platform,sum(internal_processing_amount) processing,sum(combined_amount) combined,sum(net_before_acquisition_provider_tax) proceeds FROM private.standard_fee_ledger');
 assert.equal(Number(fees.platform),1260);checks++;assert.equal(Number(fees.processing),168);checks++;assert.equal(Number(fees.combined),1428);checks++;assert.equal(Number(fees.proceeds)-Number(total.acquisition),6391);checks++;
 const first=(await scalar('SELECT order_id FROM private.acquisition_ledger ORDER BY position LIMIT 1')).order_id;
 assert.equal(Number((await scalar(`SELECT count(*) n FROM private.acquisition_ledger WHERE order_id='${first}'`)).n),1);checks++;
 // Capture remains immutable despite subsequent events and original tier refund credits.
 const entry=await scalar(`SELECT * FROM private.acquisition_ledger WHERE order_id='${lastOrder}'`);
 for (const amount of ['0', '-1', '1.001', 'NULL']) {
  await reject(`SELECT private.record_acquisition_refund('${entry.id}','payfast','synthetic-invalid',${amount})`,/Invalid confirmed refund/i);
 }
 await reject(`SELECT private.record_acquisition_refund('${entry.id}','payfast','x',1)`,/Invalid confirmed refund/i);
 await db.exec(`SELECT private.record_acquisition_refund('${entry.id}','payfast','synthetic-refund-part-1',20);SELECT private.record_acquisition_refund('${entry.id}','payfast','synthetic-refund-part-1',20);SELECT private.record_acquisition_refund('${entry.id}','payfast','synthetic-refund-part-2',50)`);
 await reject(`SELECT private.record_acquisition_refund('${entry.id}','payfast','synthetic-refund-part-1',21)`,/replay mismatch/i);
 assert.equal(Number((await scalar(`SELECT sum(acquisition_credit) credit FROM private.commercial_refund_adjustments WHERE entry_id='${entry.id}'`)).credit),7);checks++;
 await reject(`SELECT private.record_acquisition_refund('${entry.id}','payfast','synthetic-excess',1)`,/exceeds/i);
 await reject('DELETE FROM private.acquisition_ledger',/immutable/i);
 for(const exclusion of ['test','expired','missing_membership','disputed']) {
  await as(2);const skipped=(await scalar(`SELECT public.create_order_from_cart(auth.uid(),NULL,NULL,NULL,current_date+7,'Synthetic exclusion','[{"mealId":"${id(5)}","qty":1}]') r`)).r;
  await root();assert.equal((await scalar(`SELECT private.record_acquisition('${skipped.id}','${id(4)}') id`)).id,null);checks++;
  await db.exec(`SELECT public.confirm_payfast_payment('${skipped.id}','SYNTHETIC-EXCLUDED-${exclusion}','${skipped.ticket_number}',70,'COMPLETE','{"amount_fee":"-1"}')`);
  assert.equal((await scalar(`SELECT private.record_acquisition('${skipped.id}','${id(4)}') id`)).id,null);checks++;
  if(exclusion==='test') await db.exec(`UPDATE public.orders SET is_test=true WHERE id='${skipped.id}'`);
  if(exclusion==='expired') await db.exec(`UPDATE private.corporate_agreements SET status='expired' WHERE id='${offer.id}'`);
  if(exclusion==='missing_membership') await db.exec(`UPDATE private.corporate_memberships SET revoked_at=clock_timestamp() WHERE account_id='${c.id}'`);
  if(exclusion==='disputed') await db.exec(`INSERT INTO private.corporate_attributions(order_id,vendor_id,agreement_id,verified_by,evidence,disputed_at) VALUES('${skipped.id}','${id(4)}','${offer.id}','${id(1)}','Synthetic disputed attribution',clock_timestamp())`);
  for(const status of ['accepted','preparing','ready','collected','completed']) await db.exec(`UPDATE public.order_suborders SET status='${status}' WHERE order_id='${skipped.id}'`);
  assert.equal(Number((await scalar(`SELECT count(*) n FROM private.acquisition_ledger WHERE order_id='${skipped.id}'`)).n),0);checks++;
  await db.exec(`UPDATE private.corporate_agreements SET status='active' WHERE id='${offer.id}';UPDATE private.corporate_memberships SET revoked_at=NULL WHERE account_id='${c.id}'`);
 }
 await as(3);await reject(`SELECT private.record_acquisition_refund('${entry.id}','payfast','forged',1)`,/permission/i);
 await root();await db.exec('UPDATE private.commercial_settings SET acquisition_enabled=false,standard_breakdown_enabled=false');
 for(const row of historic) assert.deepEqual((await scalar('SELECT id,commission_amount,commission_rate_snapshot,paid_at FROM public.order_suborders WHERE id=$1',[row.id])),row);
 checks++;
 const vendorWorkspace=async n=>{await as(n);return (await scalar('SELECT public.get_commercial_workspace() r')).r;};
 assert.equal((await vendorWorkspace(3)).ledger.length,120);checks++;
 assert.equal((await vendorWorkspace(310)).ledger.length,0);checks++;
 await as(3);const report=(await scalar('SELECT public.get_commercial_report(NULL,NULL) r')).r;
 assert.equal(report.totals.chargedOrders,120);checks++;assert.equal(report.totals.qualifyingOrders,119);checks++;
 assert.equal(Number(report.totals.netAcquisitionFees),574);checks++;
 assert.equal(report.rows.some(r=>'customer_id' in r),false);checks++;
 await as(310);assert.equal((await scalar('SELECT public.get_commercial_report(NULL,NULL) r')).r.rows.length,0);checks++;
 await root();
 for(const table of ['commercial_settings','legal_versions','vendor_legal_acceptances','corporate_accounts','corporate_memberships','corporate_agreements','corporate_attributions','commercial_audit','acquisition_ledger','commercial_refund_adjustments']) {
  assert.equal((await scalar(`SELECT relrowsecurity ok FROM pg_class WHERE oid='private.${table}'::regclass`)).ok,true);checks++;
  assert.equal((await scalar(`SELECT has_table_privilege('authenticated','private.${table}','UPDATE') ok`)).ok,false);checks++;
 }
 console.log(`${checks} isolated legal/consent/corporate/financial/RPC permission assertions passed. Synthetic legal text only. No hosted writes.`);
}
