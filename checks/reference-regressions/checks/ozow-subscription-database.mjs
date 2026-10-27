// Run against the existing isolated checkout fixture, after its migrations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function verifyOzowSubscriptions(db) {
 let checks=0;
 const scalar=async sql=>(await db.query(sql)).rows[0];
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const root=()=>db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");
 const as=async n=>{await root();await db.exec(`SELECT set_config('request.jwt.claim.sub','${id(n)}',false),set_config('request.jwt.claim.role','authenticated',false); SET ROLE authenticated`);};
 const reject=async(sql,pattern)=>{try{await db.exec(sql);assert.fail('Unexpected success');}catch(e){assert.match(e.message,pattern);checks++;}};
 await root();
 await db.exec(fs.readFileSync('supabase/migrations/20261016083644_ozow_attempts_subscription_approval.sql','utf8'));
 // Existing fixture left vendor GPS invalid and delivery enabled; changes here affect isolated memory only.
 await db.exec(`UPDATE private.delivery_settings SET enabled=false; UPDATE public.vendors SET latitude=-29.72118 WHERE id='${id(4)}'`);
 const cart=JSON.stringify([{mealId:id(5),qty:1}]);
 const order=(await scalar(`SELECT public.create_order_from_cart(NULL,'Synthetic','0821234567',NULL,current_date+2,'Synthetic','${cart}') r`)).r;
 await reject(`SELECT public.begin_ozow_attempt('${order.id}',NULL,'0821234567','SYN-TEST-001','staging')`,/unavailable/i);
 for(const [enabled,ready,maintenance] of [[true,false,false],[false,true,false],[true,true,true]]) {
  await db.exec(`UPDATE private.gateway_settings SET enabled=${enabled},ready=${ready},maintenance=${maintenance} WHERE provider='ozow'`);
  await reject(`SELECT public.begin_ozow_attempt('${order.id}',NULL,'0821234567','SYN-TEST-001','staging')`,/unavailable/i);
  assert.equal(Number((await scalar(`SELECT count(*) n FROM private.ozow_attempts WHERE order_id='${order.id}'`)).n),0);checks++;
 }
 await db.exec("UPDATE private.gateway_settings SET maintenance=false WHERE provider='ozow'");
 await db.exec("UPDATE private.gateway_settings SET enabled=true,ready=true WHERE provider='ozow'");
 const a=(await scalar(`SELECT public.begin_ozow_attempt('${order.id}',NULL,'0821234567','SYN-TEST-001','staging') r`)).r;
 assert.equal(Number(a.amount),100);checks++;
 await reject(`SELECT public.begin_ozow_attempt('${order.id}',NULL,'0821234567','SYN-TEST-001','staging')`,/reconciliation/i);
 await reject(`SELECT public.prepare_payfast_order('${order.id}',NULL,'0821234567')`,/reconciliation/i);
 await reject(`SELECT public.cancel_unpaid_order('${order.id}','${order.ticket_number}','0821234567')`,/processing/i);
 const tx={id:id(201),status:'Successful',amount:{currency:'ZAR',value:100},siteCode:'SYN-TEST-001',merchantReference:a.reference};
 const record=(v,delivery='msg_synthetic')=>`SELECT public.record_ozow_transaction('${JSON.stringify(v)}','staging','${delivery}') r`;
 await reject(record({...tx,amount:{currency:'ZAR',value:101}}),/mismatch/i);
 await reject(record({...tx,siteCode:'wrong'}),/mismatch/i);
 await reject(record({...tx,amount:{currency:'USD',value:100}}),/mismatch/i);
 await as(2);await reject(record(tx),/permission/i);await root();
 const pendingResult=(await scalar(record({...tx,status:'Pending'},'msg_pending'))).r;
 assert.equal(pendingResult.applied,false);checks++;
 assert.equal((await scalar(`SELECT status FROM public.orders WHERE id='${order.id}'`)).status,'pending_payment');checks++;
 const before=Number((await scalar('SELECT count(*) n FROM public.notifications')).n);
 assert.equal((await scalar(record(tx))).r.applied,true);checks++;
 assert.equal(Number((await scalar(`SELECT commission_amount FROM public.order_suborders WHERE order_id='${order.id}'`)).commission_amount),17);checks++;
 const after=Number((await scalar('SELECT count(*) n FROM public.notifications')).n);
 assert.ok(after>before);checks++;
 assert.equal((await scalar(record(tx,'msg_duplicate'))).r.duplicate,true);checks++;
 assert.equal(Number((await scalar('SELECT count(*) n FROM public.notifications')).n),after);checks++;
 assert.equal(Number((await scalar(`SELECT count(*) n FROM public.payfast_itn_log WHERE order_id='${order.id}'`)).n),0);checks++;
 await as(1);
 const report=(await scalar('SELECT public.get_financial_report(NULL,NULL,NULL) r')).r;
 assert.equal(report.totals.processorFees,null);checks++;
 assert.ok(report.totals.unresolvedProcessorFees>0);checks++;
 assert.equal(report.totals.netMarketplaceRevenue,null);checks++;
 assert.equal(Number(report.reconciliation.find(r=>r.order_id===order.id).recordedCompletePayments),100);checks++;
 await root();
 // A second successful transaction is retained for review without a second order credit.
 const second=(await scalar(record({...tx,id:id(202)},'msg_second'))).r;
 assert.equal(second.applied,false);checks++;assert.equal(second.reviewRequired,true);checks++;
 await db.exec("UPDATE private.gateway_settings SET enabled=false,ready=false WHERE provider='ozow'");
 const disabledOrder=(await scalar(`SELECT public.create_order_from_cart(NULL,'Synthetic','0821234567',NULL,current_date+2,'Synthetic','${cart}') r`)).r;
 await reject(`SELECT public.begin_ozow_attempt('${disabledOrder.id}',NULL,'0821234567','SYN-TEST-001','staging')`,/unavailable/i);
 // Disabled catalog, forged receipts, admin-before-payment, pending and approved eligibility.
 await as(3);await reject(`SELECT public.request_vendor_subscription('${id(4)}','monthly')`,/not enabled/i);
 await root();await db.exec(`INSERT INTO private.subscription_plans VALUES('synthetic',200,'ZAR',30,'{"testOnly":true}','Synthetic policy, not a commercial offer',true)`);
 await as(3);const s=(await scalar(`SELECT public.request_vendor_subscription('${id(4)}','synthetic') id`)).id;
 await reject(`SELECT public.record_subscription_payment('${s}','SYNTHETIC-RECEIPT',200,'ZAR')`,/permission/i);
 await as(1);await reject(`SELECT public.admin_decide_subscription('${s}',true,'Synthetic approval')`,/payment required/i);
 await root();await reject(`SELECT public.record_subscription_payment('${s}','SYNTHETIC-RECEIPT',201,'ZAR')`,/mismatch/i);
 await db.exec(`SELECT public.record_subscription_payment('${s}','SYNTHETIC-RECEIPT',200,'ZAR')`);
 await as(3);let state=(await scalar(`SELECT public.get_vendor_subscription('${id(4)}') r`)).r[0];
 assert.equal(state.state,'paid_pending_approval');checks++;assert.equal(state.eligible,false);checks++;
 await reject(`SELECT public.admin_decide_subscription('${s}',true,'Synthetic approval')`,/administrator/i);
 await as(1);await db.exec(`SELECT public.admin_decide_subscription('${s}',true,'Synthetic approval')`);
 state=(await scalar(`SELECT public.get_vendor_subscription('${id(4)}') r`)).r[0];assert.equal(state.eligible,true);checks++;
 await root();await db.exec(`UPDATE public.profiles SET suspended=true WHERE id='${id(3)}'`);
 await as(1);assert.equal((await scalar(`SELECT public.get_vendor_subscription('${id(4)}') r`)).r[0].eligible,false);checks++;
 await root();
 for(const table of ['ozow_attempts','ozow_receipts','ozow_deliveries','subscription_plans','vendor_subscriptions']){
  assert.equal((await scalar(`SELECT relrowsecurity ok FROM pg_class WHERE oid='private.${table}'::regclass`)).ok,true);checks++;
  assert.equal((await scalar(`SELECT has_table_privilege('authenticated','private.${table}','SELECT') ok`)).ok,false);checks++;
 }
 await db.exec("SET ROLE anon");await reject("SELECT public.get_ozow_attempt('anything')",/permission/i);await root();
 console.log(`${checks} isolated Ozow receipt/subscription/role assertions passed.`);
}
