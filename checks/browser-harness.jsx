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
const fixture=window.fixture={user:null,authChanged:null,notificationsFail:false,pending:[],deferOrder:false,deferPayment:false,redirects:[],creates:0,policy:null,unknownRpcs:[],deferCreate:false,reportCalls:0,vendorRefreshes:0};
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
const order=id=>({id,ticketNumber:`OB-${id}`,customerId:fixture.user?.id || null,status:'pending_payment',total:100,deliveryDate:'2026-10-12',subOrders:[],createdAt:'2026-10-08T10:00:00Z'});
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
vendorService.getVendors=async()=>[];
vendorService.getDashboardStats=async()=>{fixture.vendorRefreshes++;return {todaysOrders:0,revenue:0,pendingOrders:0};};
orderService.getOrdersForVendor=async()=>[];
paymentService.initiatePayfastPayment=async()=>fixture.deferPayment?new Promise(resolve=>fixture.resolvePayment=()=>{fixture.resolvePayment=null;resolve({processUrl:'https://fixture.invalid',fields:{}});}):{processUrl:'https://fixture.invalid',fields:{}};
paymentService.redirectToPayfast=value=>fixture.redirects.push(value);
supabase.rpc=async name=> {
 if(name==='get_financial_report'){fixture.reportCalls++;if(fixture.failFinance)return {data:null,error:{message:'Synthetic report failure'}};}
 if(name==='admin_set_fee_policy'){fixture.policy='platform_absorbs';return {data:null,error:null};}
 if(name==='get_payout_ledger')return {data:{policy:fixture.policy,eligible:[],payouts:[],settlementRule:'Synthetic settlement'},error:null};
 if(name==='get_financial_report')return {data:{feePolicy:fixture.policy,totals:{gmv:100,grossCommission:17,processorFees:3,vendorEarnings:83,netMarketplaceRevenue:fixture.policy?14:null,paidOrders:1,unresolvedCommission:0},rows:[{financial_date:'2026-10-08',date_basis:'paid',order_id:'fixture',ticket_number:'=unsafe',suborder_id:'sub',vendor_id:'vendor',vendor_name:'Fixture',status:'completed',gross:100,commission_rate:0.17,commission:17,processor_fee:3,vendor_earnings:83}],reconciliation:[]},error:null};
 fixture.unknownRpcs.push(name);throw new Error('Unexpected RPC in recovery fixture: '+name);
};
supabase.from=()=>({select(){return this;},eq(){return this;},order(){return this;},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}});
history.replaceState({},'',new URLSearchParams(location.search).get('route') || (location.pathname === '/checks/browser-harness.html' ? '/' : location.pathname));
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
