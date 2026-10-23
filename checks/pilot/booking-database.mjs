// Invoked against the existing full checkout/migration fixture, never a remote DB.
import fs from 'node:fs';
import assert from 'node:assert/strict';

export async function verifyPilotBookings(db) {
 let checks=0,sequence=9000;
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 const root=()=>db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false)");
 const as=async n=>{await root();await q("SELECT set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('SET ROLE '+(n?'authenticated':'anon'));};
 const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
 const reject=async(sql,args=[],pattern=/unavailable|required|changed|permission|full|cutoff|immutable|mismatch|differ|constraint|expired/i)=>{
  await assert.rejects(()=>db.query(sql,args),pattern);checks++;
 };
 await root();
 const baseline=(await q("SELECT to_jsonb(s) value FROM private.delivery_settings s")).value;
 const definitions=(await db.query("SELECT oid::regprocedure::text signature,pg_get_functiondef(oid) definition FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY oid")).rows;
 await db.exec("SET officebites.local_fixture='isolated-pglite-only'");
 await db.exec(fs.readFileSync('checks/pilot/booking-candidate.sql','utf8'));
 await db.exec('RESET officebites.local_fixture');
 equal((await q('SELECT enabled FROM private.pilot_policy')).enabled,false);
 equal((await q("SELECT to_jsonb(s) value FROM private.delivery_settings s")).value,baseline);
 equal((await db.query("SELECT oid::regprocedure::text signature,pg_get_functiondef(oid) definition FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY oid")).rows,definitions);
 const column=(await q("SELECT bool_and(relrowsecurity) ok FROM pg_class WHERE relnamespace='private'::regnamespace AND relkind='r' AND relname LIKE 'pilot_%'")).ok;
 equal(column,true);
 await as(null);await reject('SELECT * FROM private.pilot_bookings');
 await reject('SELECT private.pilot_quote($1,$2,$3,1)',[id(804),id(9100),id(9200)]);
 await as(803);await reject('SELECT * FROM private.pilot_windows');
 await reject('SELECT private.pilot_reserve($1,$2,$3,1,$4)',[id(999),id(9100),id(9200),id(999)]);
 await as(1);await reject('UPDATE private.pilot_policy SET enabled=true WHERE singleton=true');
 await root();
 // All activation and fixture writes below exist ONLY in disposable PGlite.
 await db.exec(`INSERT INTO private.pilot_destinations(id,mode,label,approved,area) VALUES
 ('${id(9200)}','collection','Synthetic approved Eduvos pickup',true,'Eduvos pickup'),
 ('${id(9201)}','delivery','Synthetic approved Gateway point',true,'Gateway'),
 ('${id(9202)}','delivery','Synthetic unapproved Umhlanga point',false,'Umhlanga'),
 ('${id(9203)}','delivery','Synthetic approved Umhlanga point',true,'Umhlanga');
 INSERT INTO private.pilot_windows(id,vendor_id,mode,starts_at,ends_at,cutoff_at,preparation_minutes,capacity,available)
 SELECT '${id(9100)}','${id(804)}','collection',current_date+7+interval '10 hours',current_date+7+interval '11 hours',now()+interval '1 day',30,1,true;
 INSERT INTO private.pilot_windows(id,vendor_id,mode,starts_at,ends_at,cutoff_at,preparation_minutes,capacity,available)
 SELECT '${id(9101)}','${id(804)}','delivery',current_date+7+interval '11 hours',current_date+7+interval '12 hours',now()+interval '1 day',45,1,true;`);
 const quote=(slot=9100,dest=9200,revision=1)=>q('SELECT private.pilot_quote($1,$2,$3,$4) value',[id(804),id(slot),id(dest),revision]);
 await reject('SELECT private.pilot_quote($1,$2,$3,1)',[id(804),id(9100),id(9200)]);
 await db.exec('UPDATE private.pilot_policy SET enabled=true WHERE singleton=true');
 equal((await quote()).value.fee,0);
 equal((await quote()).value.originMode,'CENTRAL');
 await reject('SELECT private.pilot_quote($1,$2,$3,2)',[id(804),id(9100),id(9200)]);
 await reject('SELECT private.pilot_quote($1,$2,$3,1)',[id(805),id(9100),id(9200)]);
 await reject('SELECT private.pilot_quote($1,$2,$3,1)',[id(804),id(9100),id(9201)]);
 await reject('SELECT private.pilot_quote($1,$2,$3,1)',[id(804),id(9101),id(9202)]);
 await reject('SELECT private.pilot_quote($1,$2,$3,1)',[id(804),id(9101),id(9201)],/settlement/i);
 await reject("UPDATE private.pilot_policy SET delivery_settlement_approved=true WHERE singleton=true");
 await db.exec("UPDATE private.pilot_policy SET delivery_settlement_approved=true,delivery_recipient='SYNTHETIC vendor; unapproved outside this fixture' WHERE singleton=true");
 const delivery=(await quote(9101,9201)).value;
 equal(delivery.fee,10);equal(delivery.mode,'delivery');equal(delivery.area,'Gateway');
 equal((await quote(9101,9203)).value.fee,10);
 await reject("INSERT INTO private.pilot_destinations(mode,label,approved,area) VALUES('delivery','Outside area',true,'Durban')");
 await db.exec(`UPDATE private.pilot_windows SET available=false WHERE id='${id(9100)}'`);
 await reject('SELECT private.pilot_quote($1,$2,$3,1)',[id(804),id(9100),id(9200)]);
 await db.exec(`UPDATE private.pilot_windows SET available=true,cutoff_at=now()-interval '1 minute' WHERE id='${id(9100)}'`);
 await reject('SELECT private.pilot_quote($1,$2,$3,1)',[id(804),id(9100),id(9200)]);
 await db.exec(`UPDATE private.pilot_windows SET starts_at=starts_at-interval '1 day',cutoff_at=now()+interval '1 day',preparation_minutes=10080 WHERE id='${id(9100)}'`);
 await reject('SELECT private.pilot_quote($1,$2,$3,1)',[id(804),id(9100),id(9200)]);
 await db.exec(`UPDATE private.pilot_windows SET starts_at=starts_at+interval '1 day',preparation_minutes=30 WHERE id='${id(9100)}'`);
 await as(1);await q('SELECT public.admin_manual_settings(true,false,15,500,$1)',['Synthetic isolated pilot test only']);
 const create=async()=>{
  await as(null);
  return (await q('SELECT public.create_manual_order(NULL,$1,$2,NULL,current_date+7,$3,$4,NULL,$5,$6) value',
   ['Synthetic pilot guest','0821234567','Synthetic pickup',[{mealId:id(806),qty:1}],'manual_eft',id(++sequence)])).value;
 };
 const first=await create();const second=await create();await root();
 const reserve=(order,slot=9100,dest=9200,key=order.id)=>q('SELECT private.pilot_reserve($1,$2,$3,1,$4) value',[order.id,id(slot),id(dest),key]);
 const snapshot=(await reserve(first)).value;
 equal(snapshot.fee,0);equal((await reserve(first)).value,snapshot);
 equal(Number((await q('SELECT count(*) n FROM private.pilot_bookings WHERE order_id=$1',[first.id])).n),1);
 await reject('SELECT private.pilot_reserve($1,$2,$3,1,$4)',[first.id,id(9100),id(9200),id(9990)]);
 await reject('SELECT private.pilot_reserve($1,$2,$3,1,$4)',[second.id,id(9100),id(9200),second.id],/full/i);
 equal((await q('SELECT status FROM public.orders WHERE id=$1',[first.id])).status,'pending_payment');
 equal((await q('SELECT state FROM private.manual_order_payments WHERE order_id=$1',[first.id])).state,'awaiting_payment');
 await as(null);await q('SELECT public.report_manual_payment($1,$2)',[first.id,first.payment_token]);await root();
 equal((await q('SELECT state FROM private.pilot_bookings WHERE order_id=$1',[first.id])).state,'held');
 equal((await q('SELECT payment_status FROM public.order_suborders WHERE order_id=$1',[first.id])).payment_status,'unpaid');
 await reject("UPDATE private.pilot_bookings SET snapshot='{}' WHERE order_id=$1",[first.id]);
 await reject('DELETE FROM private.pilot_bookings WHERE order_id=$1',[first.id]);
 await as(802);equal((await q('SELECT public.verify_manual_payment($1,70,$2,false) value',[first.id,'SYNTHETIC-PILOT-RECEIPT'])).value,'paid');
 await root();equal((await q('SELECT state FROM private.pilot_bookings WHERE order_id=$1',[first.id])).state,'confirmed');
 equal(Number((await q('SELECT commission FROM private.manual_receivables WHERE order_id=$1',[first.id])).commission),11.9);
 await as(802);await q('SELECT public.verify_manual_payment($1,70,$2,false)',[first.id,'SYNTHETIC-PILOT-RECEIPT']);await root();
 equal(Number((await q('SELECT count(*) n FROM private.manual_receivables WHERE order_id=$1',[first.id])).n),1);
 // Delivery adapter is deliberately absent: never accept an unpriced R10 fee.
 await reject('SELECT private.pilot_reserve($1,$2,$3,1,$4)',[second.id,id(9101),id(9201),second.id],/fee snapshot mismatch/i);
 equal(Number((await q('SELECT count(*) n FROM private.pilot_bookings WHERE order_id=$1',[second.id])).n),0);
 await db.exec(`UPDATE private.pilot_windows SET capacity=2 WHERE id='${id(9100)}'`);
 await reserve(second);await as(null);
 await q('SELECT public.cancel_unpaid_order($1,$2,$3)',[second.id,second.ticket_number,'0821234567']);await root();
 equal((await q('SELECT state FROM private.pilot_bookings WHERE order_id=$1',[second.id])).state,'released');
 equal((await q('SELECT snapshot FROM private.pilot_bookings WHERE order_id=$1',[first.id])).snapshot,snapshot);
 await db.exec("UPDATE private.pilot_policy SET hub='Synthetic updated hub label',revision=2 WHERE singleton=true");
 equal((await reserve(first)).value,snapshot); // Exact replay preserves old revision.
 await reject('SELECT private.pilot_quote($1,$2,$3,1)',[id(804),id(9100),id(9200)]);
 await db.exec("UPDATE private.pilot_policy SET hub='Eduvos, Umhlanga',revision=1 WHERE singleton=true");
 // Explicit local clock fixture: disable only the new immutability trigger to
 // age one hold; restore immediately. This is NOT an application write path.
 const expired=await create();await root();await reserve(expired);
 await db.exec('ALTER TABLE private.pilot_bookings DISABLE TRIGGER pilot_snapshot_guard');
 await q("UPDATE private.pilot_bookings SET hold_until=now()-interval '1 minute' WHERE order_id=$1",[expired.id]);
 await db.exec('ALTER TABLE private.pilot_bookings ENABLE TRIGGER pilot_snapshot_guard');
 equal((await quote()).value.mode,'collection');
 await as(802);await reject('SELECT public.verify_manual_payment($1,70,$2,false)',[expired.id,'SYNTHETIC-LATE-RECEIPT'],/expired/i);await root();
 equal((await q('SELECT status FROM public.orders WHERE id=$1',[expired.id])).status,'pending_payment');
 equal((await q('SELECT payment_status FROM public.order_suborders WHERE order_id=$1',[expired.id])).payment_status,'unpaid');
 equal(Number((await q('SELECT count(*) n FROM private.manual_receivables WHERE order_id=$1',[expired.id])).n),0);
 await db.exec('UPDATE private.pilot_policy SET enabled=false WHERE singleton=true');
 await as(1);await q('SELECT public.admin_manual_settings(false,false,15,500,$1)',['Synthetic isolated pilot stop; all disabled']);await root();
 equal((await q('SELECT bool_and(NOT enabled) ok FROM private.gateway_settings')).ok,true);
 equal((await q("SELECT to_jsonb(s) value FROM private.delivery_settings s")).value,baseline);
 console.log(`${checks} isolated pilot booking assertions passed. No hosted writes; native parallel concurrency and delivery adapter NOT verified.`);
}
