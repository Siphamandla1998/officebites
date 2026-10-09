// Runs after the existing isolated launch tests, in the same synthetic DB.
import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function cleanupDatabaseTests(db) {
 let checks=0;
 const originalExec=db.exec.bind(db);
 db.exec=async text=>{try{return await originalExec(text);}catch(e){e.message += ' [fixture SQL: '+text.slice(0,160)+']';throw e;}};
 const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const sql=async text=>(await db.query(text)).rows;
 const root=()=>db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false); SELECT set_config('request.jwt.claim.role','service_role',false);");
 const role=async(n,r='authenticated')=>{await root();await db.exec(`SET ROLE ${r}; SELECT set_config('request.jwt.claim.sub','${n?id(n):''}',false); SELECT set_config('request.jwt.claim.role','${r}',false);`);};
 const reject=async(text,pattern=/permission|active|ownership|blocked|verification|vendor|supported|admin|server/i)=>{await assert.rejects(()=>db.exec(text),pattern);checks++;};
 await root();
 await db.exec(`INSERT INTO auth.users(id,email) VALUES('${id(1)}','cleanup-admin@test.invalid'),('${id(2)}','cleanup-customer@test.invalid'),('${id(3)}','cleanup-vendor@test.invalid'),('${id(9)}','cleanup-other@test.invalid');
 INSERT INTO public.profiles(id,name,email,role) VALUES('${id(1)}','Cleanup Admin','cleanup-admin@test.invalid','admin'),('${id(2)}','Cleanup Customer','cleanup-customer@test.invalid','customer'),('${id(3)}','Cleanup Vendor','cleanup-vendor@test.invalid','vendor'),('${id(9)}','Other','cleanup-other@test.invalid','customer');
 INSERT INTO public.vendors(id,owner_id,name,category,status,commission_rate) VALUES('${id(4)}','${id(3)}','Cleanup vendor','Meals','approved',0);
 UPDATE public.profiles SET vendor_id='${id(4)}' WHERE id='${id(3)}';
 INSERT INTO public.meals(id,vendor_id,name,category,price) VALUES('${id(5)}','${id(4)}','Synthetic meal','Meals',100);
 INSERT INTO public.orders(id,ticket_number,guest_name,guest_contact,delivery_date,total,payment_method,status) VALUES('${id(6)}','OB-CLEANUP','Synthetic guest','fixture-contact',current_date+2,100,'payfast','pending_payment');
 INSERT INTO public.order_suborders(id,order_id,vendor_id,subtotal,status,payment_status) VALUES('${id(7)}','${id(6)}','${id(4)}',100,'pending_payment','unpaid');`);
 // Reproduce the old authenticated guest-ownership hole in isolated data only.
 await role(9);await reject(`SELECT public.submit_payment_proof('${id(6)}','arbitrary/path');`,/Invalid status transition/);
 await root();await db.exec(`UPDATE public.orders SET status='pending_payment',payment_proof_url=NULL WHERE id='${id(6)}'; UPDATE public.order_suborders SET status='pending_payment',payment_status='unpaid' WHERE id='${id(7)}';`);
 const migration=fs.readdirSync('supabase/migrations').find(n=>n.endsWith('_production_audit_cleanup.sql'));
 await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'));checks++;
 for(const [n,r] of [[null,'anon'],[2,'authenticated'],[9,'authenticated'],[1,'authenticated'],[null,'service_role']]) {await role(n,r);await reject(`SELECT public.submit_payment_proof('${id(6)}','x');`);}
 await root();await db.exec(`SELECT public.prepare_payfast_order('${id(6)}',NULL,'fixture-contact');`);checks++;
 await reject(`SELECT public.prepare_payfast_order('${id(6)}',NULL,'wrong');`);
 await db.exec(`UPDATE public.vendors SET status='suspended' WHERE id='${id(4)}';`);await reject(`SELECT public.prepare_payfast_order('${id(6)}',NULL,'fixture-contact');`);
 // A verified receipt still records and confirms after suspension, with audit.
 await db.exec(`SELECT public.confirm_payfast_payment('${id(6)}','CLEANUP-RECEIPT','OB-CLEANUP',100,'COMPLETE','{}');`);
 assert.equal((await sql(`SELECT payment_status FROM public.order_suborders WHERE id='${id(7)}'`))[0].payment_status,'paid');checks++;
 assert.equal((await sql(`SELECT count(*)::int n FROM private.business_audit WHERE record_id='${id(6)}' AND action='inactive_account_payment_review'`))[0].n,1);checks++;
 await role(1);const receipts=(await sql('SELECT public.admin_recent_payments(100) r'))[0].r;
 assert.ok(receipts.find(r=>r.pf_payment_id==='CLEANUP-RECEIPT' && r.requires_review));checks++;
 const preview=(await sql(`SELECT public.admin_preview_account_removal('vendor','${id(4)}') r`))[0].r;
 assert.ok(preview.blockers.length>=2);checks++;
 await root();await reject(`SELECT public.prepare_account_removal('${id(1)}','vendor','${id(4)}','${preview.fingerprint}','vendor:${id(4)}');`);
 await db.exec(`UPDATE public.vendors SET status='approved' WHERE id='${id(4)}'; INSERT INTO public.favourites(profile_id,meal_id) VALUES('${id(2)}','${id(5)}');`);
 await role(1);const counts=await sql('SELECT * FROM public.admin_customer_favourite_counts()');assert.equal(Number(counts.find(r=>r.profile_id===id(2)).favourite_count),1);assert.equal(Number(counts.find(r=>r.profile_id===id(9)).favourite_count),0);checks+=2;
 for(const n of [2,3,9]) {await role(n);await reject('SELECT public.admin_recent_payments(20)');await reject('SELECT * FROM public.admin_customer_favourite_counts()');await reject(`SELECT public.prepare_payfast_order('${id(6)}','${id(n)}',NULL)`);}
 await root();
 await db.exec(`INSERT INTO public.orders(id,ticket_number,customer_id,delivery_date,total,payment_method,status) VALUES('${id(10)}','OB-OWNER','${id(2)}',current_date+2,100,'payfast','pending_payment'); INSERT INTO public.order_suborders(id,order_id,vendor_id,subtotal,status,payment_status) VALUES('${id(11)}','${id(10)}','${id(4)}',100,'pending_payment','unpaid');`);
 await reject(`SELECT public.prepare_payfast_order('${id(10)}','${id(9)}',NULL)`);
 await db.exec(`SELECT public.prepare_payfast_order('${id(10)}','${id(2)}',NULL); UPDATE public.profiles SET suspended=true WHERE id='${id(2)}';`);checks++;
 await reject(`SELECT public.prepare_payfast_order('${id(10)}','${id(2)}',NULL)`);
 await role(2);assert.equal((await sql('SELECT count(id)::int n FROM public.orders'))[0].n,0);checks++;
 await root();
 assert.equal((await sql("SELECT count(*)::int n FROM pg_indexes WHERE indexname IN ('payout_allocations_payout_id_idx','vendor_payouts_vendor_id_idx')"))[0].n,2);checks++;
 const policies=await sql("SELECT qual FROM pg_policies WHERE policyname='active_account_access'");assert.ok(policies.every(p=>p.qual.includes('SELECT')));checks++;
 await role(1);const plan=await sql('EXPLAIN (FORMAT JSON) SELECT id FROM public.orders');assert.ok(JSON.stringify(plan).includes('InitPlan'));checks++;
 // Preview-to-prepare dependency changes are rechecked under the new locks.
 const clean=(await sql(`SELECT public.admin_preview_account_removal('customer','${id(9)}') r`))[0].r;
 assert.equal(clean.blockers.length,0);checks++;
 await root();await db.exec('BEGIN');
 await db.exec(`INSERT INTO public.orders(id,ticket_number,customer_id,delivery_date,total,payment_method,status) VALUES('${id(12)}','OB-RACE','${id(9)}',current_date+2,100,'payfast','pending_payment');`);
 await reject(`SELECT public.prepare_account_removal('${id(1)}','customer','${id(9)}','${clean.fingerprint}','customer:${id(9)}')`);
 await db.exec('ROLLBACK');
 const prepared=(await sql(`SELECT public.prepare_account_removal('${id(1)}','customer','${id(9)}','${clean.fingerprint}','customer:${id(9)}') r`))[0].r;
 assert.ok(prepared.jobId);checks++;
 const retry=(await sql(`SELECT public.prepare_account_removal('${id(1)}','customer','${id(9)}','${clean.fingerprint}','customer:${id(9)}') r`))[0].r;
 assert.equal(retry.jobId,prepared.jobId);checks++;
 await reject(`INSERT INTO public.orders(id,ticket_number,customer_id,delivery_date,total,status) VALUES('${id(12)}','OB-REMOVED','${id(9)}',current_date+2,100,'pending_payment')`);
 console.log(`${checks} corrective migration/security/lifecycle/receipt/count/plan checks passed in isolated PostgreSQL.`);
}
