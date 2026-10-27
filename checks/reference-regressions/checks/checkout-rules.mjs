import assert from 'node:assert/strict';
import { validateMobile } from '../src/utils/mobile.js';
import { distanceKm, validatePosition } from '../src/utils/delivery.js';
import { subscriptionEligibility } from '../src/utils/subscriptionRules.js';
import { ozowToken, ozowHostedRequest, verifyOzowWebhook, ozowBase } from '../supabase/functions/_shared/ozow.ts';
let count=0;
for(const n of ['0601234567','0691234567','0711234567','0791234567','0811234567','0841234567','082 123 4567','(082)123-4567']){assert.equal(validateMobile(n).valid,true);count++;}
for(const n of ['123',821234567,'+27821234567','0101234567','0851234567','0861234567','0871234567','08212345678','082a1234567','082😀1234567','０８２１２３４５６７']){assert.equal(validateMobile(n).valid,false);count++;}
assert.equal(validateMobile('+27821234567','international').value,'0821234567');count++;
assert.equal(validateMobile('+14155552671','international').valid,true);count++;
assert.equal(distanceKm({latitude:0,longitude:0},{latitude:0,longitude:0}),0);count++;
assert.ok(Math.abs(distanceKm({latitude:0,longitude:0},{latitude:1,longitude:0})-111.19508)<0.001);count++;
assert.throws(()=>distanceKm({latitude:null,longitude:0},{latitude:1,longitude:0}));count++;
const pos={coords:{latitude:-29.721180,longitude:31.071621,accuracy:20},timestamp:100000};
assert.equal(validatePosition(pos,{now:100000}).accuracy,20);count++;
assert.throws(()=>validatePosition({...pos,coords:{...pos.coords,accuracy:101}},{now:100000}));count++;
assert.throws(()=>validatePosition(pos,{now:200000}));count++;
const subscription={paymentStatus:'paid',approvalStatus:'approved',expiresAt:'2027-01-01',suspended:false,archived:false};
assert.equal(subscriptionEligibility(subscription,Date.parse('2026-10-16')),true);count++;
for(const change of [{paymentStatus:'unpaid'},{paymentStatus:'processing'},{approvalStatus:'paid_pending_approval'},{approvalStatus:'rejected'},{approvalStatus:'suspended'},{suspended:true},{archived:true},{expiresAt:'2026-01-01'}]){assert.equal(subscriptionEligibility({...subscription,...change},Date.parse('2026-10-16')),false);count++;}
assert.equal(ozowBase('staging'),'https://stagingone.ozow.com/v1');count++;
assert.throws(()=>ozowBase('unknown'));count++;
const token=await ozowToken(async(url,init)=>{assert.equal(url,'https://stagingone.ozow.com/v1/token');assert.equal(init.body.get('scope'),'payments');return Response.json({access_token:'synthetic',expires_in:30});},'staging','synthetic-client','synthetic-secret');
assert.equal(token.expiresIn,30);count++;
const request={siteCode:'SYN-THET-IC',amount:{currency:'ZAR',value:100},merchantReference:'synthetic',beneficiaryReference:'SYNTHETIC',expireAt:'2099-01-01T00:00:00Z',returnUrl:'https://fixture.invalid/return'};
const hosted=await ozowHostedRequest(async()=>Response.json({id:'synthetic',status:'Created',redirectUrl:'https://fixture.invalid/provider-returned-url'}),'staging','synthetic-token',request);
assert.equal(hosted.id,'synthetic');count++;
await assert.rejects(()=>ozowHostedRequest(fetch,'staging','synthetic-token',{...request,amount:{currency:'USD',value:100}}));count++;
const raw=JSON.stringify({type:'transaction.complete',data:{id:'synthetic',status:'Successful'}}),now=100000;
const bytes=new Uint8Array(32).fill(7),secret='whsec_'+btoa(String.fromCharCode(...bytes));
const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
const sig=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`synthetic.${now}.${raw}`)))));
const headers=new Headers({'svix-id':'synthetic','svix-timestamp':String(now),'svix-signature':`v1,${sig}`});
assert.equal((await verifyOzowWebhook(raw,headers,secret,now)).data.status,'Successful');count++;
await assert.rejects(()=>verifyOzowWebhook(raw+' ',headers,secret,now));count++;
await assert.rejects(()=>verifyOzowWebhook(raw,headers,secret,now+301));count++;
console.log(`${count} mobile/location/subscription/Ozow groundwork assertions passed; all provider HTTP calls mocked.`);
