import assert from 'node:assert/strict';
import {localNativeClient} from './native-client.mjs';
export async function verifyNativeConcurrency(control) {
 const a=await localNativeClient(),b=await localNativeClient();let checks=0,sequence=20000;
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const q=async(c,s,p=[])=>(await c.query(s,p)).rows[0];
 const equal=(x,y)=>{assert.deepEqual(x,y);checks++;};
 const as=async(c,n)=>c.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub','${n?id(n):''}',false); SET ROLE ${n?'authenticated':'anon'}`);
 const sql='SELECT public.create_collection_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) value';
 const begin=c=>c.exec('BEGIN');const commit=c=>c.exec('COMMIT');
 const pending=(c,s,args)=>c.query(s,args).then(r=>({row:r.rows[0]}),error=>({error}));
 const blocked=async pid=>{
  const limit=Date.now()+10000;
  while(Date.now()<limit){if((await q(control,'SELECT cardinality(pg_blocking_pids($1))>0 blocked',[pid])).blocked){checks++;return;}await new Promise(r=>setTimeout(r,20));}
  throw new Error('Expected server-observed lock wait did not occur');
 };
 const pid=(await q(b,'SELECT pg_backend_pid() pid')).pid;
 await control.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false)");
 await control.exec('UPDATE private.pilot_policy SET enabled=true WHERE singleton=true');
 await control.exec("UPDATE private.collection_activation SET eft_until=now()+interval '1 hour',approval_reference='SYNTHETIC NATIVE FIXTURE ONLY' WHERE singleton=true");
 await q(control,'SELECT public.admin_manual_settings(true,false,15,500,$1)',['Synthetic native concurrency fixture only']);
 let revision=(await q(control,'SELECT revision FROM private.pilot_policy')).revision;
 const fixture=async()=>{
  const w=id(++sequence);
  await q(control,"INSERT INTO private.pilot_windows(id,vendor_id,mode,starts_at,ends_at,cutoff_at,preparation_minutes,capacity,available) VALUES($1,$2,'collection',current_date+7+interval '10 hours',current_date+7+interval '11 hours',now()+interval '1 day',30,1,true)",[w,id(804)]);
  return [null,'Synthetic concurrent guest','0821234567',[{mealId:id(806),qty:1}],'manual_eft',id(++sequence),w,id(9200),revision,1];
 };
 try{
  // Last slot: A has inserted but not committed. B must wait on the actual
  // server lock, then reject after A commits. No assumed scheduling delay.
  let args=await fixture();await as(a,null);await as(b,null);await begin(a);
  const first=(await q(a,sql,args)).value;
  let work=pending(b,sql,[...args.slice(0,5),id(++sequence),...args.slice(6)]);await blocked(pid);await commit(a);
  let result=await work;assert.match(result.error?.message||'',/full/i);checks++;
  equal(Number((await q(control,'SELECT count(*) n FROM private.pilot_bookings WHERE window_id=$1',[args[6]])).n),1);
  // Same key waits and replays precisely the committed original.
  args=await fixture();await begin(a);const original=(await q(a,sql,args)).value;
  work=pending(b,sql,args);await blocked(pid);await commit(a);result=await work;equal(result.row.value.id,original.id);
  equal(Number((await q(control,'SELECT count(*) n FROM private.collection_outbox WHERE order_id=$1',[original.id])).n),1);
  // Two authorised receipt verifications: one ledger and one receipt event.
  await as(a,802);await as(b,802);await begin(a);
  const verify='SELECT public.verify_manual_payment($1,70,$2,false) state';
  await q(a,verify,[original.id,'SYNTHETIC-NATIVE-VERIFIED']);work=pending(b,verify,[original.id,'SYNTHETIC-NATIVE-VERIFIED']);
  await blocked(pid);await commit(a);result=await work;equal(result.row.state,'paid');
  equal(Number((await q(control,"SELECT count(*) n FROM private.manual_payment_events WHERE order_id=$1 AND action='bank_receipt_verified'",[original.id])).n),1);
  equal(Number((await q(control,'SELECT count(*) n FROM private.manual_receivables WHERE order_id=$1',[original.id])).n),1);
  // Reverse race: receipt wins. A waiting guest cancellation must fail instead
  // of releasing capacity or cancelling money already verified by the vendor.
  await as(a,802);await as(b,null);await begin(a);
  await q(a,verify,[first.id,'SYNTHETIC-NATIVE-VERIFY-WINS']);
  work=pending(b,'SELECT public.cancel_unpaid_order($1,$2,$3)',[first.id,first.ticket_number,'0821234567']);
  await blocked(pid);await commit(a);result=await work;assert.match(result.error?.message||'',/unpaid|paid|payment/i);checks++;
  equal((await q(control,'SELECT state FROM private.manual_order_payments WHERE order_id=$1',[first.id])).state,'paid');
  equal((await q(control,'SELECT state FROM private.pilot_bookings WHERE order_id=$1',[first.id])).state,'confirmed');
  // Cancellation wins the order lock. Verification reconciles, never fulfils.
  args=await fixture();await as(a,null);await as(b,802);const cancelled=(await q(a,sql,args)).value;await begin(a);
  await q(a,'SELECT public.cancel_unpaid_order($1,$2,$3)',[cancelled.id,cancelled.ticket_number,args[2]]);
  work=pending(b,verify,[cancelled.id,'SYNTHETIC-NATIVE-CANCELLED']);await blocked(pid);await commit(a);result=await work;
  equal(result.row.state,'under_review');equal((await q(control,'SELECT state FROM private.pilot_bookings WHERE order_id=$1',[cancelled.id])).state,'released');
  // Admin window revision wins the row lock. Waiting checkout rejects stale
  // version after commit, without inserting an order or reservation.
  args=await fixture();await as(a,1);await as(b,null);await begin(a);
  await q(a,"SELECT public.admin_collection_config($1,$2,$3,$4)",[{kind:'window',id:args[6],vendorId:id(804),startsAt:(await q(control,'SELECT starts_at FROM private.pilot_windows WHERE id=$1',[args[6]])).starts_at,endsAt:(await q(control,'SELECT ends_at FROM private.pilot_windows WHERE id=$1',[args[6]])).ends_at,cutoffAt:new Date(Date.now()+86400000).toISOString(),capacity:1,preparationMinutes:30,available:false},revision,id(++sequence),'Synthetic native administrative revision test']);
  work=pending(b,sql,args);await blocked(pid);await commit(a);result=await work;assert.match(result.error?.message||'',/changed|unavailable/i);checks++;
  equal(Number((await q(control,'SELECT count(*) n FROM private.collection_requests WHERE request_id=$1',[args[5]])).n),0);
  revision=(await q(control,'SELECT revision FROM private.pilot_policy')).revision;
  // A new profile approval overlaps a checkout which already locked/snapshotted
  // its independently approved predecessor. Historical recipient remains fixed.
  args=await fixture();await as(a,null);await begin(a);const profiled=(await q(a,sql,args)).value;
  const originalProfile=(await q(control,'SELECT id FROM private.vendor_payment_profiles WHERE vendor_id=$1 AND approved_at IS NOT NULL ORDER BY approved_at DESC,id DESC LIMIT 1',[id(804)])).id;
  await as(b,802);const profile=(await q(b,'SELECT public.submit_vendor_payment_profile($1,$2,true,false) id',[id(804),{accountHolder:'SYNTHETIC ONLY',bank:'Synthetic bank',accountNumber:'0000000000',accountType:'Business',branchCode:'000000',shapId:''}])).id;
  await as(b,1);await q(b,'SELECT public.approve_vendor_payment_profile($1,$2)',[profile,'Synthetic independent recipient approval during checkout']);
  await commit(a);equal((await q(control,'SELECT profile_id FROM private.manual_order_payments WHERE order_id=$1',[profiled.id])).profile_id,originalProfile);
  equal((await q(control,'SELECT profile_id FROM private.collection_financials WHERE order_id=$1',[profiled.id])).profile_id,originalProfile);
  // Deterministic expiry barrier: create while valid, explicitly wait until the
  // SERVER reports its captured deadline passed, then attempt commit. The deferred
  // trigger rejects the entire checkout, not just a later capacity query.
  args=await fixture();await q(control,"UPDATE private.pilot_windows SET cutoff_at=clock_timestamp()+interval '2 seconds' WHERE id=$1",[args[6]]);
  await as(a,null);await begin(a);const expiring=(await q(a,sql,args)).value;
  const deadline=(await q(a,'SELECT public.get_manual_payment($1,$2) value',[expiring.id,expiring.payment_token])).value.collection.holdUntil;
  const timeout=Date.now()+10000;
  while(!(await q(control,'SELECT clock_timestamp()>$1::timestamptz passed',[deadline])).passed){if(Date.now()>timeout)throw new Error('Server clock expiry barrier timed out');await new Promise(r=>setTimeout(r,20));}
  await assert.rejects(()=>commit(a),/expired before commit/i);checks++;
  equal(Number((await q(control,'SELECT count(*) n FROM public.orders WHERE id=$1',[expiring.id])).n),0);
  equal(Number((await q(control,'SELECT count(*) n FROM private.collection_outbox WHERE order_id=$1',[expiring.id])).n),0);
  // Keep the known reservation for operator inspection inside the disposable DB.
  equal((await q(control,'SELECT state FROM private.pilot_bookings WHERE order_id=$1',[first.id])).state,'confirmed');
  console.log(`${checks} native PostgreSQL concurrent-transaction assertions passed using server-observed blocking barriers.`);
 }finally{
  await a.exec('ROLLBACK');await b.exec('ROLLBACK');await a.close();await b.close();
  await control.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false); UPDATE private.pilot_policy SET enabled=false WHERE singleton=true");
  await control.exec('UPDATE private.collection_activation SET eft_until=NULL WHERE singleton=true');
  await q(control,'SELECT public.admin_manual_settings(false,false,15,500,$1)',['Synthetic native closeout; all methods disabled']);
  await control.exec("SELECT set_config('request.jwt.claim.sub','',false)");
 }
}
