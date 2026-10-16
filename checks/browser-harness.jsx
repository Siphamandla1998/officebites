// Test-only entry. Full application provider tree; synthetic services, no hosted writes.
import React from 'react';
import { getGuestOrderAccess } from '../src/utils/guest';
import * as formatters from '../src/utils/formatters';
import * as orderRules from '../src/utils/orderRules';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import { authService } from '../src/services/authService';
import { notificationService } from '../src/services/notificationService';
import { orderService } from '../src/services/orderService';
import { supportService } from '../src/services/supportService';
import { foodService } from '../src/services/foodService';
import { vendorService } from '../src/services/vendorService';
import { paymentService } from '../src/services/paymentService';
import { supabase } from '../src/services/api/supabaseClient';
import '../src/styles/index.css';
const fixture=window.fixture={user:null,authChanged:null,notificationsFail:false,pending:[],deferOrder:false,deferPayment:false,redirects:[],creates:0,policy:null,unknownRpcs:[],deferCreate:false,reportCalls:0,vendorRefreshes:0,gatewayDisabled:!!window.fixtureGatewayDisabled,deliveryConfig:window.fixtureDeliveryConfig};
fixture.guestAccess = getGuestOrderAccess;
fixture.businessDates = () => ({
 time: formatters.formatTime('2026-10-08T17:00:00Z'),
 date: formatters.formatDate('2026-10-08'),
 before: orderRules.deliveryDateKey(orderRules.nextOrderableDate(new Date('2026-10-08T16:59:59Z'))),
 cutoff: orderRules.deliveryDateKey(orderRules.nextOrderableDate(new Date('2026-10-08T17:00:00Z'))),
 midnight: orderRules.deliveryDateKey(orderRules.nextOrderableDate(new Date('2026-10-08T22:00:00Z'))),
});
fixture.navigate=path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));};
fixture.setUser=async user=>{fixture.user=user;await fixture.authChanged?.(user?{user}:null);};
authService.getCurrentUser=async()=>fixture.user;
authService.onAuthStateChange=callback=>{fixture.authChanged=callback;return()=>{fixture.authChanged=null;};};
authService.logout=async()=>fixture.setUser(null);
notificationService.getNotifications=async()=>{if(fixture.notificationsFail)throw new Error('Synthetic notification failure');return fixture.user?[{id:fixture.user.id,title:`Private ${fixture.user.id}`,body:'Fixture',read:false,type:'general',dismissed:false,createdAt:'2026-10-08T10:00:00Z'}]:[];};
notificationService.markAsRead=async()=>{};
notificationService.dismiss=async()=>{};
supabase.channel=()=>({on(){return this;},subscribe(){return this;}});
supabase.removeChannel=async()=>{};
supabase.auth.getSession=async()=>({data:{session:fixture.user?{user:fixture.user}:null},error:null});
const order=id=>({id,ticketNumber:`OB-${id}`,customerId:fixture.user?.id || null,status:'pending_payment',total:100,deliveryDate:'2026-10-12',subOrders:[{id:`sub-${id}`,vendorId:'fixture-vendor',vendorName:'Synthetic vendor',status:'pending_payment',paymentStatus:'unpaid',items:[]}],createdAt:'2026-10-08T10:00:00Z',...window.fixtureOrderOverride});
orderService.getOrderById=async id=>fixture.deferOrder?new Promise(resolve=>fixture.pending.push({id,resolve})):order(id);
fixture.resolveOrder=(index=0)=>{const pending=fixture.pending.splice(index,1)[0];pending.resolve(order(pending.id));};
orderService.createOrder=async()=>{fixture.creates++;const created=order('CREATED');return fixture.deferCreate?new Promise(resolve=>fixture.resolveCreate=()=>resolve(created)):created;};
orderService.getOrdersByCustomer=async()=>[];
orderService.trackGuestOrder=async()=>order('TRACKED');
supportService.getTickets=async()=>[];
supportService.searchFAQs=async()=>{if(fixture.failPublic)throw new Error('Synthetic FAQ failure');return[];};
supportService.getGuides=async()=>[];
foodService.getMeals=async()=>{if(fixture.failPublic)throw new Error('Synthetic catalogue failure');return[];};
vendorService.getFeaturedVendors=async()=>[];
vendorService.getVendors=async()=>window.fixturePersistedBlob?[{id:'fixture-vendor',name:'Synthetic blob vendor',status:'pending',logo:'blob:https://different-preview.vercel.app/synthetic'}]:[];
vendorService.getVendorById=async id=>({id,name:'Synthetic vendor',status:'approved',address:'Synthetic premises',contactNumber:'',deliveryRadius:2,latitude:null,longitude:null});
vendorService.getDashboardStats=async()=>{fixture.vendorRefreshes++;return {todaysOrders:0,revenue:0,pendingOrders:0};};
orderService.getOrdersForVendor=async()=>window.fixtureVendorOrders || [];
paymentService.initiatePayfastPayment=async()=>fixture.deferPayment?new Promise(resolve=>fixture.resolvePayment=()=>{fixture.resolvePayment=null;resolve({processUrl:'https://fixture.invalid',fields:{}});}):{processUrl:'https://fixture.invalid',fields:{}};
paymentService.redirectToPayfast=value=>fixture.redirects.push(value);
paymentService.initiateOzowPayment=async()=>{fixture.ozowCalls=(fixture.ozowCalls||0)+1;await new Promise(resolve=>setTimeout(resolve,50));throw new Error('Synthetic Ozow reconciliation required');};
paymentService.cancelUnpaidOrder=async()=>{fixture.cancels=(fixture.cancels||0)+1;if(fixture.cancelFail)throw new Error('A payment may be processing');return {status:'cancelled'};};
supabase.rpc=async (name,args={})=> {
 if(name==='get_vendor_delivery_origin')return {data:{current:fixture.origin || {mode:'CENTRAL',status:'not_requested'},history:fixture.originHistory || []},error:null};
 if(name==='admin_delivery_origin_queue')return {data:fixture.origin?[{...fixture.origin,vendor_id:'fixture-vendor',vendor_name:'Synthetic vendor'}]:[],error:null};
 if(name==='request_vendor_delivery_origin'){fixture.origin={mode:'CENTRAL',status:'pending',address:args.p_address,latitude:args.p_latitude,longitude:args.p_longitude,revision:1};return {data:null,error:null};}
 if(name==='admin_decide_delivery_origin'){fixture.origin={...fixture.origin,revision:fixture.origin.revision+1,status:args.p_action==='approve'?'approved':args.p_action==='revoke'?'revoked':fixture.origin.status,mode:args.p_action==='vendor'?'VENDOR':'CENTRAL'};return {data:null,error:null};}
 if(name==='get_payment_gateways')return window.fixtureMissingGatewayRpc ? {data:null,error:{code:'PGRST202',message:'Payment settings unavailable'}} : {data:fixture.gateways || [{provider:'payfast',enabled:!fixture.gatewayDisabled,ready:true,maintenance:false,notice:''},{provider:'ozow',enabled:!!window.fixtureOzowAvailable,ready:!!window.fixtureOzowAvailable,maintenance:false,notice:''}],error:null};
 if(name==='admin_update_payment_gateway'){
  if(fixture.failGatewaySave)return {data:null,error:{message:'Synthetic gateway save rejected'}};
  const current=fixture.gateways || [{provider:'payfast',enabled:!fixture.gatewayDisabled,ready:true,maintenance:false,notice:''},{provider:'ozow',enabled:!!window.fixtureOzowAvailable,ready:!!window.fixtureOzowAvailable,maintenance:false,notice:''}];
  fixture.gateways=current.map(g=>g.provider===args.p_provider?{...g,enabled:args.p_enabled,maintenance:args.p_maintenance,notice:args.p_notice,updated_at:new Date().toISOString()}:g);
  return {data:null,error:null};
 }
 if(name==='get_delivery_settings')return {data:fixture.deliveryConfig || {enabled:false},error:null};
 if(name==='get_legal_portal')return {data:{business:{legalName:'Synthetic fixture only',email:'synthetic@test.invalid'},businessReady:false,documents:{},onboardingEnforced:false,acquisitionEnabled:false,standardBreakdownEnabled:false},error:null};
 if(name==='get_commercial_workspace')return {data:{admin:fixture.user?.role==='admin',business:{legalName:'Synthetic fixture only'},documents:fixture.user?.role==='admin'?[]:{},accounts:[],agreements:[],memberships:[],acceptances:[],ledger:[],adjustments:[]},error:null};
 if(name==='get_commercial_report')return {data:{rows:[],standardFees:[],weekly:[],totals:{chargedOrders:0,qualifyingOrders:0,uniquePayingCustomers:0,acquisitionFees:0,acquisitionCredits:0,netAcquisitionFees:0}},error:null};
 if(name==='quote_delivery')return {data:{enabled:true,id:'synthetic-quote',distanceKm:1.1,fee:15,expiresInSeconds:300},error:null};
 if(name==='get_financial_report'){
fixture.reportCalls++;if(fixture.failFinance)return {data:null,error:{message:'Synthetic report failure'}};}
 if(name==='admin_set_fee_policy'){fixture.policy='platform_absorbs';return {data:null,error:null};}
 if(name==='get_payout_ledger')return {data:{policy:fixture.policy,eligible:[],payouts:[],settlementRule:'Synthetic settlement'},error:null};
 if(name==='get_financial_report')return {data:{feePolicy:fixture.policy,totals:{gmv:100,grossCommission:17,processorFees:fixture.unknownFees?null:3,vendorEarnings:83,netMarketplaceRevenue:fixture.policy?14:null,paidOrders:1,unresolvedCommission:0},rows:[{financial_date:'2026-10-08',date_basis:'paid',order_id:'fixture',ticket_number:'=unsafe',suborder_id:'sub',vendor_id:'vendor',vendor_name:'Fixture',status:'completed',gross:100,commission_rate:0.17,commission:17,processor_fee:fixture.unknownFees?null:3,vendor_earnings:83}],reconciliation:window.fixtureVerifiedReceipt?[{order_id:'fixture',recordedOrderTotal:115,recordedCompletePayments:115,completePaymentCount:1,orderAmountDifference:0}]:[]},error:null};
 fixture.unknownRpcs.push(name);throw new Error('Unexpected RPC in recovery fixture: '+name);
};
supabase.from=()=>({select(){return this;},eq(){return this;},order(){return this;},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}});
history.replaceState({},'',new URLSearchParams(location.search).get('route') || (location.pathname === '/checks/browser-harness.html' ? '/' : location.pathname));
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
