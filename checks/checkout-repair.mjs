import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { paymentState,canRetryPayment,isFulfilled,displayOrderStatus,paymentMessage } from '../src/utils/orderState.js';
import { persistentImage,requirePersistentImage } from '../src/utils/persistentImage.js';
import { checkoutError } from '../src/utils/checkoutError.js';
import { authError } from '../src/utils/authError.js';
let checks=0;
const order=(status,states)=>({status,subOrders:states.map(([status,paymentStatus])=>({status,paymentStatus}))});
for(const [o,state,retry,fulfilled] of [
 [order('pending_payment',[['pending_payment','unpaid']]),'unpaid',true,false],
 [order('confirmed',[['confirmed','paid']]),'paid',false,false],
 [order('confirmed',[['completed','paid'],['confirmed','paid']]),'paid',false,false],
 [order('completed',[['completed','paid'],['completed','paid']]),'paid',false,true],
 [order('completed',[['completed','unpaid']]),'unpaid',false,false],
 [order('pending_payment',[['confirmed','paid'],['pending_payment','unpaid']]),'partial',false,false],
 [order('payment_submitted',[['payment_submitted','verifying']]),'verifying',false,false],
 [order('pending_payment',[]),'unknown',false,false],
 [order('cancelled',[['cancelled','unpaid']]),'unpaid',false,false],
]) {assert.equal(paymentState(o),state);assert.equal(canRetryPayment(o),retry);assert.equal(isFulfilled(o),fulfilled);checks+=3;}
assert.equal(displayOrderStatus(order('completed',[['confirmed','paid']])),'status_review');checks++;
assert.equal(displayOrderStatus(order('confirmed',[['confirmed','unpaid']])),'status_review');checks++;
assert.doesNotMatch(paymentMessage(order('mystery',[])),/payment is confirmed|order is complete/i);checks++;
for(const value of ['blob:https://old.vercel.app/id','data:image/svg+xml,unsafe','javascript:unsafe','http://insecure.invalid/pic','//another.invalid/image']) {assert.equal(persistentImage(value),'');assert.throws(()=>requirePersistentImage(value),/Upload/);checks+=2;}
assert.equal(persistentImage('https://example.invalid/storage/v1/object/public/image.png'),'https://example.invalid/storage/v1/object/public/image.png');checks++;
assert.equal(persistentImage('/placeholder-food.svg'),'/placeholder-food.svg');checks++;
assert.doesNotMatch(checkoutError({code:'XX000',message:'SQL private.customer_secret email@example.invalid',details:'secret'}).message,/SQL|private|@|secret/);checks++;
assert.match(checkoutError({message:'Active approved vendor required for fulfilment'}).message,/no longer available/i);checks++;
assert.equal(authError({code:'invalid_credentials'}).code,'invalid_credentials');checks++;
assert.doesNotMatch(authError({code:'bad',message:'private sensitive details'}).message,/sensitive|private/);checks++;

const strip=s=>s.replaceAll('\r\n','\n').replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\n/gm,'').replace(/export /g,'');
const mapperCtx={persistentImage};vm.createContext(mapperCtx);vm.runInContext(strip(fs.readFileSync('src/services/api/mappers.js','utf8'))+'\nthis.mapper={mapVendor,mapMeal,mapOrder};',mapperCtx);
assert.equal(mapperCtx.mapper.mapVendor({logo:'blob:https://old.vercel.app/id'}).logo,'');checks++;
assert.equal(mapperCtx.mapper.mapMeal({image:'blob:https://old.vercel.app/id'}).image,'/placeholder-food.svg');checks++;
let uid=null,calls=[];let rpcError=null;let identityError=null;let report={rows:[],reconciliation:[]};
const context={checkoutError,mapOrder:mapperCtx.mapper.mapOrder,financialService:{report:async()=>report},getOrderCustomerNames:async()=>new Map(),supabase:{
 auth:{getSession:async()=>({data:{session:uid?{user:{id:uid}}:null},error:null}),getUser:async()=>({data:{user:uid?{id:uid}:null},error:identityError})},
 rpc:async(name,args)=>{calls.push({name,args});return{data:rpcError?null:{id:'synthetic',status:'pending_payment'},error:rpcError};},
}};vm.createContext(context);vm.runInContext(strip(fs.readFileSync('src/services/orderService.js','utf8'))+'\nthis.service=orderService;',context);
const request={customerId:null,customerName:'Synthetic guest',guestContact:'0821234567',deliveryDate:'2099-01-01',deliveryLocation:'Synthetic',cartItems:[{mealId:'synthetic-meal',qty:1}]};
await context.service.createOrder(request);assert.equal(calls[0].name,'create_order_from_cart');checks++;
assert.deepEqual(Object.keys(calls[0].args).sort(),['p_customer_id','p_delivery_date','p_delivery_location','p_guest_contact','p_guest_email','p_guest_name','p_items']);checks++;
assert.equal(JSON.stringify(calls[0].args.p_items),'[{"mealId":"synthetic-meal","qty":1}]');checks++;
uid='member';await assert.rejects(()=>context.service.createOrder(request),/session/i);checks++;
const count=calls.length;identityError=new Error('expired');await assert.rejects(()=>context.service.createOrder({...request,customerId:'member'}),/session/i);checks++;assert.equal(calls.length,count);checks++;
identityError=null;await context.service.createOrder({...request,customerId:'member'});assert.equal(calls.at(-1).args.p_guest_name,null);checks++;
uid=null;rpcError={code:'P0001',message:'Active approved vendor required for fulfilment'};await assert.rejects(()=>context.service.createOrder(request),/vendor.*no longer available/i);checks++;
report={rows:[{order_id:'verified',status:'completed',financial_date:'2026-10-16',gross:70},{order_id:'verified',status:'confirmed',financial_date:'2026-10-16',gross:30},{order_id:'legacy',status:'completed',financial_date:'2026-10-16',gross:100}],reconciliation:[{order_id:'verified',recordedOrderTotal:115,recordedCompletePayments:115,completePaymentCount:1,orderAmountDifference:0},{order_id:'legacy',recordedOrderTotal:100,recordedCompletePayments:0,completePaymentCount:0,orderAmountDifference:0}]};
const payments=await context.service.getRecentPayments();assert.equal(payments.length,1);checks++;assert.equal(payments[0].status,'paid');checks++;assert.equal(payments[0].total,115);checks++;
report.reconciliation[0].completePaymentCount=2;assert.equal((await context.service.getRecentPayments()).length,0);checks++;
let authSession={user:{id:'synthetic-member'},access_token:'synthetic-session-not-a-real-token'};let authFailure=null;let sessionFailure=null;let suspended=false;
const authContext={authError,commercialService:{},supabase:{auth:{
 signInWithPassword:async()=>({data:{user:authSession?.user,session:authSession},error:authFailure}),
 getSession:async()=>({data:{session:authSession},error:sessionFailure}),
 signOut:async()=>{authSession=null;return{error:null};},
},from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:{id:'synthetic-member',role:'customer',name:'Synthetic member',suspended,deleted_at:null},error:null})})}};
vm.createContext(authContext);vm.runInContext(strip(fs.readFileSync('src/services/authService.js','utf8'))+'\nthis.service=authService;',authContext);
authFailure={code:'invalid_credentials',status:400,message:'Invalid login credentials'};
await assert.rejects(()=>authContext.service.login({email:'synthetic@example.invalid',password:'synthetic-input'}),e=>e.code==='invalid_credentials'&&!e.message.includes('synthetic@example.invalid'));checks++;
authFailure=null;assert.equal((await authContext.service.login({email:'synthetic@example.invalid',password:'synthetic-input'})).user.id,'synthetic-member');checks++;
assert.equal((await authContext.service.getCurrentUser()).id,'synthetic-member');checks++;
sessionFailure={code:'refresh_token_not_found',message:'sensitive backend detail'};await assert.rejects(()=>authContext.service.getCurrentUser(),e=>e.code==='refresh_token_not_found'&&!e.message.includes('sensitive'));checks++;
sessionFailure=null;suspended=true;await assert.rejects(()=>authContext.service.getCurrentUser(),/unavailable/i);checks++;
suspended=false;await authContext.service.logout();assert.equal(await authContext.service.getCurrentUser(),null);checks++;
console.log(`${checks} checkout repair service/state/image/diagnostic assertions passed; SDK and provider calls mocked.`);
