// Isolated SDK/service and actual Edge-handler tests; no hosted requests/writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { createClient, AuthApiError } from '@supabase/supabase-js';
import { coordinatePair } from '../src/utils/coordinates.js';
let checks = 0;
for (const value of [null, undefined, '', ' ', NaN, Infinity, true, {}, 'oops', 91]) {
  assert.equal(coordinatePair(value, 20), null); checks++;
}
assert.deepEqual(coordinatePair(0, 0), { latitude: 0, longitude: 0 }); checks++;
assert.equal(coordinatePair(-90, 181), null); checks++;
for (const name of ['SecurityError','QuotaExceededError']) {
  globalThis.localStorage = { getItem() { throw new DOMException('Blocked',name); }, setItem() { throw new DOMException('Blocked',name); } };
  const guest = await import(`../src/utils/guest.js?${name}`);
  assert.equal(guest.addGuestOrder({id:'one',ticketNumber:'OB-ONE',contact:'fixture'}), false);
  assert.equal(guest.getGuestOrderAccess('one').contact,'fixture');
  assert.equal(guest.getGuestOrderAccess('unknown'),null);
  assert.equal(guest.getOrCreateGuestId(),guest.getOrCreateGuestId());
  guest.removeGuestOrder('one');assert.equal(guest.getGuestOrderAccess('one'),null);checks+=5;
}
let networkCalls=0;
const sdk=createClient('https://sdk-fixture.invalid','fixture-public-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async()=>{networkCalls++;throw new Error('Unexpected network');}}});
const missing=await sdk.auth.getUser();assert.equal(missing.error.name,'AuthSessionMissingError');assert.equal(networkCalls,0);checks+=2;
let authResult=missing,inserted=[];
globalThis.__supportMocks={supabase:{auth:{getUser:()=>authResult},from:()=>({insert:async row=>{inserted.push(row);return {error:null};}})},BUCKETS:{},uploadPrivate(){throw new Error('Unexpected upload');},getSignedUrl(){}};
const serviceSource=fs.readFileSync('src/services/supportService.js','utf8').replace(/import\s*\{[\s\S]*?\}\s*from\s*"\.\/api\/supabaseClient";/,'const {supabase,uploadPrivate,getSignedUrl,BUCKETS}=globalThis.__supportMocks;');
const {supportService}=await import('data:text/javascript;base64,'+Buffer.from(serviceSource).toString('base64'));
await supportService.submitFeedback({rating:5,comment:'Synthetic guest'});assert.equal(inserted[0].user_id,null);checks++;
await assert.rejects(()=>supportService.submitContactForm({subject:'Test',message:'Synthetic'}));checks++;
for(const error of [new AuthApiError('Expired token',401,'bad_jwt'),new Error('Network offline')]) {
  authResult={data:{user:null},error};await assert.rejects(()=>supportService.submitFeedback({rating:5}),new RegExp(error.message));checks++;
}
assert.equal(inserted.length,1);checks++;

let handler,profile={id:'owner',suspended:false,deleted_at:null},caller='owner',rpcCalls=0,prepareError=null;
let order={id:'order',customer_id:'owner',ticket_number:'OB-SYNTHETIC',status:'pending_payment',total:100,guest_contact:'fixture-contact'};
const admin={from:table=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='profiles'?profile:order,error:null})}),rpc:async()=>{rpcCalls++;return {data:order,error:prepareError};}};
const ctx={Request,Response,console,URL,Object,String,Number,Deno:{env:{get:key=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-fixture',SUPABASE_ANON_KEY:'public-fixture'})[key]},serve:fn=>handler=fn},
 createClient:(_url,key)=>key==='server-fixture'?admin:{auth:{getUser:async()=>({data:{user:caller?{id:caller}:null},error:caller?null:new Error('No identity')})}},getPayfastConfig:()=>({merchantId:'fixture',merchantKey:'fixture',processUrl:'https://payments.invalid',passphrase:''}),signatureFromEntries:()=> 'fixture-signature'};
let source=fs.readFileSync('supabase/functions/payfast-initiate/index.ts','utf8').replace(/^import .*;\r?\n/gm,'');
vm.runInNewContext(stripTypeScriptTypes(source,{mode:'strip'}),ctx);
const request=()=>new Request('https://fixture.invalid',{method:'POST',headers:{Authorization:caller?'Bearer fixture':'Bearer public-fixture','Content-Type':'application/json'},body:JSON.stringify({orderId:'order',guestContact:'fixture-contact'})});
for(const bad of [null,{id:'owner',suspended:true},{id:'owner',suspended:false,deleted_at:'2026-10-08'}]) {profile=bad;const before=rpcCalls;assert.equal((await handler(request())).status,403);assert.equal(rpcCalls,before);checks+=2;}
profile={id:'owner',suspended:false,deleted_at:null};assert.equal((await handler(request())).status,200);checks++;
caller='nonowner';assert.equal((await handler(request())).status,403);checks++;
caller=null;order={...order,customer_id:null};assert.equal((await handler(request())).status,200);checks++;
prepareError={code:'42501',message:'Vendor unavailable'};assert.equal((await handler(request())).status,403);checks++;
caller=null;const expired=request();expired.headers.set('Authorization','Bearer expired-token');const priorRpc=rpcCalls;assert.equal((await handler(expired)).status,401);assert.equal(rpcCalls,priorRpc);checks+=2;
console.log(`${checks} production cleanup SDK/storage/coordinate/actual-handler assertions passed (isolated fixtures).`);
