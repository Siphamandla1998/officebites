// Mock provider and database transport only. Never contacts Ozow or hosted Supabase.
import assert from 'node:assert/strict';
import { ozowHandler } from '../supabase/functions/_shared/ozow-handlers.ts';
const order='00000000-0000-4000-8000-000000000001';
const attempt='00000000-0000-4000-8000-000000000002';
const tx='00000000-0000-4000-8000-000000000003';
const payment='00000000-0000-4000-8000-000000000004';
const secret='whsec_'+btoa('synthetic-signing-material-only');
const config={SUPABASE_URL:'https://eyhmarmekioovcjibcbr.supabase.co',OZOW_ENVIRONMENT:'staging',OZOW_INITIATION_ENABLED:'true',OZOW_RECONCILIATION_ENABLED:'true',OZOW_CLIENT_ID:'synthetic',OZOW_CLIENT_SECRET:'synthetic',OZOW_SITE_CODE:'SYN-TEST-001',OZOW_RETURN_ORIGIN:'https://staging.example.invalid',ALLOWED_ORIGINS:'https://staging.example.invalid',OZOW_BENEFICIARY_REFERENCE:'TESTONLY',OZOW_WEBHOOK_SECRET:secret};
let calls=[], network=[], issued=false, bound=false, credited=false, admin=true, wrongAmount=false, failPayment=false, failBind=false, transactionPatch={};
const transaction=()=>({id:tx,status:'Successful',siteCode:config.OZOW_SITE_CODE,merchantReference:attempt,amount:{currency:'ZAR',value:wrongAmount?101:100},...transactionPatch});
const deps={env:n=>config[n],caller:async()=>null,isAdmin:async()=>admin,
 fetcher:async(url,options)=>{
  network.push([url,options]);assert.ok(url.startsWith('https://stagingone.ozow.com/v1/'));
  if(url.endsWith('/token'))return Response.json({access_token:'synthetic-token',expires_in:100});
  if(url.endsWith('/payments')){
   assert.equal(issued,true,'Attempt persisted before provider request');
   assert.equal(JSON.parse(options.body).amount.value,100);
   if(failPayment)throw new Error('Ambiguous network timeout');
   return Response.json({id:payment,status:'Created',redirectUrl:'https://pay.ozow.com/synthetic'});
  }
  assert.ok(url.endsWith('/transactions/'+tx));return Response.json(transaction());
 },
 rpc:async(name,args)=>{
  calls.push([name,args]);
  if(name==='begin_ozow_attempt'){
   if(issued)throw new Error('Reconcile first');issued=true;
   return {id:attempt,amount:100,reference:attempt,expires_at:new Date(Date.now()+600000).toISOString()};
  }
  if(name==='bind_ozow_payment'){if(failBind)throw new Error('DB timeout');bound=true;return null;}
  if(name==='get_ozow_attempt')return args.p_reference===attempt?{site_code:config.OZOW_SITE_CODE,amount:100,currency:'ZAR',environment:'staging'}:null;
  if(name==='record_ozow_transaction'){const duplicate=credited;credited=true;return {applied:!duplicate,duplicate};}
  throw new Error('Unexpected RPC '+name);
 }};
const req=body=>new Request('https://functions.example.invalid',{method:'POST',headers:{Origin:config.OZOW_RETURN_ORIGIN},body:JSON.stringify(body)});
let checks=0;
const expect=async(response,status)=>{assert.equal(response.status,status);checks++;return response.json();};
const initiate=ozowHandler('initiate',deps),reconcile=ozowHandler('reconcile',deps),webhook=ozowHandler('webhook',deps);
config.OZOW_INITIATION_ENABLED='false';await expect(await initiate(req({orderId:order})),503);assert.equal(network.length,0);checks++;
config.OZOW_INITIATION_ENABLED='true';
await expect(await initiate(req({orderId:order})),200);assert.equal(bound,true);checks++;
await expect(await initiate(req({orderId:order})),503);assert.equal(network.filter(([url])=>url.endsWith('/payments')).length,1);checks++;
admin=false;const before=network.length;await expect(await reconcile(req({transactionId:tx})),403);assert.equal(network.length,before);checks++;admin=true;
wrongAmount=true;await expect(await reconcile(req({transactionId:tx})),409);assert.equal(credited,false);checks++;wrongAmount=false;
for (const [patch,status] of [[{siteCode:'WRONG'},409],[{merchantReference:'unknown'},409],[{amount:{currency:'USD',value:100}},503],[{id:payment},503]]) {
 transactionPatch=patch;await expect(await reconcile(req({transactionId:tx})),status);assert.equal(credited,false);checks++;
} transactionPatch={};
await expect(await reconcile(req({transactionId:tx})),200);assert.equal(credited,true);checks++;
assert.equal((await expect(await reconcile(req({transactionId:tx})),200)).duplicate,true);checks++;
const payload=JSON.stringify({type:'transaction.complete',data:{id:tx,status:'Successful'}});
await expect(await webhook(new Request('https://test.invalid',{method:'POST',body:payload})),401);
const timestamp=String(Math.floor(Date.now()/1000)),delivery='msg_synthetic';
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('synthetic-signing-material-only'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
const signature=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${delivery}.${timestamp}.${payload}`)))));
const headers={'svix-id':delivery,'svix-timestamp':timestamp,'svix-signature':'v1,'+signature};
await expect(await webhook(new Request('https://test.invalid',{method:'POST',headers,body:payload+' '})),401);
await expect(await webhook(new Request('https://test.invalid',{method:'POST',headers,body:payload})),200);
assert.equal(calls.at(-1)[1].p_delivery_id,delivery);checks++;
issued=false;failPayment=true;await expect(await initiate(req({orderId:order})),503);assert.equal(issued,true);checks++;
failPayment=false;await expect(await initiate(req({orderId:order})),503);
issued=false;failBind=true;await expect(await initiate(req({orderId:order})),503);assert.equal(issued,true);checks++;
config.OZOW_ENVIRONMENT='production';const networkBefore=network.length;await expect(await initiate(req({orderId:order})),503);assert.equal(network.length,networkBefore);checks++;
console.log(`${checks} mocked Ozow initiation/webhook/reconciliation assertions passed; no real payments.`);
