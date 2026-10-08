import { stripTypeScriptTypes } from 'node:module';
﻿// Hook/service stubs exercise actual handlers; these are not browser tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { csvCell, toCsv, downloadCsv } from '../src/utils/csv.js';
import { periodDates, calendarDate, sastDateKey } from '../src/utils/reportingDates.js';
import { createRequestScope } from '../src/utils/requestScope.js';
import { clearLegacyPrivateCaches } from '../src/utils/privateCache.js';
import { removeAccount } from '../supabase/functions/_shared/account-removal.ts';
const flush = () => new Promise(r => setImmediate(r));
let checks=0;
for(const value of ['=1+1',' +SUM(A1)','\u0001@cmd','-1','\t42']) { assert.ok(csvCell(value).startsWith('"\'')); checks++; }
assert.equal(csvCell('A,"B"'),'"A,""B"""'); checks++;
assert.ok(toCsv(['Name'],[['=1+1']]).startsWith('\uFEFF"Name"\r\n"\'=1+1"')); checks++;
let clicked=false, downloaded;
globalThis.URL.createObjectURL=()=> 'blob:fixture'; globalThis.URL.revokeObjectURL=()=>{};
globalThis.document={body:{appendChild:()=>{}},createElement:()=>({set download(value){downloaded=value;},click:()=>{clicked=true;},remove:()=>{}})};
downloadCsv('sales.csv',['Amount'],[[17]]); assert.ok(clicked&&downloaded==='sales.csv'); checks++;
const now=new Date('2026-10-07T22:01:00Z');
assert.equal(sastDateKey(now),'2026-10-08'); checks++;
assert.deepEqual(periodDates('month',now),{from:'2026-10-01',to:'2026-10-08'}); checks++;
assert.deepEqual(periodDates('week',now),{from:'2026-10-05',to:'2026-10-08'}); checks++;
assert.equal(periodDates('all',now).from,null); checks++;
assert.equal(calendarDate('2026-10-08').getDate(),8); checks++;
const deleted=[];globalThis.caches={keys:async()=>['officebites-api-cache','officebites-image-cache','unrelated','officebites-public-image-v2'],delete:async name=>deleted.push(name)};
await clearLegacyPrivateCaches();assert.deepEqual(deleted,['officebites-api-cache','officebites-image-cache']); checks++;
function harness(extra={}) {
  let cursor=0,slots=[],effects=[];
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const ctx={console:{error:()=>{},debug:()=>{}},...extra,
    useState(initial){let i=cursor++;if(!slots[i])slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,v=>slots[i].value=typeof v==='function'?v(slots[i].value):v];},
    useRef(initial){let i=cursor++;return(slots[i]??={current:initial});},
    useCallback(cb,deps){let i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,cb};return slots[i].cb;},
    useMemo(fn,deps){let i=cursor++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},
    useEffect(cb,deps){let i=cursor++;if(!slots[i]||!same(slots[i].deps,deps)){const old=slots[i];slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=cb();});}},
  };
  vm.createContext(ctx);
  return {ctx,load(source){vm.runInContext(source,ctx);},render(fn){cursor=0;return fn();},effects(){let e=effects;effects=[];e.forEach(f=>f());},unmount(){slots.forEach(s=>s?.cleanup?.());}};
}
const strip=s=>s.replaceAll('\r\n','\n').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\n/gm,'').replace(/export default /g,'').replace(/export /g,'');
// Account dependency changes, stale callbacks, retry and unmount on useAsync.
let pending=[];const hook=harness();hook.load(strip(fs.readFileSync('src/hooks/useAsync.js','utf8'))+'\nthis.hook=useAsync;');
let account='A';const renderHook=()=>hook.render(()=>hook.ctx.hook(()=>new Promise((resolve,reject)=>pending.push({resolve,reject,account})),[account],null));
let value=renderHook();hook.effects();const oldRetry=value.refetch;account='B';value=renderHook();assert.equal(value.data,null);checks++;hook.effects();pending[1].resolve('B data');await flush();value=renderHook();assert.equal(value.data,'B data');checks++;pending[0].resolve('A stale');await flush();assert.equal(renderHook().data,'B data');checks++;const count=pending.length;await oldRetry();assert.equal(pending.length,count);checks++;
let retry=value.refetch();pending.at(-1).reject(new Error('Network unavailable'));await retry;value=renderHook();assert.equal(value.error.message,'Network unavailable');checks++;retry=value.refetch();pending.at(-1).resolve('Recovered');await retry;assert.equal(renderHook().data,'Recovered');checks++;retry=value.refetch();hook.unmount();pending.at(-1).resolve('After unmount');await retry;assert.equal(renderHook().data,'Recovered');checks++;
// Actual vendor-chat handlers: delayed thread open, delayed send and delayed poll.
let user={id:'A',vendorId:'vendorA'},gets=[],sends=[],reads=[],refreshes=[],poll;
const chat=harness({createRequestScope,useAuth:()=>({user}),useToast:()=>({showToast:()=>{}}),useSearchParams:()=>[new URLSearchParams(),()=>{}],useAsync:()=>({data:[{id:'one',messages:[]},{id:'two',messages:[]}],refetch:()=>new Promise(resolve=>refreshes.push(resolve))}),useLiveRefresh:cb=>poll=cb,
 chatService:{getConversation:id=>new Promise(resolve=>gets.push({id,resolve})),sendMessage:id=>new Promise(resolve=>sends.push({id,resolve})),markConversationRead:async id=>reads.push(id)}});
let source=strip(fs.readFileSync('src/pages/vendor/VendorChat.jsx','utf8'));source=source.slice(0,source.indexOf('  const filteredConversations'))+'return {openConversation,send,closeConversation,setText,messages,text,sending,activeId};}\nthis.component=VendorChat;';chat.load(source);
const renderChat=()=>chat.render(()=>chat.ctx.component());let c=renderChat();chat.effects();c=renderChat();const first=c.openConversation('one');c=renderChat();const second=c.openConversation('two');c=renderChat();gets[1].resolve({messages:[{text:'two'}]});await flush();refreshes[0]([]);await second;gets[0].resolve({messages:[{text:'STALE one'}]});await first;assert.equal(renderChat().messages[0].text,'two');checks++;assert.deepEqual(reads,['two']);checks++;
c=renderChat();c.setText('old send');c=renderChat();const sending=c.send();c.closeConversation();c=renderChat();c.setText('new draft');c=renderChat();sends[0].resolve();await sending;assert.equal(renderChat().text,'new draft');checks++;assert.equal(gets.length,2);checks++;
c=renderChat();const open=c.openConversation('one');c=renderChat();gets[2].resolve({messages:[{text:'one'}]});await flush();refreshes[1]([]);await open;const background=poll();user={id:'B',vendorId:'vendorB'};c=renderChat();chat.effects();c=renderChat();refreshes[2]([{id:'one',messages:[{text:'STALE account'}]}]);await background;assert.equal(renderChat().messages.length,0);checks++;
// Removal workflow failure ordering; no Supabase account or file is touched.
function removalFixture(failStorage=false) {const calls=[];return {calls,admin:{rpc:async name=>{calls.push(name);return name==='prepare_account_removal'?{data:{jobId:'job',manifest:{userId:'fixture-user',storage:[{bucket:'fixture',name:'one'}]}}}:{};},auth:{admin:{updateUserById:async()=>{calls.push('ban');return{};},deleteUser:async()=>{calls.push('deleteAuth');return{};}}},storage:{from:()=>({remove:async()=>{calls.push('removeStorage');return failStorage?{error:new Error('fixture failure')}:{};}})}}};}
let removal=removalFixture(true);await assert.rejects(removeAccount(removal.admin,'fixture-admin',{}),/Storage cleanup failed/);assert.ok(!removal.calls.includes('deleteAuth'));checks++;
removal=removalFixture();await removeAccount(removal.admin,'fixture-admin',{});assert.deepEqual(removal.calls,['prepare_account_removal','ban','removeStorage','deleteAuth','complete_account_removal']);checks++;
// Notifications clear immediately on account changes, including A -> B -> A while pending.
let notificationUser={id:'A'},notificationsPending=[],markPending=[],channels=[];
const notifier=harness({createContext:()=>({}),useContext:()=>{},useAuth:()=>({user:notificationUser,isAuthenticated:!!notificationUser}),useToast:()=>({showToast:()=>{}}),
notificationService:{getNotifications:()=>new Promise(resolve=>notificationsPending.push(resolve)),markAsRead:()=>new Promise(resolve=>markPending.push(resolve)),dismiss:async()=>{}},
supabase:{channel:()=>{const channel={on(){return this;},subscribe(){return this;}};channels.push(channel);return channel;},removeChannel:()=>{}},document:{visibilityState:'visible',addEventListener:()=>{},removeEventListener:()=>{}},window:{addEventListener:()=>{},removeEventListener:()=>{}},setInterval:()=>1,clearInterval:()=>{}});
let notificationSource=strip(fs.readFileSync('src/context/NotificationContext.jsx','utf8')).replace('import.meta.env.DEV','false').replace(/return \(\s*<NotificationContext.Provider[\s\S]*?<\/NotificationContext.Provider>\s*\);/,'return value;');
notifier.load(notificationSource+'\nthis.provider=NotificationProvider;');
const notificationRender=()=>notifier.render(()=>notifier.ctx.provider({children:null}));
let n=notificationRender();notifier.effects();notificationsPending[0]([{id:'privateA',read:false}]);await flush();n=notificationRender();assert.equal(n.notifications[0].id,'privateA');checks++;
const oldMark=n.markAsRead('privateA');notificationUser={id:'B'};n=notificationRender();assert.equal(n.notifications.length,0);checks++;notifier.effects();notificationUser={id:'A'};n=notificationRender();notifier.effects();assert.equal(notificationsPending.length,3);checks++;notificationsPending[2]([{id:'latestA',read:false}]);await flush();notificationsPending[1]([{id:'privateB',read:false}]);markPending[0]();await oldMark;assert.equal(notificationRender().notifications[0].id,'latestA');checks++;assert.equal(notificationRender().loading,false);checks++;
// Home cutoff hook updates without navigation, then removes timers/listeners.
let clock=new Date('2026-10-08T16:59:59Z'),timer,removed=0;
const rules={ORDER_CUTOFF_HOUR:19,COMMISSION_RATE:0.17,Date,Intl};vm.createContext(rules);vm.runInContext(strip(fs.readFileSync('src/utils/orderRules.js','utf8'))+'\nthis.exports={nextOrderableDate,deliveryDateKey};',rules);const {nextOrderableDate,deliveryDateKey}=rules.exports;
const delivery=harness({deliveryDateKey,nextOrderableDate:()=>nextOrderableDate(clock),setInterval:fn=>{timer=fn;return 1;},clearInterval:()=>removed++,window:{addEventListener:()=>{},removeEventListener:()=>removed++},document:{addEventListener:()=>{},removeEventListener:()=>removed++}});
delivery.load(strip(fs.readFileSync('src/hooks/useDeliveryDate.js','utf8'))+'\nthis.delivery=useDeliveryDate;');
assert.equal(delivery.render(()=>delivery.ctx.delivery()),'2026-10-09');checks++;delivery.effects();clock=new Date('2026-10-08T17:00:00Z');timer();assert.equal(delivery.render(()=>delivery.ctx.delivery()),'2026-10-10');checks++;delivery.unmount();assert.equal(removed,3);checks++;
// Actual vendor service defaults retain approved-only customer listings; admin all omits it.
const filters=[];const vendorCtx={supabase:{from:()=>({select(){return this;},eq(k,v){filters.push([k,v]);return this;},then(resolve){resolve({data:[]});}})},mapVendor:r=>r,VENDOR_STATUS:{APPROVED:'approved'}};vm.createContext(vendorCtx);vm.runInContext(strip(fs.readFileSync('src/services/vendorService.js','utf8'))+'\nthis.service=vendorService;',vendorCtx);
await vendorCtx.service.getVendors();assert.deepEqual(filters,[['status','approved']]);checks++;filters.length=0;await vendorCtx.service.getVendors({status:'all'});assert.equal(filters.length,0);checks++;
// Exercise the actual Edge HTTP handler with fake Auth/DB clients and no network.
let endpoint, edgeRole='admin', edgeSuspended=false, verifiedToken, serviceCreated=0;
const fakeCaller={auth:{getUser:async token=>{verifiedToken=token;return {data:{user:{id:'fixture-admin'}}};}},from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{role:edgeRole,suspended:edgeSuspended,deleted_at:null}})}),rpc:async()=>({data:{confirmation:'customer:fixture'}})};
const edgeContext={Deno:{env:{get:name=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'server-fixture'}[name])},serve:fn=>endpoint=fn},createClient:(url,key)=>{if(key==='server-fixture')serviceCreated++;return fakeCaller;},removeAccount:async()=>({state:'complete'}),Request,Response,Set,Error};vm.createContext(edgeContext);
const edgeSource=stripTypeScriptTypes(fs.readFileSync('supabase/functions/admin-account-removal/index.ts','utf8'),{mode:'strip'}).replace(/^import[^\n]*\n/gm,'');vm.runInContext(edgeSource,edgeContext);
const request=(body,headers={})=>new Request('https://fixture.invalid',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const input={action:'preview',kind:'customer',id:'00000000-0000-4000-8000-000000000001'};
assert.equal((await endpoint(request(input))).status,401);checks++;
assert.equal((await endpoint(request(input,{origin:'https://untrusted.invalid',authorization:'Bearer fixture-token'}))).status,403);checks++;
edgeRole='customer';assert.equal((await endpoint(request(input,{authorization:'Bearer fixture-token'}))).status,403);checks++;
edgeRole='admin';edgeSuspended=true;assert.equal((await endpoint(request(input,{authorization:'Bearer fixture-token'}))).status,403);checks++;
edgeSuspended=false;assert.equal((await endpoint(request(input,{authorization:'Bearer fixture-token'}))).status,200);assert.equal(verifiedToken,'fixture-token');assert.equal(serviceCreated,0);checks++;
assert.equal((await endpoint(request({...input,id:'invalid'},{authorization:'Bearer fixture-token'}))).status,400);checks++;
// A successful void RPC may return null; errors must still propagate.
let rpcResult={data:null};const financeCtx={supabase:{rpc:async()=>rpcResult},periodDates};vm.createContext(financeCtx);vm.runInContext(strip(fs.readFileSync('src/services/financialService.js','utf8'))+'\nthis.rpc=financialRpc;',financeCtx);
await financeCtx.rpc('admin_set_fee_policy',{});checks++;
await assert.rejects(financeCtx.rpc('get_financial_report',{}),/no result/i);checks++;
rpcResult={error:{code:'PGRST202',message:'missing'}};await assert.rejects(financeCtx.rpc('get_financial_report',{}),/not installed/i);checks++;
// Evaluate the actual Workbox URL predicate, including real Supabase URL shapes.
const config=fs.readFileSync('vite.config.js','utf8');const predicate=config.match(/urlPattern: (.*),\n/)[1];const origin='https://officebites.co.za';const match=vm.runInNewContext('('+predicate+')',{self:{location:{origin}}});
assert.equal(match({request:{destination:'image'},url:new URL(origin+'/icons/icon-192.png')}),true);checks++;
for(const path of ['https://gfzhdkitdyqftealgqfi.supabase.co/rest/v1/orders','https://gfzhdkitdyqftealgqfi.supabase.co/storage/v1/object/sign/support-attachments/private?token=fixture',origin+'/attachments/private.png',origin+'/icons/photo.png?token=fixture']) {assert.equal(match({request:{destination:'image'},url:new URL(path)}),false);checks++;}
console.log(`${checks} frontend/service/handler checks passed in ${process.env.TZ || 'system timezone'} (stubs, not browser verification).`);
