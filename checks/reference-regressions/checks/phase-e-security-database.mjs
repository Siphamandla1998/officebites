import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
export async function verifyPhaseE(db) {
 assert.ok(db instanceof PGlite,'Fresh disposable PGlite only');let checks=0;
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const root=()=>db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");
 const as=async n=>{await root();await db.exec(`SELECT set_config('request.jwt.claim.sub','${n?id(n):''}',false),set_config('request.jwt.claim.role','${n?'authenticated':'anon'}',false);SET ROLE ${n?'authenticated':'anon'}`);};
 const q=async(sql,args=[])=>{try{return (await db.query(sql,args)).rows[0];}catch(e){console.error('Phase E SQL diagnostic',JSON.stringify({sql,message:e.message,where:e.where,internalQuery:e.internalQuery}));throw e;}};
 const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
 const reject=async(sql,args=[],pattern=/required|release-disabled|immutable|permission|changed|approved|review|independent|predates/i)=>{await assert.rejects(()=>db.query(sql,args),pattern);checks++;};
 await root();const flags=(await q('SELECT to_jsonb(s) r FROM private.commercial_settings s')).r;
 const gateways=(await db.query('SELECT * FROM private.gateway_settings ORDER BY provider')).rows;
 const orders=(await db.query('SELECT id,total,status FROM public.orders ORDER BY id')).rows;
 const acceptances=(await db.query('SELECT * FROM private.vendor_legal_acceptances ORDER BY id')).rows;
 await db.exec(fs.readFileSync('supabase/migrations/20261026112602_phase_e_legal_publication_checkout_evidence.sql','utf8'));
 eq((await q('SELECT legal_publication_enabled x FROM private.commercial_settings')).x,false);
 eq((await q('SELECT customer_legal_enabled x FROM private.commercial_settings')).x,false);
 eq((await db.query('SELECT * FROM private.gateway_settings ORDER BY provider')).rows,gateways);
 eq((await db.query('SELECT id,total,status FROM public.orders ORDER BY id')).rows,orders);
 eq((await db.query('SELECT * FROM private.vendor_legal_acceptances ORDER BY id')).rows,acceptances);
 eq((await q('SELECT acquisition_enabled x FROM private.commercial_settings')).x,false);
 await as(null);await reject('SELECT * FROM private.order_legal_acceptances');await reject('SELECT private.customer_legal_documents()');
 const state=async()=>(await q('SELECT public.get_customer_legal_state() r')).r;
 eq((await state()).enabled,false);
 await as(2);await reject("SELECT public.admin_commercial_action('approve_document','{}')");
 await root();await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[id(9800),'phase-e-reviewer@test.invalid',JSON.stringify({role:'customer'})]);
 await db.exec(`SELECT set_config('request.jwt.claim.sub','${id(1)}',false)`);await db.query("UPDATE public.profiles SET role='admin' WHERE id=$1",[id(9800)]);
 const business={legalName:'SYNTHETIC TEST COMPANY',registrationNumber:'SYNTHETIC-ONLY',tradingName:'SYNTHETIC',email:'synthetic@test.invalid',telephone:'0000000000',website:'https://synthetic.test.invalid',businessAddress:'SYNTHETIC address',legalNoticeAddress:'SYNTHETIC service address',vatTreatment:'SYNTHETIC not registered',informationOfficer:'SYNTHETIC officer',informationOfficerContact:'synthetic@test.invalid',officeBearers:'SYNTHETIC director',placeOfRegistration:'SYNTHETIC jurisdiction',recordAccess:'SYNTHETIC record access decision',retentionReference:'SYNTHETIC retention approval',supportHours:'SYNTHETIC support hours',transferDisclosure:'SYNTHETIC transfer inventory',disclosureApprovalReference:'SYNTHETIC final disclosure signoff',vatStatus:'not_registered'};
 await db.exec('UPDATE private.pilot_policy SET enabled=false;UPDATE private.collection_activation SET eft_until=NULL');
 await db.query('UPDATE private.commercial_settings SET business=$1',[business]);
 await as(1);await reject('SELECT public.admin_commercial_action($1,$2)',['offer',{}],/Marketing offers disabled/);
 const approved={};const reviewChecks=Object.fromEntries(['completeText','businessDisclosures','capabilities','consumerRights','feesAndVat','privacyAndStorage','notices','legalSignoff'].map(k=>[k,true]));
 const action=async(a,v)=>(await q('SELECT public.admin_commercial_action($1,$2) r',[a,v])).r;
 let counter=0;
 const draft=async(kind,content='SYNTHETIC ONLY. Complete fictional text used solely for isolated security tests. Never actual published legal terms.')=>{
  await as(1);return action('document',{kind,version:'phase-e-'+(++counter),title:'SYNTHETIC '+kind,content,effective_at:new Date(Date.now()-60000).toISOString()});
 };
 const approval=d=>({id:d.id,approvalReference:'SYNTHETIC independent signed-off reference',expectedHash:d.content_hash,checks:reviewChecks,approved_by:id(2),approved_at:'2000-01-01'});
 const terms=await draft('terms');await as(9800);await reject('SELECT public.admin_commercial_action($1,$2)',['approve_document',approval(terms)],/release-disabled/);
 await root();await db.exec('UPDATE private.commercial_settings SET legal_publication_enabled=true');
 await as(1);await reject('SELECT public.admin_commercial_action($1,$2)',['approve_document',approval(terms)],/Independent/);
 await as(9800);await reject('SELECT public.admin_commercial_action($1,$2)',['approve_document',{...approval(terms),checks:{}}],/checklist/);
 await reject('SELECT public.admin_commercial_action($1,$2)',['approve_document',{...approval(terms),expectedHash:'forged'}],/hash/);
 for(const text of ['WORKING DRAFT - NOT FOR PUBLICATION. '+'incomplete '.repeat(8),'Final legal text. [VERIFY VAT BEFORE PUBLICATION] '+'incomplete '.repeat(8)]){
  const d=await draft('terms',text);await as(9800);await reject('SELECT public.admin_commercial_action($1,$2)',['approve_document',approval(d)],/complete text/);
 }
 // Supplied legal working drafts are negative fixtures, not approved application imports.
 for(const [kind,file] of [['terms','Terms_Revision_A'],['privacy','Privacy_Revision_A'],['refund-policy','Refunds_Revision_A'],['delivery','Delivery_Revision_B'],['cookies','Cookies_Revision_B'],['company-information','Company_Information_Revision_B']]){
  const d=await draft(kind,fs.readFileSync('docs/legal-implementation/policies/'+file+'.md','utf8'));await as(9800);
  await reject('SELECT public.admin_commercial_action($1,$2)',['approve_document',approval(d)],/complete text/);
 }
 for(const kind of ['terms','privacy','refund-policy','delivery','cookies','company-information']){
  const d=kind==='terms'?terms:await draft(kind);await as(9800);const reviewed=await action('approve_document',approval(d));approved[kind]=reviewed.id;
  eq(reviewed.approved_by,id(9800));eq(reviewed.approval_manifest.hash,d.content_hash);eq(reviewed.approval_manifest.checks,reviewChecks);
 }
 await root();eq(Number((await q("SELECT count(*) n FROM private.commercial_audit WHERE action='approve_document' AND actor_id=$1",[id(9800)])).n),6);
 await reject("UPDATE private.legal_versions SET approval_manifest='{}' WHERE id=$1",[terms.id]);
 await as(null);eq((await state()).ready,true);eq((await state()).enabled,false);
 const payload=(request=id(9810),customer=null)=>({p_customer_id:customer,p_guest_name:customer?null:'SYNTHETIC guest',p_guest_contact:customer?null:'0821234567',p_guest_email:null,p_delivery_date:new Date(Date.now()+7*86400000).toISOString().slice(0,10),p_delivery_location:'SYNTHETIC office',p_items:[{mealId:id(807),qty:1}],p_quote_id:null,p_method:'manual_eft',p_request_id:request});
 const legal={acknowledged:true,documents:approved,actor_id:id(1),accepted_at:'2000-01-01',content_hash:'forged',marketing:true};
 const create=async(p,l=legal)=>(await q('SELECT public.create_order_with_legal($1,$2) r',[p,l])).r;
 await reject('SELECT public.create_order_with_legal($1,$2)',[payload(),legal],/release-disabled/);
 // All enabling below is solely inside this disposable process; never provider calls.
 await root();await db.exec("UPDATE private.commercial_settings SET customer_legal_enabled=true;UPDATE private.pilot_policy SET enabled=true;UPDATE private.collection_activation SET eft_until=now()+interval '1 hour',approval_reference='SYNTHETIC PHASE E FIXTURE ONLY';UPDATE private.gateway_settings SET enabled=true,maintenance=false WHERE provider='manual_eft';UPDATE private.delivery_settings SET enabled=false");
 await db.query("INSERT INTO private.pilot_windows(id,vendor_id,mode,starts_at,ends_at,cutoff_at,preparation_minutes,capacity,available) VALUES($1,$2,'collection',current_date+7+interval '10 hours',current_date+7+interval '11 hours',now()+interval '1 day',30,100,true)",[id(9870),id(805)]);
 // Independently prepare the unrelated legacy fixture; D intentionally enrolled vendor 804.
 await as(803);await q('SELECT public.vendor_set_service_date($1,current_date+7,true,0,$2,$3)',[id(805),id(9869),'SYNTHETIC approved E service date']);const banking=(await q('SELECT public.submit_vendor_payment_profile($1,$2,true,false) id',[id(805),{accountHolder:'SYNTHETIC E vendor',bank:'Synthetic bank',accountNumber:'123456789',accountType:'Current',branchCode:'123456'}])).id;
 await as(9800);await q('SELECT public.admin_vendor_compliance($1,$2,$3)',[id(805),'verify_bank',{id:banking,validUntil:'2099-01-01',reason:'SYNTHETIC independent E bank verification'}]);
 await root();await db.query("INSERT INTO private.collection_agreements(vendor_id,version,revision,rate,approved_by,evidence) VALUES($1,'SYNTHETIC-E',1,0.17,$2,'SYNTHETIC independent E commercial agreement')",[id(805),id(9800)]);
 const policy=(await q('SELECT revision FROM private.pilot_policy')).revision;
 const collectionPayload=(request=id(9810),customer=null)=>({p_customer_id:customer,p_guest_name:customer?null:'SYNTHETIC guest',p_guest_contact:customer?null:'0821234567',p_items:[{mealId:id(807),qty:1}],p_method:'manual_eft',p_request_id:request,p_window_id:id(9870),p_destination_id:id(9200),p_policy_revision:policy,p_window_revision:1});
 await as(null);await reject('SELECT public.create_order_with_legal($1,$2)',[collectionPayload(),{...legal,acknowledged:false}]);
 await reject('SELECT public.create_order_with_legal($1,$2)',[collectionPayload(),{...legal,documents:{...approved,terms:id(9999)}}],/version changed/);
 await reject('SELECT public.create_order_with_legal($1,$2)',[collectionPayload(id(9810),id(2)),legal],/identity/);
 const guest=await create(collectionPayload());eq(guest.legalReceipt.is_guest,true);eq(guest.legalReceipt.actor_id,null);eq(guest.legalReceipt.documents.terms.id,terms.id);
 eq(guest.legalReceipt.documents.terms.content_hash,terms.content_hash);eq(guest.legalReceipt.accepted_at.startsWith('2000'),false);eq(guest.legalReceipt.marketing,undefined);
 eq((await create(collectionPayload())).legalReceipt,guest.legalReceipt);
 await reject('SELECT public.create_order_with_legal($1,$2)',[{...collectionPayload(),p_items:[{mealId:id(807),qty:2}]},legal],/changed/);
 await reject('SELECT public.get_order_legal_receipt($1,NULL)',[guest.id],/capability/);
 eq((await q('SELECT public.get_order_legal_receipt($1,$2) r',[guest.id,guest.payment_token])).r,guest.legalReceipt);
 await as(2);await reject('SELECT public.get_order_legal_receipt($1,NULL)',[guest.id],/capability/);
 const member=await create(collectionPayload(id(9811),id(2)));eq(member.legalReceipt.actor_id,id(2));eq(member.legalReceipt.is_guest,false);
 eq((await q('SELECT public.get_order_legal_receipt($1,NULL) r',[member.id])).r,member.legalReceipt);
 await root();await reject("DELETE FROM private.order_legal_acceptances WHERE order_id=$1",[guest.id]);
 // Old checkout RPC cannot commit a new order without evidence once enforcement is enabled.
 await as(null);const p=collectionPayload(id(9812));await reject('SELECT public.create_collection_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',Object.values(p),/legal review/);
 await root();eq(Number((await q('SELECT count(*) n FROM private.manual_order_payments WHERE request_id=$1',[p.p_request_id])).n),0);
 const newer=await draft('terms');await as(9800);await action('approve_document',approval(newer));
 await as(null);eq((await create(collectionPayload())).legalReceipt,guest.legalReceipt);
 await reject('SELECT public.create_order_with_legal($1,$2)',[collectionPayload(id(9813)),legal],/version changed/);
 await root();eq((await q('SELECT acquisition_enabled x FROM private.commercial_settings')).x,false);
 await db.exec('UPDATE private.pilot_policy SET enabled=false;UPDATE private.collection_activation SET eft_until=NULL');
 await db.query('UPDATE private.commercial_settings SET legal_publication_enabled=false,customer_legal_enabled=false,business=$1',[flags.business]);
 for(const gateway of gateways)await db.query('UPDATE private.gateway_settings SET enabled=$1,maintenance=$2 WHERE provider=$3',[gateway.enabled,gateway.maintenance,gateway.provider]);
 console.log(`${checks} Phase E publication/customer/guest/immutable/version/release-disabled assertions passed in disposable PGlite. No hosted writes.`);
}