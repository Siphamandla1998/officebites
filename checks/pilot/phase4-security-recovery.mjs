import assert from 'node:assert/strict';
export async function verifyPhase4(db,{cash,createSql,args,id}){
 let checks=0;
 const q=async(sql,p=[])=>(await db.query(sql,p)).rows[0];
 const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
 const as=async n=>db.exec(`RESET ROLE;SELECT set_config('request.jwt.claim.sub','${n?id(n):''}',false);${n?'SET ROLE authenticated':''}`);
 const denied=async(sql,p=[])=>{await assert.rejects(()=>db.query(sql,p));checks++;};
 await as(null);
 const snapshot=async()=> (await q(`SELECT jsonb_build_object(
 'orders',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM public.orders x),
 'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY request_id),'[]') FROM private.cash_events x),
 'commission',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY order_id),'[]') FROM private.manual_receivables x),
 'handovers',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') FROM private.cash_handovers x)) value`)).value;
 const before=await snapshot();
 for(const actor of [1,802,803]){
  await as(actor);
  for(const table of ['cash_custody_policy','cash_handovers','cash_handover_events','cash_receipt_snapshots','cash_events','manual_receivables'])await denied('DELETE FROM private.'+table);
  await denied('SELECT public.initiate_cash_handover($1,$2,$3,70,$4,$5)',[cash.id,id(48001),id(802),'physical_cash','Synthetic forbidden custody transfer']);
  await denied('SELECT public.respond_cash_handover($1,$2,$3,$4)',[id(48001),id(48002),'acknowledged','Synthetic fabricated acknowledgement']);
 }
 await as(1);await denied(createSql,args());
 await as(803);await denied('SELECT public.cash_custody_workspace($1)',[id(804)]);
 await as(null);eq(await snapshot(),before);
 eq((await q("SELECT bool_and(relrowsecurity) ok FROM pg_class WHERE oid IN('private.cash_events'::regclass,'private.cash_receipt_snapshots'::regclass,'private.cash_handovers'::regclass,'private.cash_handover_events'::regclass)")).ok,true);
 for(const name of ['create_assisted_order','record_cash_event','initiate_cash_handover','respond_cash_handover','cash_custody_workspace']){
  eq((await q("SELECT bool_and(prosecdef AND coalesce(array_to_string(proconfig,','),'') LIKE '%search_path=%') ok FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=$1",[name])).ok,true);
  eq((await q("SELECT bool_and(NOT has_function_privilege('anon',oid,'EXECUTE')) ok FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname=$1",[name])).ok,true);
 }
 eq((await q('SELECT admin_cash_until IS NULL locked FROM private.cash_custody_policy')).locked,true);
 // Historical admin-custody fixture only, rolled back in full. The runtime
 // activation policy stays locked; no admin cash creation RPC is enabled.
 await db.exec('BEGIN;ALTER TABLE private.cash_receipt_snapshots DISABLE TRIGGER immutable_history');
 await q("UPDATE private.cash_receipt_snapshots SET custody='admin',custodian_id=$1 WHERE order_id=$2",[id(1),cash.id]);
 await db.exec('ALTER TABLE private.cash_receipt_snapshots ENABLE TRIGGER immutable_history');
 await q("INSERT INTO private.cash_handovers(id,order_id,sender_id,recipient_id,amount,method,evidence,payload) VALUES($1,$2,$3,$4,70,'physical_cash','Historical synthetic handover fixture','{}')",[id(49001),cash.id,id(1),id(802)]);
 const respond='SELECT public.respond_cash_handover($1,$2,$3,$4) value';
 const response=[id(49001),id(49002),'acknowledged','Synthetic independent recipient acknowledgement'];
 const deniedInTransaction=async(actor,sql,parameters)=>{
  await as(actor);await db.exec('SAVEPOINT hostile_action');await denied(sql,parameters);await db.exec('ROLLBACK TO SAVEPOINT hostile_action');
 };
 await deniedInTransaction(1,respond,response);await deniedInTransaction(803,respond,response);
 await as(802);eq((await q(respond,response)).value.state,'reconciled');eq((await q(respond,response)).value.state,'reconciled');
 await deniedInTransaction(802,respond,[...response.slice(0,3),'Changed acknowledgement evidence']);
 await deniedInTransaction(802,respond,[id(49001),id(49003),'disputed','Synthetic invalid transition after acknowledgement']);
 await as(null);eq(Number((await q('SELECT private.cash_settled($1) n',[cash.id])).n),70);
 await db.exec('ROLLBACK');eq(await snapshot(),before);
 // Recover a committed, reversible permission failure without dropping any data.
 // Gates are shut before failure injection and remain shut throughout recovery.
 await db.exec('UPDATE private.assisted_controls SET assisted_until=NULL,cash_until=NULL,requests_until=NULL WHERE singleton;UPDATE private.collection_activation SET eft_until=NULL WHERE singleton');
 const signature='public.cash_custody_workspace(uuid)';
 const baseline=(await q("SELECT pg_get_functiondef($1::regprocedure) definition,proowner::text owner,proacl::text acl FROM pg_proc WHERE oid=$1::regprocedure",[signature]));
 const started=performance.now();
 await db.exec('REVOKE EXECUTE ON FUNCTION public.cash_custody_workspace(uuid) FROM authenticated');
 await as(802);await denied('SELECT public.cash_custody_workspace($1)',[id(804)]);
 await as(null);
 // Interrupted repair must roll back, leaving the known denied state.
 await db.exec('BEGIN;GRANT EXECUTE ON FUNCTION public.cash_custody_workspace(uuid) TO authenticated');
 await assert.rejects(()=>db.exec("DO $$ BEGIN RAISE EXCEPTION 'repair interruption';END $$"),/repair interruption/);checks++;await db.exec('ROLLBACK');
 await as(802);await denied('SELECT public.cash_custody_workspace($1)',[id(804)]);await as(null);
 await db.exec('GRANT EXECUTE ON FUNCTION public.cash_custody_workspace(uuid) TO authenticated');
 eq(await q("SELECT pg_get_functiondef($1::regprocedure) definition,proowner::text owner,proacl::text acl FROM pg_proc WHERE oid=$1::regprocedure",[signature]),baseline);
 eq(await snapshot(),before);
 eq((await q('SELECT assisted_until IS NULL AND cash_until IS NULL AND requests_until IS NULL locked FROM private.assisted_controls')).locked,true);
 eq((await q('SELECT eft_until IS NULL locked FROM private.collection_activation')).locked,true);
 eq((await q('SELECT admin_cash_until IS NULL locked FROM private.cash_custody_policy')).locked,true);
 await as(802);await q('SELECT public.cash_custody_workspace($1)',[id(804)]);checks++;await as(null);
 // Committed schema failure: missing lookup index. Forward repair preserves data,
 // RLS and ACLs, and is repeatable. This is not a table/column rollback.
 const indexBefore=(await q("SELECT pg_get_indexdef('private.cash_order_events'::regclass) d")).d;
 const tableBefore=await q("SELECT relrowsecurity,relacl::text acl FROM pg_class WHERE oid='private.cash_events'::regclass");
 const outboxBefore=(await q('SELECT count(*) n FROM private.collection_outbox')).n;
 await db.exec('DROP INDEX private.cash_order_events');
 eq((await q("SELECT to_regclass('private.cash_order_events') i")).i,null);
 const repair=indexBefore.replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS ');
 await db.exec(repair);await db.exec(repair);
 eq((await q("SELECT pg_get_indexdef('private.cash_order_events'::regclass) d")).d,indexBefore);
 eq(await q("SELECT relrowsecurity,relacl::text acl FROM pg_class WHERE oid='private.cash_events'::regclass"),tableBefore);
 eq(await snapshot(),before);
 eq((await q('SELECT count(*) n FROM private.collection_outbox')).n,outboxBefore);
 eq((await q('SELECT admin_cash_until IS NULL locked FROM private.cash_custody_policy')).locked,true);
 console.log(`${checks} Phase 4 custody denial/committed permission forward-recovery assertions passed; recovery ${Math.round(performance.now()-started)}ms. No destructive schema rollback claimed.`);
}
