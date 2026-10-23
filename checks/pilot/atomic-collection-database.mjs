import fs from 'node:fs';
import assert from 'node:assert/strict';

export async function verifyAtomicCollection(db) {
 let checks=0,seq=12000;
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const q=async(s,a=[])=>(await db.query(s,a)).rows[0];
 const root=()=>db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)");
 const as=async n=>{await root();await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('SET ROLE '+(n?'authenticated':'anon'));};
 const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
 const reject=async(s,a=[],p=/required|unavailable|changed|permission|full|capacity|immutable|snapshot|checkout|revision|collection|forced/i)=>{await assert.rejects(()=>db.query(s,a),p);checks++;};
 await root();await db.exec("SET officebites.local_fixture='isolated-pglite-only'");
 await db.exec(fs.readFileSync('supabase/migrations/20261021094956_fix_admin_manual_settings_singleton.sql','utf8'));
 await db.exec(fs.readFileSync('checks/pilot/atomic-collection-candidate.sql','utf8'));
 await db.exec('RESET officebites.local_fixture');
 const delivery=(await q('SELECT to_jsonb(d) d FROM private.delivery_settings d')).d;
 const config=async(change,revision)=>(await q('SELECT public.admin_collection_config($1,$2,$3,$4) value',[change,revision,id(++seq),'Synthetic local independent operator approval only'])).value;
 await as(803);await reject('SELECT public.admin_collection_workspace()');
 await reject('SELECT * FROM private.collection_financials');
 await as(1);
 let revision=1;
 const a=await config({kind:'agreement',vendorId:id(804),version:'SYNTHETIC-17-V1',rate:0.17},revision);revision=a.revision;
 const window=await config({kind:'window',vendorId:id(804),startsAt:new Date(Date.now()+7*86400000).toISOString(),endsAt:new Date(Date.now()+7*86400000+3600000).toISOString(),cutoffAt:new Date(Date.now()+86400000).toISOString(),capacity:1,preparationMinutes:30,available:true},revision);revision=window.revision;
 await root();await db.exec('UPDATE private.pilot_policy SET enabled=true WHERE singleton=true');
 await as(1);await reject("SELECT public.admin_manual_settings(true,false,15,500,'Synthetic blocked activation attempt')");
 await reject("UPDATE private.collection_activation SET eft_until=now()+interval '1 hour' WHERE singleton=true");
 await root();await db.exec("UPDATE private.collection_activation SET eft_until=now()+interval '1 hour',approval_reference='SYNTHETIC LOCAL TEST ONLY' WHERE singleton=true");
 await as(1);await q('SELECT public.admin_manual_settings(true,false,15,500,$1)',['Synthetic isolated atomic fixture activation']);
 await reject("SELECT public.admin_update_payment_gateway('manual_payshap',true,false,'Synthetic blocked PayShap enablement')");
 const options=(await q('SELECT public.get_collection_options($1) value',[id(804)])).value;
 const chosen=options.windows.find(w=>w.id===window.id);assert.ok(chosen);checks++;
 const args=[null,'Synthetic atomic guest','0821234567',[{mealId:id(806),qty:1,price:0.01}],'manual_eft',id(++seq),window.id,id(9200),revision,1];
 const sql='SELECT public.create_collection_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) value';
 const create=async(values=args)=>(await q(sql,values)).value;
 await as(null);
 await reject('SELECT public.create_manual_order(NULL,$1,$2,NULL,current_date+7,$3,$4,NULL,$5,$6)',
  [args[1],args[2],'Synthetic',args[3],args[4],id(++seq)]);
 await reject(sql,[...args.slice(0,8),revision-1,1]);
 await reject(sql,[...args.slice(0,9),2]);
 await reject(sql,[...args.slice(0,4),'manual_payshap',...args.slice(5)]);
 const created=await create();equal(Number(created.total),70);equal(created.collection.fee,0);equal(created.collection.mode,'collection');
 equal((await create()).id,created.id);
 await reject(sql,[...args.slice(0,1),'Other guest',...args.slice(2)]);
 await reject(sql,[...args.slice(0,5),id(++seq),...args.slice(6)]);
 const read=await q('SELECT public.get_manual_payment($1,$2) value',[created.id,created.payment_token]);
 equal(read.value.collection.mode,'collection');equal(read.value.collection.state,'held');
 await reject('SELECT public.get_order_collection($1,NULL)',[created.id]);
 equal((await q('SELECT public.get_order_collection($1,$2) value',[created.id,created.payment_token])).value.fee,0);
 await as(803);await reject('SELECT public.get_order_collection($1,NULL)',[created.id]);
 await reject('SELECT public.verify_manual_payment($1,70,$2,false)',[created.id,'SYNTHETIC-UNAUTH-RECEIPT']);
 await root();
 const financial=await q('SELECT * FROM private.collection_financials WHERE order_id=$1',[created.id]);
 equal(Number(financial.commission),11.9);equal(financial.agreement_version,'SYNTHETIC-17-V1');
 equal(Number(financial.agreement_revision),2);
 equal(Number((await q('SELECT count(*) n FROM private.collection_requests WHERE order_id=$1',[created.id])).n),1);
 equal(Number((await q('SELECT count(*) n FROM private.collection_outbox WHERE order_id=$1',[created.id])).n),1);
 await reject('UPDATE private.collection_financials SET rate=0.5 WHERE order_id=$1',[created.id]);
 await reject('UPDATE public.order_suborders SET subtotal=1 WHERE order_id=$1',[created.id]);
 await db.exec(`UPDATE public.vendors SET commission_rate=0.3 WHERE id='${id(804)}'`);
 await as(null);await q('SELECT public.report_manual_payment($1,$2)',[created.id,created.payment_token]);await root();
 equal((await q('SELECT payment_status FROM public.order_suborders WHERE order_id=$1',[created.id])).payment_status,'unpaid');
 await as(802);equal((await q('SELECT public.verify_manual_payment($1,70,$2,false) value',[created.id,'SYNTHETIC-ATOMIC-RECEIPT'])).value,'paid');
 await q('SELECT public.verify_manual_payment($1,70,$2,false)',[created.id,'SYNTHETIC-ATOMIC-RECEIPT']);await root();
 equal(Number((await q('SELECT commission FROM private.manual_receivables WHERE order_id=$1',[created.id])).commission),11.9);
 equal(Number((await q('SELECT count(*) n FROM private.manual_receivables WHERE order_id=$1',[created.id])).n),1);
 equal((await q('SELECT state FROM private.pilot_bookings WHERE order_id=$1',[created.id])).state,'confirmed');
 await as(1);await reject('SELECT public.admin_collection_config($1,$2,$3,$4)',[{kind:'window',id:window.id,capacity:0},revision,id(++seq),'Synthetic forbidden capacity reduction'],/capacity/i);
 await as(802);await reject('SELECT public.verify_manual_payment($1,71,$2,false)',[created.id,'SYNTHETIC-ATOMIC-RECEIPT']);
 await q("SELECT public.record_manual_refund_status($1,'requested',NULL,0,$2)",[created.id,'Synthetic full refund requested for cancelled collection']);
 await as(1);const refund='SELECT public.record_manual_refund_status($1,\'completed\',70,70,$2)';
 await q(refund,[created.id,'Synthetic independently reconciled full vendor refund']);
 await q(refund,[created.id,'Synthetic independently reconciled full vendor refund']);
 await reject("SELECT public.record_manual_refund_status($1,'completed',69,69,$2)",[created.id,'Synthetic independently reconciled full vendor refund']);
 await q('SELECT public.admin_cancel_refunded_manual_order($1,$2)',[created.id,'Synthetic full refund independently reconciled']);
 await q('SELECT public.admin_cancel_refunded_manual_order($1,$2)',[created.id,'Synthetic full refund independently reconciled']);
 await root();equal((await q('SELECT state FROM private.pilot_bookings WHERE order_id=$1',[created.id])).state,'released');
 equal(Number((await q("SELECT count(*) n FROM private.manual_payment_events WHERE order_id=$1 AND action='refunded_order_cancelled'",[created.id])).n),1);
 await db.exec(`UPDATE public.vendors SET commission_rate=0.17 WHERE id='${id(804)}'`);
 // Reconfiguration replay, stale revisions, and capacity cannot invalidate holds.
 await as(1);
 const change={kind:'window',id:window.id,vendorId:id(804),startsAt:chosen.startsAt,endsAt:chosen.endsAt,cutoffAt:new Date(Date.now()+86400000).toISOString(),capacity:2,preparationMinutes:30,available:true};
 const req=id(++seq);const params=[change,revision,req,'Synthetic audited window capacity increase'];
 const saved=(await q('SELECT public.admin_collection_config($1,$2,$3,$4) value',params)).value;
 equal((await q('SELECT public.admin_collection_config($1,$2,$3,$4) value',params)).value,saved);
 await reject('SELECT public.admin_collection_config($1,$2,$3,$4)',[{...change,capacity:3},revision,req,params[3]]);
 await reject('SELECT public.admin_collection_config($1,$2,$3,$4)',[change,revision,id(++seq),params[3]]);
 revision=saved.revision;
 await root();const state=async()=> (await q(`SELECT jsonb_build_array(
 (SELECT count(*) FROM public.orders),(SELECT count(*) FROM private.manual_order_payments),
 (SELECT count(*) FROM private.collection_financials),(SELECT count(*) FROM private.pilot_bookings),
 (SELECT count(*) FROM private.collection_requests),(SELECT count(*) FROM private.collection_outbox)) state`)).state;
 // Inject actual SQL exceptions at every critical insertion boundary. Each call
 // must leave ALL six collections unchanged, including requests and event capture.
 await db.exec("CREATE FUNCTION private.force_collection_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced local rollback'; END $$");
 for(const table of ['public.orders','public.order_items','private.manual_order_payments','private.collection_financials','private.pilot_bookings','private.collection_requests','private.collection_outbox']) {
  const before=await state();
  await db.exec(`CREATE TRIGGER forced_collection_failure BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION private.force_collection_failure()`);
  await as(null);await reject(sql,[...args.slice(0,5),id(++seq),...args.slice(6,8),revision,2],/forced local rollback/i);
  await root();await db.exec(`DROP TRIGGER forced_collection_failure ON ${table}`);
  equal(await state(),before);
 }
 // Successful retry after failures creates exactly one new order/reservation.
 await as(null);const last=await create([...args.slice(0,5),id(++seq),...args.slice(6,8),revision,2]);
 await q('SELECT public.cancel_unpaid_order($1,$2,$3)',[last.id,last.ticket_number,args[2]]);await root();
 equal((await q('SELECT state FROM private.pilot_bookings WHERE order_id=$1',[last.id])).state,'released');
 equal((await q('SELECT to_jsonb(d) d FROM private.delivery_settings d')).d,delivery);
 await q('UPDATE private.pilot_windows SET capacity=3 WHERE id=$1',[window.id]);
 await as(2);const member=await create([id(2),null,null,...args.slice(3,5),id(++seq),...args.slice(6,8),revision,2]);
 equal((await q('SELECT public.get_order_collection($1,NULL) value',[member.id])).value.fee,0);
 await reject(sql,[id(1),null,null,...args.slice(3,5),id(++seq),...args.slice(6,8),revision,2]);
 await as(null);await reject('SELECT public.get_order_collection($1,NULL)',[member.id]);
 await as(2);await q('SELECT public.cancel_unpaid_order($1,NULL,NULL)',[member.id]);await root();
 equal((await q('SELECT state FROM private.pilot_bookings WHERE order_id=$1',[member.id])).state,'released');
 await as(null);const outstanding=await create([...args.slice(0,5),id(++seq),...args.slice(6,8),revision,2]);await root();
 await db.exec("UPDATE private.collection_activation SET eft_until=now()-interval '1 minute' WHERE singleton=true");
 await as(null);await reject(sql,[...args.slice(0,5),id(++seq),...args.slice(6,8),revision,2],/unlock/i);
 equal((await q('SELECT public.get_vendor_manual_methods($1) value',[id(804)])).value.manual_eft,false);await root();
 await db.exec('UPDATE private.pilot_policy SET enabled=false WHERE singleton=true');
 await db.exec('UPDATE private.collection_activation SET eft_until=NULL WHERE singleton=true');
 await as(1);await q('SELECT public.admin_manual_settings(false,false,15,500,$1)',['Synthetic atomic closeout; all methods disabled']);await root();
 equal((await q('SELECT bool_and(NOT enabled) ok FROM private.gateway_settings')).ok,true);
 await as(null);await reject(sql,[...args.slice(0,5),id(++seq),...args.slice(6,8),revision,2]);
 await as(802);equal((await q('SELECT public.verify_manual_payment($1,70,$2,false) value',[outstanding.id,'SYNTHETIC-RECONCILE-AFTER-STOP'])).value,'paid');await root();
 console.log(`${checks} atomic collection/commission/replay/RLS/rollback/outbox assertions passed locally.`);
}
