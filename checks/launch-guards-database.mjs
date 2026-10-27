import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function verifyLaunchGuards(db) {
  let checks=0;
  const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const root=()=>db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");
  const as=async n=>{await root();await db.exec(`SELECT set_config('request.jwt.claim.sub','${n?id(n):''}',false),set_config('request.jwt.claim.role','${n?'authenticated':'anon'}',false); SET ROLE ${n?'authenticated':'anon'}`);};
  const q=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
  const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
  const reject=async(sql,args=[],pattern=/required|unavailable|permission|reviewed|review|identity/i)=>{await assert.rejects(()=>db.query(sql,args),pattern);checks++;};
  await root();
  const unpaid=await q(`SELECT m.*,o.ticket_number FROM private.manual_order_payments m JOIN public.orders o ON o.id=m.order_id
    WHERE o.status='pending_payment' AND m.verified_at IS NULL AND m.disputed_at IS NULL AND m.deadline>clock_timestamp()
    AND NOT EXISTS(SELECT 1 FROM private.pilot_bookings f WHERE f.order_id=o.id) LIMIT 1`);
  assert.ok(unpaid,'Reference fixture must contain an unpaid ordinary manual order');
  // Demonstrate the integration defect before installing its correction, then
  // roll back all synthetic status, financial and notification changes.
  await db.exec('BEGIN;');await as(1);
  await db.query('SELECT public.admin_verify_payment($1,true)',[unpaid.order_id]);
  eq((await q('SELECT payment_status FROM public.order_suborders WHERE order_id=$1 LIMIT 1',[unpaid.order_id])).payment_status,'paid');
  await root();eq((await q('SELECT verified_at FROM private.manual_order_payments WHERE order_id=$1',[unpaid.order_id])).verified_at,null);
  await db.exec('ROLLBACK;');await root();
  // Only this discarded in-memory fixture changes flags to rehearse CLOSED install.
  await db.exec('UPDATE private.gateway_settings SET enabled=false; UPDATE private.commercial_settings SET legal_publication_enabled=false,customer_legal_enabled=false,vendor_clickwrap_enabled=false;');
  const vendors=(await db.query('SELECT * FROM public.vendors ORDER BY id')).rows;
  const banks=(await db.query('SELECT * FROM private.vendor_payment_profiles ORDER BY id')).rows;
  const acceptances=(await db.query('SELECT * FROM private.vendor_legal_acceptances ORDER BY id')).rows;
  await db.exec(fs.readFileSync(new URL('../release/production-candidates/20261027094852_production_manual_legal_transition_guards.sql',import.meta.url),'utf8'));
  eq((await db.query('SELECT * FROM public.vendors ORDER BY id')).rows,vendors);
  eq((await db.query('SELECT * FROM private.vendor_payment_profiles ORDER BY id')).rows,banks);
  eq((await db.query('SELECT * FROM private.vendor_legal_acceptances ORDER BY id')).rows,acceptances);
  eq((await q('SELECT bool_and(NOT enabled) closed FROM private.gateway_settings')).closed,true);
  await as(1);await reject('SELECT public.admin_verify_payment($1,true)',[unpaid.order_id],/bank receipt/);
  await root();eq((await q('SELECT payment_status FROM public.order_suborders WHERE order_id=$1 LIMIT 1',[unpaid.order_id])).payment_status,'unpaid');
  eq((await q('SELECT verified_at FROM private.manual_order_payments WHERE order_id=$1',[unpaid.order_id])).verified_at,null);
  const oldOrder=await q('SELECT id,total FROM public.orders o WHERE total>0 AND NOT EXISTS(SELECT 1 FROM private.manual_order_payments m WHERE m.order_id=o.id) LIMIT 1');
  assert.ok(oldOrder,'A retained pre-manual order is required');
  await reject(`INSERT INTO private.manual_order_payments(order_id,vendor_id,profile_id,destination,method,request_id,request_hash,amount,deadline)
    VALUES($1,$2,$3,$4,'manual_eft',gen_random_uuid(),'SYNTHETIC-guard-test',$5,clock_timestamp()+interval '15 minutes')`,
    [oldOrder.id,unpaid.vendor_id,unpaid.profile_id,unpaid.destination,oldOrder.total],/evidence expired|requires review/);
  eq(Number((await q('SELECT count(*) n FROM private.manual_order_payments WHERE order_id=$1',[oldOrder.id])).n),0);
  await db.exec(`SET ROLE service_role;`);await reject('UPDATE private.manual_order_payments SET state=\'paid\' WHERE order_id=$1',[unpaid.order_id],/permission/);
  await root();
  const legacy=await q(`SELECT v.id FROM public.vendors v WHERE v.status='approved' AND NOT EXISTS(SELECT 1 FROM private.vendor_activation_requirements r WHERE r.vendor_id=v.id) LIMIT 1`);
  assert.ok(legacy,'An explicit legacy transition fixture is required');
  await as(null);eq((await q('SELECT public.get_vendor_manual_methods($1) r',[legacy.id])).r,{});
  await reject("SELECT public.create_order_with_legal($1,'{}')",[{p_method:'manual_eft',p_window_id:id(1)}],/reviewed/);
  await reject("SELECT public.create_order_with_legal($1,'{}')",[{p_method:'payfast'}],/reviewed/);
  await reject("SELECT public.create_order_with_legal($1,'{}')",[{p_method:'manual_eft',p_quote_id:id(1)}],/reviewed/);
  await reject('SELECT public.get_vendor_manual_methods_before_launch_gate($1)',[legacy.id],/permission/);
  await reject("SELECT private.create_order_with_legal_before_launch_gate('{}','{}')",[],/permission/);
  await root();await db.exec('UPDATE private.commercial_settings SET customer_legal_enabled=true');
  await as(null);eq((await q('SELECT public.get_vendor_manual_methods($1) r',[legacy.id])).r,{});
  await root();await db.exec('UPDATE private.commercial_settings SET customer_legal_enabled=false');
  // Older unpaid orders can still be reconciled through the actual receipt RPC.
  await as(1);eq((await q('SELECT public.verify_manual_payment($1,$2,$3,false) r',[unpaid.order_id,unpaid.amount,'SYNTHETIC-LAUNCH-'+unpaid.order_id])).r,'paid');
  await root();eq((await q('SELECT confirmation_source FROM private.manual_order_payments WHERE order_id=$1',[unpaid.order_id])).confirmation_source,'admin_bank_receipt');
  eq(Number((await q('SELECT count(*) n FROM private.manual_receivables WHERE order_id=$1',[unpaid.order_id])).n),1);
  await as(1);eq((await q('SELECT public.verify_manual_payment($1,$2,$3,false) r',[unpaid.order_id,unpaid.amount,'SYNTHETIC-LAUNCH-'+unpaid.order_id])).r,'paid');
  await root();eq(Number((await q('SELECT count(*) n FROM private.manual_receivables WHERE order_id=$1',[unpaid.order_id])).n),1);
  eq((await q('SELECT bool_and(NOT enabled) closed FROM private.gateway_settings')).closed,true);
  console.log(`${checks} integrated launch guard assertions passed: legacy paid bypass reproduced/blocked, retained receipt workflow, duplicate protection, no silent legacy EFT exemption. PGlite only; production foundations and concurrency NOT certified.`);
}
