import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { stagingPaymentOrigins } from '../supabase/functions/_shared/payment-origins.ts';
const staging='https://eyhmarmekioovcjibcbr.supabase.co';
const preview='https://officebites-n7cs82zjg-sp24tg-6983s-projects.vercel.app';
const local='http://127.0.0.1:5173';const production='https://officebites.co.za';
let checks=0;
for(const value of [undefined,'https://gfzhdkitdyqftealgqfi.supabase.co','https://eyhmarmekioovcjibcbr.supabase.co.attacker.invalid','https://attacker@eyhmarmekioovcjibcbr.supabase.co']) {assert.deepEqual(stagingPaymentOrigins(value),[]);checks++;}
assert.deepEqual(stagingPaymentOrigins(staging),[preview,local]);checks++;
const code=stripTypeScriptTypes(fs.readFileSync('supabase/functions/payfast-initiate/index.ts','utf8').replace(/^import .*;\r?\n/gm,''));
function handler(project,origins,options={}) {
 let serve;let preparations=0;let clients=0;
 const env={SUPABASE_URL:project,ALLOWED_ORIGINS:origins,SITE_URL:production,SUPABASE_SERVICE_ROLE_KEY:'synthetic-test-value',SUPABASE_ANON_KEY:'synthetic-anon'};
 const context={URL,Request,Response,console,stagingPaymentOrigins,Deno:{env:{get:name=>env[name]},serve:fn=>{serve=fn;}},
 createClient:(_url,key)=>{clients++;return key==='synthetic-anon'?{auth:{getUser:async()=>({data:{user:options.caller?{id:options.caller}:null},error:options.invalidToken?new Error('synthetic invalid session'):null})}}:{
 from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:options.caller,suspended:!!options.suspended,deleted_at:null},error:null})}),
 rpc:async()=>{preparations++;return{data:{id:'synthetic-order',ticket_number:'SYNTHETIC',total:100},error:null};}};},
 getPayfastConfig:()=>{if(options.missingConfig)throw Error('synthetic missing configuration');return{merchantId:'synthetic',merchantKey:'synthetic',processUrl:'https://sandbox.payfast.co.za/eng/process'};},signatureFromEntries:()=> 'synthetic-signature',
 };vm.createContext(context);vm.runInContext(code,context);return{run:r=>serve(r),counts:()=>({clients,preparations})};
}
const stage=handler(staging,'https://old-reviewed-preview.vercel.app');
for(const origin of [preview,local]) {
 const response=await stage.run(new Request(staging+'/functions/v1/payfast-initiate',{method:'OPTIONS',headers:{Origin:origin}}));
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);checks++;
 assert.equal(stage.counts().preparations,0);checks++;assert.equal(stage.counts().clients,0);checks++;
}
const unknown=await stage.run(new Request(staging+'/functions/v1/payfast-initiate',{method:'OPTIONS',headers:{Origin:'https://attacker.vercel.app'}}));
assert.notEqual(unknown.headers.get('Access-Control-Allow-Origin'),'https://attacker.vercel.app');checks++;
for(const origin of [preview,local]) {
 const response=await stage.run(new Request(staging+'/functions/v1/payfast-initiate',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({orderId:'synthetic-order',guestContact:'0821234567'})}));
 const data=await response.json();assert.equal(data.fields.return_url,origin+'/orders/synthetic-order?payfast=return');checks++;
 assert.equal(data.fields.cancel_url,origin+'/orders/synthetic-order?payfast=cancel');checks++;
 assert.equal(data.fields.notify_url,staging+'/functions/v1/payfast-notify');checks++;
}
const prod=handler('https://gfzhdkitdyqftealgqfi.supabase.co',production);
const prodPreflight=await prod.run(new Request('https://example.invalid',{method:'OPTIONS',headers:{Origin:preview}}));
assert.equal(prodPreflight.headers.get('Access-Control-Allow-Origin'),production);checks++;
for(const [options,status,bearer] of [[{invalidToken:true},401,'expired-synthetic-token'],[{caller:'synthetic-member',suspended:true},403,'valid-synthetic-token'],[{missingConfig:true},503,null]]){
 const fn=handler(staging,preview,options);const headers={Origin:preview,'Content-Type':'application/json'};if(bearer)headers.Authorization='Bearer '+bearer;
 const response=await fn.run(new Request(staging+'/functions/v1/payfast-initiate',{method:'POST',headers,body:JSON.stringify({orderId:'synthetic-order',guestContact:'0821234567'})}));
 assert.equal(response.status,status);checks++;assert.equal(fn.counts().preparations,0);checks++;
}
console.log(`${checks} exact-origin payment preflight/return/cancel assertions passed. Handler RPC/signing mocked; no network or real preparation.`);
