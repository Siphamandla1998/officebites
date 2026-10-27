// Recovery SDK/service tests; no hosted requests or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
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


const {createRequestScope} = await import('../src/utils/requestScope.js');
let cleanup;
const browser = {location:{href:'https://fixture.invalid/payment/A'},history:{state:{key:'navigation-A'}}};
const guardSource=fs.readFileSync('src/hooks/useRequestGuard.js','utf8').replace(/^import .*;\r?\n/gm,'').replace('export function','function');
const renderGuard=new Function('useEffect','useRef','createRequestScope','window',guardSource+';return useRequestGuard;')(
  fn=>{cleanup=fn();},()=>({current:null}),createRequestScope,browser);
const guard=renderGuard('account-A:order-A');
const current=guard.begin();assert.equal(current(),true);checks++;
browser.location.href='https://fixture.invalid/help/tickets';assert.equal(current(),false);checks++;
browser.location.href='https://fixture.invalid/payment/A';browser.history.state.key='navigation-B';assert.equal(current(),false);checks++;
const beforeUnmount=guard.capture();cleanup();assert.equal(beforeUnmount(),false);checks++;

console.log(`${checks} recovery SDK/storage/coordinate assertions passed (isolated fixtures).`);
