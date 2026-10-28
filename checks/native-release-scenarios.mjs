import {randomUUID} from 'node:crypto';
// Called exclusively by the native identity-guarded harness. All records are synthetic.
export async function verify({q,eq,reject,rootRole,as,id,connect,proof,beforeContainment}){
 const one=async(sql,args=[])=>(await q(sql,args)).rows[0];
 const denied=(sql,args=[],pattern=/permission|privileged|owner|independent|required|compliance|review|immutable|expired|revoked|constraint|version|changed|scope|bank receipt/i)=>reject(sql,args,pattern);
 await q('CREATE TRIGGER native_auth_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()');
 for(const [n,role] of [[10,'admin'],[11,'service_role'],[12,'vendor'],[13,'vendor']])await q('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id(n),'synthetic-'+n+'@synthetic.invalid',JSON.stringify({role,name:'Synthetic '+n,business_name:'Synthetic applicant '+n,business_category:'Meals',status:'approved',commission_rate:0})]);
 eq((await one('SELECT role FROM public.profiles WHERE id=$1',[id(10)])).role,'customer');
 eq((await one('SELECT role FROM public.profiles WHERE id=$1',[id(11)])).role,'customer');
 const vendor=(await one('SELECT vendor_id id FROM public.profiles WHERE id=$1',[id(12)])).id;
 const other=(await one('SELECT vendor_id id FROM public.profiles WHERE id=$1',[id(13)])).id;
 eq((await one('SELECT status FROM public.vendors WHERE id=$1',[vendor])).status,'pending');
 eq(Number((await one('SELECT commission_rate FROM public.vendors WHERE id=$1',[vendor])).commission_rate),0.17);
 await as(12);await denied("INSERT INTO public.vendors(owner_id,name,category,status,commission_rate) VALUES(auth.uid(),'Synthetic forged','Meals','approved',0)");
 await denied('UPDATE public.vendors SET commission_rate=0 WHERE id=$1',[vendor]);
 await denied("UPDATE public.vendors SET status='approved' WHERE id=$1",[vendor]);
 await denied('SELECT public.get_vendor_compliance($1)',[other]);
 const destination={accountHolder:'SYNTHETIC NOT A REAL ACCOUNT',bank:'SYNTHETIC BANK',accountNumber:'0000000000',accountType:'Current',branchCode:'000000',shapId:'synthetic-only@invalid'};
 const bank=(await one('SELECT public.submit_vendor_payment_profile($1,$2,true,true) id',[vendor,JSON.stringify(destination)])).id;
 await denied('SELECT public.approve_vendor_payment_profile($1,$2)',[bank,'Synthetic self-approval forbidden']);
 await as(13);await denied('SELECT public.submit_vendor_payment_profile($1,$2,true,false)',[vendor,JSON.stringify(destination)]);
 await rootRole();
 const business=Object.fromEntries(['legalName','registrationNumber','tradingName','email','telephone','website','businessAddress','legalNoticeAddress','vatTreatment','informationOfficer','informationOfficerContact','officeBearers','placeOfRegistration','recordAccess','retentionReference','supportHours','transferDisclosure','disclosureApprovalReference'].map(k=>[k,'SYNTHETIC FIXTURE '+k]));business.vatStatus='not_registered';
 await q('UPDATE private.commercial_settings SET business=$1',[JSON.stringify(business)]);
 const adminAction=async(a,v)=>(await one('SELECT public.admin_commercial_action($1,$2) r',[a,JSON.stringify(v)])).r;
 const checks=Object.fromEntries(['completeText','businessDisclosures','capabilities','consumerRights','feesAndVat','privacyAndStorage','notices','legalSignoff'].map(k=>[k,true]));
 const docs={};
 await as(1);const testDraft=await adminAction('document',{kind:'terms',version:'synthetic-unapproved',title:'SYNTHETIC Terms',content:'SYNTHETIC ONLY. Fictional legal content for isolated testing. Never real legal terms.',effective_at:'2025-01-01'});
 await as(6);await denied('SELECT public.admin_commercial_action($1,$2)',['approve_document',JSON.stringify({id:testDraft.id,approvalReference:'SYNTHETIC independent approval',expectedHash:testDraft.content_hash,checks})],/release-disabled/);
 await rootRole();await q('UPDATE private.commercial_settings SET legal_publication_enabled=true,vendor_clickwrap_enabled=true,customer_legal_enabled=true');
 for(const kind of ['terms','privacy','refund-policy','delivery','cookies','company-information','vendor-agreement','vendor-fees','vendor-standards']){
  await as(1);const d=await adminAction('document',{kind,version:'synthetic-native-'+kind,title:'SYNTHETIC '+kind,content:'SYNTHETIC ONLY. Fictional complete text for disposable regression evidence. Never real vendor or customer terms.',effective_at:'2025-01-01',vendor_id:kind==='vendor-fees'?vendor:null});
  await denied('SELECT public.admin_commercial_action($1,$2)',['approve_document',JSON.stringify({id:d.id,approvalReference:'SYNTHETIC self approval',expectedHash:d.content_hash,checks})],/Independent/i);
  await as(6);docs[kind]=await adminAction('approve_document',{id:d.id,approvalReference:'SYNTHETIC independent approval only',expectedHash:d.content_hash,checks,approved_by:id(12),approved_at:'2000-01-01'});
  eq(docs[kind].approved_by,id(6));eq(docs[kind].content_hash,d.content_hash);
 }
 const action=async(a,v={})=>(await one('SELECT public.admin_vendor_compliance($1,$2,$3) r',[vendor,a,JSON.stringify({reason:'SYNTHETIC independent review only',...v})])).r;
 await as(1);await action('assign',{agreement:docs['vendor-agreement'].id,schedule:docs['vendor-fees'].id,standards:docs['vendor-standards'].id,privacy:docs.privacy.id,refunds:docs['refund-policy'].id,changeBasis:'initial',notifiedAt:'2025-01-01',effectiveAt:'2025-02-01',approved_by:id(12)});
 await rootRole();const assignment=(await one('SELECT id FROM private.vendor_legal_assignments WHERE vendor_id=$1',[vendor])).id;
 await as(13);await denied('SELECT public.accept_assigned_vendor_agreement($1,true)',[assignment]);
 await as(12);await denied('SELECT public.accept_assigned_vendor_agreement($1,false)',[assignment]);
 const receipt=(await one('SELECT public.accept_assigned_vendor_agreement($1,true) r',[assignment])).r;
 eq(receipt.actor_id,id(12));eq(receipt.vendor_id,vendor);
 eq((await one('SELECT public.accept_assigned_vendor_agreement($1,true) r',[assignment])).r,receipt);
 const evidence={};
 for(const kind of ['identity','food_premises','coa','operations']){
  const s=(await one('SELECT public.reserve_vendor_evidence($1,$2) r',[kind,'SYNTHETIC evidence only'])).r;
  await denied('SELECT public.finalize_vendor_evidence($1)',[s.id],/upload|required/i);
  await q("INSERT INTO storage.objects(bucket_id,name,owner_id,owner,metadata) VALUES('vendor-compliance',$1,$2,$3,$4)",[s.path,id(12),id(12),JSON.stringify({mimetype:'application/pdf',size:128})]);
  await q('SELECT public.finalize_vendor_evidence($1)',[s.id]);evidence[kind]=s.id;
 }
 await as(1);await denied('SELECT public.admin_vendor_compliance($1,$2,$3)',[vendor,'complete_review',JSON.stringify({reason:'SYNTHETIC missing verification'})]);
 const expiry=new Date(Date.now()+86400000).toISOString();
 for(const subject of Object.values(evidence))await action('verify',{id:subject,validUntil:expiry,reviewer_id:id(12),at:'2000-01-01'});
 await action('verify_bank',{id:bank,validUntil:expiry});await action('complete_review');await action('activate');
 eq((await one('SELECT public.get_vendor_compliance($1) r',[vendor])).r.workflow,'approved');
 await rootRole();await denied('UPDATE private.vendor_compliance_events SET actor_id=$1',[id(12)]);
 await q("INSERT INTO public.meals(id,vendor_id,name,category,price) VALUES($1,$2,'SYNTHETIC meal','Meals',100)",[id(20),vendor]);
 await q("UPDATE private.gateway_settings SET enabled=true,maintenance=false WHERE provider IN('manual_eft','manual_payshap')");
 const legal={acknowledged:true,documents:Object.fromEntries(['terms','privacy','refund-policy','delivery','cookies','company-information'].map(k=>[k,docs[k].id])),actor_id:id(1),accepted_at:'2000-01-01',content_hash:'forged',marketing:true};
 const payload=(customer=null,method='manual_eft',request=randomUUID())=>({p_customer_id:customer,p_guest_name:customer?null:'SYNTHETIC guest',p_guest_contact:customer?null:'0820000000',p_guest_email:null,p_delivery_date:new Date(Date.now()+7*86400000).toISOString().slice(0,10),p_delivery_location:'SYNTHETIC typed fulfilment',p_items:[{mealId:id(20),qty:1}],p_quote_id:null,p_method:method,p_request_id:request});
 const create=async(p,l=legal)=>(await one('SELECT public.create_order_with_legal($1,$2) r',[JSON.stringify(p),JSON.stringify(l)])).r;
 await as(null);eq((await one('SELECT public.get_vendor_manual_methods($1) r',[vendor])).r,{manual_eft:true,manual_payshap:true});
 await denied('SELECT public.create_order_with_legal($1,$2)',[JSON.stringify(payload()),JSON.stringify({...legal,acknowledged:false})]);
 await denied('SELECT public.create_order_with_legal($1,$2)',[JSON.stringify(payload()),JSON.stringify({...legal,documents:{...legal.documents,terms:randomUUID()}})],/version changed/i);
 const p=payload();const guest=await create(p);eq(guest.legalReceipt.actor_id,null);eq(guest.legalReceipt.is_guest,true);eq(guest.legalReceipt.marketing,undefined);eq(guest.legalReceipt.documents.terms.content_hash,docs.terms.content_hash);
 const instructions=(await one('SELECT public.get_manual_payment($1,$2) r',[guest.id,guest.payment_token])).r;
 eq(instructions.destination,destination);eq(Number(instructions.amount),100);
 eq(instructions.reference,guest.ticket_number);eq(instructions.state,'awaiting_payment');
 await as(13);await denied('SELECT public.get_manual_payment($1,NULL)',[guest.id],/Payment access unavailable/);
 await as(2);await denied('SELECT public.verify_manual_payment($1,100,$2,false)',[guest.id,'SYNTHETIC CUSTOMER CANNOT SETTLE']);
 await as(null);
 eq((await create(p)).id,guest.id);
 await denied('SELECT public.create_order_with_legal($1,$2)',[JSON.stringify({...p,p_items:[{mealId:id(20),qty:2}]}),JSON.stringify(legal)],/changed/);
 await denied('SELECT public.get_manual_payment($1,NULL)',[guest.id],/capability|author|access|proof|token|ownership/i);
 eq((await one('SELECT public.get_order_legal_receipt($1,$2) r',[guest.id,guest.payment_token])).r,guest.legalReceipt);
 await q('SELECT public.report_manual_payment($1,$2)',[guest.id,guest.payment_token]);
 await rootRole();eq((await one('SELECT payment_status FROM public.order_suborders WHERE order_id=$1',[guest.id])).payment_status,'unpaid');
 const contract=await one('SELECT fee_snapshot,vendor_acceptance_id FROM private.manual_order_payments WHERE order_id=$1',[guest.id]);
 eq(contract.vendor_acceptance_id,receipt.id);eq(contract.fee_snapshot.combinedRate,0.17);eq(contract.fee_snapshot.platformRate,0.15);eq(contract.fee_snapshot.transactionRate,0.02);eq(contract.fee_snapshot.marketingEnabled,false);
 await denied("UPDATE private.manual_order_payments SET fee_snapshot='{}' WHERE order_id=$1",[guest.id]);
 await q('UPDATE public.vendors SET commission_rate=0.25 WHERE id=$1',[vendor]);
 await as(null);eq((await one('SELECT public.get_vendor_manual_methods($1) r',[vendor])).r,{});
 await as(1);await denied('SELECT public.admin_verify_payment($1,true)',[guest.id],/bank receipt/);
 eq((await one('SELECT public.verify_manual_payment($1,100,$2,false) r',[guest.id,'SYNTHETIC RECEIPT ONE'])).r,'paid');
 eq((await one('SELECT public.verify_manual_payment($1,100,$2,false) r',[guest.id,'SYNTHETIC RECEIPT ONE'])).r,'paid');
 await rootRole();eq(Number((await one('SELECT commission_amount FROM public.order_suborders WHERE order_id=$1',[guest.id])).commission_amount),17);
 await q('UPDATE public.vendors SET commission_rate=0.17 WHERE id=$1',[vendor]);
 eq((await one('SELECT count(*) n FROM private.manual_receivables WHERE order_id=$1',[guest.id])).n,1);
 await as(2);const member=await create(payload(id(2),'manual_payshap'));eq(member.legalReceipt.actor_id,id(2));eq(member.legalReceipt.is_guest,false);
 await as(1);eq((await one('SELECT public.verify_manual_payment($1,99,$2,false) r',[member.id,'SYNTHETIC WRONG AMOUNT'])).r,'under_review');
 await rootRole();eq((await one('SELECT payment_status FROM public.order_suborders WHERE order_id=$1',[member.id])).payment_status,'unpaid');
 // Expired instructions and cancelled orders require review even with a bank
 // reference; neither may silently become paid through normal confirmation.
 await rootRole();const priorMinutes=(await one('SELECT deadline_minutes FROM private.manual_payment_settings')).deadline_minutes;
 await q('UPDATE private.manual_payment_settings SET deadline_minutes=5');
 await as(null);const timedOut=await create(payload());await rootRole();
 await q('UPDATE private.manual_payment_settings SET deadline_minutes=$1',[priorMinutes]);
 await denied("UPDATE private.manual_order_payments SET deadline=clock_timestamp()-interval '1 minute' WHERE order_id=$1",[timedOut.id],/immutable/);
 const expires=(await one('SELECT deadline FROM private.manual_order_payments WHERE order_id=$1',[timedOut.id])).deadline;
 const remaining=new Date(expires).getTime()-Date.now()+1000;
 if(remaining<0||remaining>301000)throw new Error('Unexpected fixture expiry window');
 console.log('Waiting for real five-minute fixture expiry; immutable history remains protected.');
 await new Promise(resolve=>setTimeout(resolve,remaining));
 await as(null);eq((await one('SELECT public.get_manual_payment($1,$2) r',[timedOut.id,timedOut.payment_token])).r.state,'expired');
 await denied('SELECT public.report_manual_payment($1,$2)',[timedOut.id,timedOut.payment_token],/deadline|review/i);
 await as(12);eq((await one('SELECT public.verify_manual_payment($1,100,$2,false) r',[timedOut.id,'SYNTHETIC EXPIRED RECEIPT'])).r,'under_review');
 await rootRole();eq((await one('SELECT payment_status FROM public.order_suborders WHERE order_id=$1',[timedOut.id])).payment_status,'unpaid');
 await as(null);const declined=await create(payload());
 await q('SELECT public.cancel_unpaid_order($1,$2,$3)',[declined.id,declined.ticket_number,'0820000000']);
 eq((await one('SELECT public.get_manual_payment($1,$2) r',[declined.id,declined.payment_token])).r.state,'cancelled');
 await as(1);eq((await one('SELECT public.verify_manual_payment($1,100,$2,false) r',[declined.id,'SYNTHETIC CANCELLED RECEIPT'])).r,'under_review');
 await rootRole();eq((await one('SELECT payment_status FROM public.order_suborders WHERE order_id=$1',[declined.id])).payment_status,'unpaid');
 await as(1);
 await as(1);await denied('SELECT public.verify_manual_payment($1,100,$2,false)',[member.id,'SYNTHETIC RECEIPT ONE'],/duplicate|unique/i);
 if(beforeContainment)await beforeContainment({q,eq,reject,rootRole,as,id,vendor,receipt,guest,member,create,payload,legal});
 // Expiry between the successful create call and COMMIT must roll back everything.
 await action('verify',{id:evidence.operations,validUntil:new Date(Date.now()+2500).toISOString()});await action('complete_review');
 await as(null);const expiring=payload();await q('BEGIN');await create(expiring);await q('SELECT pg_sleep(2.7)');
 await denied('COMMIT',[],/expired|review|compliance/i);await q('ROLLBACK');await rootRole();
 eq((await one('SELECT count(*) n FROM private.manual_order_payments WHERE request_id=$1',[expiring.p_request_id])).n,0);
 await as(1);await action('verify',{id:evidence.operations,validUntil:expiry});await action('complete_review');
 const clients=await Promise.all([connect(),connect()]);
 try{
  for(const c of clients){await proof(c);await c.query("SET statement_timeout='8s';SET ROLE anon;SELECT set_config('request.jwt.claim.role','anon',false),set_config('request.jwt.claim.sub','',false)");}
  const concurrent=payload();const results=await Promise.all(clients.map(c=>c.query('SELECT public.create_order_with_legal($1,$2) r',[JSON.stringify(concurrent),JSON.stringify(legal)])));
  eq(results[0].rows[0].r.id,results[1].rows[0].r.id);
  await rootRole();eq((await one('SELECT count(*) n FROM private.manual_order_payments WHERE request_id=$1',[concurrent.p_request_id])).n,1);
  for(const c of clients){await c.query('RESET ROLE');await c.query("SELECT set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)",[id(1)]);await c.query('SET ROLE authenticated');}
  // Two independent reviewers racing the same receipt must create one ledger obligation.
  const verified=await Promise.all(clients.map(c=>c.query('SELECT public.verify_manual_payment($1,100,$2,false) r',[results[0].rows[0].r.id,'SYNTHETIC CONCURRENT RECEIPT'])));
  eq(verified.map(r=>r.rows[0].r),['paid','paid']);
  eq((await one('SELECT count(*) n FROM private.manual_receivables WHERE order_id=$1',[results[0].rows[0].r.id])).n,1);
  eq((await one("SELECT count(*) n FROM private.manual_payment_events WHERE order_id=$1 AND action='bank_receipt_verified'",[results[0].rows[0].r.id])).n,1);
  // Customer cancellation wins only while still unpaid; it cannot erase a reported transfer.
  await as(null);const cancelled=await create(payload());await q('SELECT public.cancel_unpaid_order($1,$2,$3)',[cancelled.id,cancelled.ticket_number,'0820000000']);
  await q('SELECT public.cancel_unpaid_order($1,$2,$3)',[cancelled.id,cancelled.ticket_number,'0820000000']);
  await rootRole();eq((await one('SELECT status FROM public.orders WHERE id=$1',[cancelled.id])).status,'cancelled');
  await as(null);const reported=await create(payload());await q('SELECT public.report_manual_payment($1,$2)',[reported.id,reported.payment_token]);
  await denied('SELECT public.cancel_unpaid_order($1,$2,$3)',[reported.id,reported.ticket_number,'0820000000'],/reported|review/i);
  await as(1);const revision=(await one('SELECT public.manual_payment_workspace(false) r')).r.settings.settings_revision;
  const saves=await Promise.allSettled(clients.map(c=>c.query('SELECT public.admin_manual_settings_checked(false,false,15,500,$1,$2)',['SYNTHETIC simultaneous settings save',revision])));
  eq(saves.filter(r=>r.status==='fulfilled').length,1);eq(saves.filter(r=>r.status==='rejected'&&r.reason.code==='40001').length,1);
 }finally{await Promise.all(clients.map(c=>c.end()));}
 await as(1);
 await q('SELECT public.record_manual_refund_status($1,$2,20,20,$3)',[guest.id,'requested','SYNTHETIC refund requested evidence']);
 await q('SELECT public.record_manual_refund_status($1,$2,20,20,$3)',[guest.id,'completed','SYNTHETIC bank refund completed evidence']);
 await q('SELECT public.record_manual_refund_status($1,$2,20,20,$3)',[guest.id,'completed','SYNTHETIC bank refund completed evidence']);
 await rootRole();eq((await one("SELECT count(*) n FROM private.manual_receivable_entries WHERE order_id=$1 AND kind='refund'",[guest.id])).n,1);
 eq(Number((await one("SELECT commission_credit FROM private.manual_receivable_entries WHERE order_id=$1 AND kind='refund'",[guest.id])).commission_credit),3.4);
 await denied('DELETE FROM private.manual_payment_events WHERE order_id=$1',[guest.id]);
 await denied('DELETE FROM private.order_legal_acceptances WHERE order_id=$1',[guest.id]);
 await as(13);await denied('SELECT public.verify_manual_payment($1,100,$2,false)',[member.id,'SYNTHETIC CROSS VENDOR']);
 await rootRole();
 for(const role of ['anon','authenticated']){
  eq((await one('SELECT has_table_privilege($1,$2,$3) ok',[role,'public.orders','TRUNCATE'])).ok,false);
  eq((await one('SELECT has_table_privilege($1,$2,$3) ok',[role,'private.vendor_payment_profiles','SELECT'])).ok,false);
  eq((await one('SELECT has_function_privilege($1,$2,$3) ok',[role,'private.create_order_core(uuid,text,text,text,date,text,jsonb)','EXECUTE'])).ok,false);
 }
 await as(null);eq((await one('SELECT public.get_vendor_manual_methods($1) r',[vendor])).r,{manual_eft:false,manual_payshap:false});
 await as(1);await action('revoke_bank',{id:bank});await rootRole();eq((await one('SELECT private.vendor_launch_ready($1) ready',[vendor])).ready,false);
 await as(1);await denied('SELECT public.admin_vendor_compliance($1,$2,$3)',[vendor,'verify_bank',JSON.stringify({id:bank,validUntil:expiry,reason:'SYNTHETIC revoked bank cannot restore'})],/new profile/);
 await action('suspend');await denied('SELECT public.admin_vendor_compliance($1,$2,$3)',[vendor,'activate',JSON.stringify({reason:'SYNTHETIC activation bypass forbidden'})]);
 await rootRole();await q('UPDATE private.commercial_settings SET legal_publication_enabled=false,customer_legal_enabled=false,vendor_clickwrap_enabled=false');
 eq((await one('SELECT bool_and(NOT enabled) closed FROM private.gateway_settings')).closed,true);
 console.log('Native concurrent checkout and settings scenarios completed.');
}
