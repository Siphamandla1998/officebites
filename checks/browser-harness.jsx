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
import { manualPaymentService } from '../src/services/manualPaymentService';
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
const originalFixtureLogin=authService.login;
authService.login=async input=>{
 if(!fixture.confirmVendorEmail)return originalFixtureLogin(input);
 fixture.user={id:'confirmed-vendor',name:'Confirmed applicant',role:'vendor',vendorId:'fixture-vendor'};
 return {user:fixture.user};
};
authService.becomeVendor=async input=>{
 fixture.vendorApplication=input;
 fixture.user={...fixture.user,role:'vendor',vendorId:'fixture-vendor'};
 return {vendorId:'fixture-vendor',status:'pending'};
};
authService.register=async input=>{
 fixture.registration=input;
 if(fixture.confirmVendorEmail)return {needsEmailConfirmation:true,user:{id:'new-vendor',role:'vendor'}};
 fixture.user={id:'new-vendor',name:input.name,role:input.role,vendorId:input.role==='vendor'?'fixture-vendor':null};
 return {user:fixture.user,needsEmailConfirmation:false};
};
notificationService.getNotifications=async()=>{if(fixture.notificationsFail)throw new Error('Synthetic notification failure');return fixture.user?[{id:fixture.user.id,title:`Private ${fixture.user.id}`,body:'Fixture',read:false,type:'general',dismissed:false,createdAt:'2026-10-08T10:00:00Z'}]:[];};
notificationService.markAsRead=async()=>{};
notificationService.dismiss=async()=>{};
supabase.channel=()=>({on(){return this;},subscribe(){return this;}});
supabase.removeChannel=async()=>{};
supabase.auth.getSession=async()=>({data:{session:fixture.user?{user:fixture.user}:null},error:null});
const order=id=>({id,ticketNumber:`OB-${id}`,customerId:fixture.user?.id || null,status:'pending_payment',total:100,deliveryDate:'2026-10-12',subOrders:[{id:`sub-${id}`,vendorId:'fixture-vendor',vendorName:'Synthetic vendor',status:'pending_payment',paymentStatus:'unpaid',items:[]}],createdAt:'2026-10-08T10:00:00Z',...window.fixtureOrderOverride});
orderService.getOrderById=async id=>fixture.deferOrder?new Promise(resolve=>fixture.pending.push({id,resolve})):order(id);
fixture.resolveOrder=(index=0)=>{const pending=fixture.pending.splice(index,1)[0];pending.resolve(order(pending.id));};
orderService.createOrder=async input=>{fixture.creates++;fixture.createdPaymentMethod=input.paymentMethod;fixture.createdCollection=input.collection;fixture.createdLegalAcceptance=input.legalAcceptance;const created=order('CREATED');return fixture.deferCreate?new Promise(resolve=>fixture.resolveCreate=()=>resolve(created)):created;};
orderService.getOrdersByCustomer=async()=>[];
orderService.trackGuestOrder=async()=>order('TRACKED');
supportService.getTickets=async()=>[];
supportService.searchFAQs=async()=>{if(fixture.failPublic)throw new Error('Synthetic FAQ failure');return[];};
supportService.getGuides=async()=>[];
foodService.getMeals=async()=>{if(fixture.failPublic)throw new Error('Synthetic catalogue failure');return[];};
vendorService.getFeaturedVendors=async()=>[];
vendorService.getVendors=async()=>window.fixtureAdminVendors || (window.fixturePersistedBlob?[{id:'fixture-vendor',name:'Synthetic blob vendor',status:'pending',logo:'blob:https://different-preview.vercel.app/synthetic'}]:[]);
vendorService.getVendorById=async id=>({id,name:'Synthetic vendor',status:'approved',address:'Synthetic premises',contactNumber:'',deliveryRadius:2,latitude:null,longitude:null});
vendorService.getDashboardStats=async()=>{fixture.vendorRefreshes++;return {todaysOrders:0,revenue:0,pendingOrders:0};};
orderService.getOrdersForVendor=async()=>window.fixtureVendorOrders || [];
paymentService.initiatePayfastPayment=async()=>fixture.deferPayment?new Promise(resolve=>fixture.resolvePayment=()=>{fixture.resolvePayment=null;resolve({processUrl:'https://fixture.invalid',fields:{}});}):{processUrl:'https://fixture.invalid',fields:{}};
paymentService.redirectToPayfast=value=>fixture.redirects.push(value);
paymentService.initiateOzowPayment=async()=>{fixture.ozowCalls=(fixture.ozowCalls||0)+1;await new Promise(resolve=>setTimeout(resolve,50));throw new Error('Synthetic Ozow reconciliation required');};
paymentService.cancelUnpaidOrder=async()=>{fixture.cancels=(fixture.cancels||0)+1;if(fixture.cancelFail)throw new Error('A payment may be processing');return {status:'cancelled'};};
manualPaymentService.methods=async vendorId=>{if(window.fixtureManualMethodsError)throw new Error('Synthetic method refresh failed');if(window.fixtureDeferManualMethods)return new Promise(resolve=>{fixture.resolveManualMethods=()=>resolve(window.fixtureManualMethods||{});});return window.fixtureManualMethodsByVendor?.[vendorId] ?? window.fixtureManualMethods ?? (window.fixtureManualUnavailable?{}:{manual_eft:true,manual_payshap:!window.fixtureEftOnly});};
const manual = () => ({orderId:'A',method:window.fixtureManualMethod || 'manual_eft',destination:{accountHolder:'Synthetic Vendor Ltd',bank:'Synthetic Bank',accountNumber:'1234567890',accountType:'Business',branchCode:'123456',shapId:'synthetic@bank'},vendor:'Synthetic vendor',reference:'OB-SYNTHETIC',amount:100,deadline:new Date(Date.now()+15*60000).toISOString(),state:fixture.manualState || window.fixtureManualState || 'awaiting_payment'});
 manualPaymentService.instructions=async()=>{if(window.fixtureManualAccessDenied)throw new Error('Payment access unavailable');return {...manual(),collection:window.fixturePaymentCollection};};
manualPaymentService.report=async()=>{fixture.manualReports=(fixture.manualReports||0)+1;await new Promise(resolve=>setTimeout(resolve,50));fixture.manualState='payment_reported';};
manualPaymentService.workspace=async(testOnly=false)=>{
 fixture.workspaceScopes ||= [];fixture.workspaceScopes.push(testOnly);
 if(fixture.deferManualWorkspace)await new Promise(resolve=>fixture.releaseManualWorkspace=resolve);
 if(fixture.failManualWorkspace)throw new Error('Synthetic manual workspace refresh failed');
 return window.fixtureManualWorkspace?.[String(testOnly)] || {settings:fixture.manualSettings || {eft_enabled:true,payshap_enabled:true,deadline_minutes:15,review_threshold:500,settings_revision:'fixture-revision-0'},profiles:fixture.paymentProfiles || [],payments:[],receivables:[],events:[]};
};
manualPaymentService.submit=async(vendorId,destination,eft,payshap)=>{
 fixture.paymentProfiles ||= [];const id='synthetic-profile-'+(fixture.paymentProfiles.length+1);
 const profile={id,vendor_id:vendorId,destination,eft,payshap,created_at:'2026-10-21T10:00:00Z',approved_at:null,submitted_by:fixture.user.id};fixture.paymentProfiles.push(profile);if(fixture.compliance)fixture.compliance.bankProfiles.push(profile);return id;
};
manualPaymentService.approve=async(id,evidence)=>{
 fixture.profileApprovals ||= [];fixture.profileApprovals.push({id,evidence});
 fixture.paymentProfiles=fixture.paymentProfiles.map(p=>p.id===id?{...p,approved_at:'2026-10-21T10:05:00Z'}:p);
};
manualPaymentService.settings=async(eft,payshap,minutes,threshold,reason,expectedRevision)=>{
 fixture.settingsCalls ||= [];fixture.settingsCalls.push({eft,payshap,minutes:Number(minutes),threshold:Number(threshold),reason});
 if(fixture.deferSettings)await new Promise(resolve=>fixture.releaseSettings=resolve);
 if(fixture.settingsError)throw Object.assign(new Error(fixture.settingsError.message),fixture.settingsError);
 if(expectedRevision!==undefined && expectedRevision!==fixture.manualSettings?.settings_revision)throw Object.assign(new Error('Settings changed; reload'),{code:'40001'});
 if(fixture.failSettings)throw new Error('Synthetic save failed');
 fixture.manualSettings={eft_enabled:eft,payshap_enabled:payshap,deadline_minutes:Number(minutes),review_threshold:Number(threshold),settings_revision:'saved-'+fixture.settingsCalls.length};
};
supabase.rpc=async (name,args={})=> {
 if(name==='get_vendor_compliance') {
  if(fixture.complianceReadError)return {data:null,error:{message:'Synthetic compliance refresh failure'}};
  return {data:structuredClone(fixture.compliance || {admin:fixture.user?.role==='admin',vendor:{id:args.p_vendor,name:'Synthetic vendor',status:'pending'},enrolled:true,legacyException:false,ready:false,workflow:'pending documents',accepted:false,assignmentValid:false,events:{},submissions:[],bankProfiles:fixture.paymentProfiles || [],assignments:[],documents:[],history:[]}),error:null};
 }
 if(name==='reserve_vendor_evidence') {
  const state=fixture.compliance;const id='synthetic-evidence-'+(state.submissions.length+1);const path=state.vendor.id+'/'+id+'/evidence';
  state.submissions.push({id,kind:args.p_kind,note:args.p_note,object_path:path,created_at:'2026-10-26T10:00:00Z'});
  return {data:{id,path,bucket:'vendor-compliance'},error:null};
 }
 if(name==='finalize_vendor_evidence') {
  const state=fixture.compliance;const s=state.submissions.find(row=>row.id===args.p_submission);
  const event={id:'event-'+s.id,kind:s.kind,subject_id:s.id,status:'submitted',actor_id:fixture.user.id,at:'2026-10-26T10:01:00Z',reason:s.note};
  state.history.unshift(event);state.events[s.kind]=event;return {data:null,error:null};
 }
 if(name==='admin_vendor_compliance') {
  fixture.complianceCalls ||= [];fixture.complianceCalls.push(args);
  if(fixture.complianceReject)return {data:null,error:{message:'Verified activation prerequisites required'}};
  const state=fixture.compliance;const value=args.p_value;
  if(args.p_action==='assign'){state.assignments.push({id:'synthetic-assignment',change_basis:value.changeBasis,effective_at:value.effectiveAt,approval_reference:value.reason});state.workflow='awaiting vendor acceptance';}
  if(args.p_action==='complete_review'){state.ready=true;state.workflow='ready for approval';}
  if(args.p_action==='activate'){state.vendor.status='approved';state.workflow='approved';}
  if(args.p_action==='enroll'){state.legacyException=false;state.enrolled=true;state.ready=false;state.workflow='verification required';}
  if(args.p_action==='suspend'){state.vendor.status='suspended';state.workflow='suspended';}
  if(args.p_action==='request_changes'){state.vendor.status='pending';state.workflow='pending documents';}
  const event={id:'synthetic-audit-'+(state.history.length+1),kind:'administration',status:args.p_action,actor_id:fixture.user.id,at:'2026-10-26T10:02:00Z',reason:value.reason};
  state.history.unshift(event);
  if(fixture.deferComplianceAction)return new Promise(resolve=>{fixture.resolveComplianceAction=()=>resolve({data:{saved:true},error:null});});
  return {data:{saved:true},error:null};
 }
 if(name==='submit_vendor_payment_profile' && fixture.compliance) {
  const state=fixture.compliance;state.bankProfiles.push({id:'synthetic-pending-bank',vendor_id:state.vendor.id,destination:args.p_destination,eft:args.p_eft,payshap:args.p_payshap,created_at:'2026-10-26T10:00:00Z',approved_at:null});
  return {data:'synthetic-pending-bank',error:null};
 }
 if(name==='get_vendor_agreement_state') {
  const state=structuredClone(fixture.agreement || {vendorId:fixture.user?.vendorId,enabled:false,businessReady:false,assignment:null,requiresAcceptance:false,history:[]});
  if(fixture.deferAgreementLoad)return new Promise(resolve=>{fixture.resolveAgreementLoad=()=>resolve({data:state,error:null});});
  return {data:state,error:null};
 }
 if(name==='accept_assigned_vendor_agreement') {
  fixture.agreementCalls ||= [];fixture.agreementCalls.push(args);
  const state=fixture.agreement;
  if(!state?.enabled)return {data:null,error:{code:'42501'}};
  if(args.p_assignment!==state.assignment?.id)return {data:null,error:{code:'40001'}};
  const receipt=(state.history || []).find(r=>r.assignment_id===args.p_assignment) || {
   id:'synthetic-agreement-receipt',assignment_id:args.p_assignment,vendor_id:fixture.user.vendorId,actor_id:fixture.user.id,
   signer_name:fixture.user.name,method:'authenticated',documents:state.assignment.documents,
   acknowledgements:[true],acknowledgement_text:'SYNTHETIC explicit authorised acceptance',accepted_at:'2026-10-26T10:00:00Z',
  };
  state.history=[receipt];state.requiresAcceptance=false;state.accepted=true;
  if(fixture.agreementLostResponse){fixture.agreementLostResponse=false;return {data:null,error:{code:'NETWORK_ERROR'}};}
  if(fixture.deferAgreementAccept)return new Promise(resolve=>{fixture.resolveAgreementAccept=()=>resolve({data:receipt,error:null});});
  return {data:receipt,error:null};
 }
  if(window.fixtureMissingReleaseRpcs&&['get_collection_options','admin_collection_workspace','get_order_assistance_options','assisted_order_workspace','cash_custody_workspace'].includes(name))return {data:null,error:{code:'PGRST202',message:'Synthetic missing release RPC'}};
  if(name==='cash_custody_workspace')return {data:{adminCashEnabled:false,receipts:[],handovers:[]},error:null};
  if(name==='get_order_assistance_options')return {data:{requestsEnabled:false,dates:[]},error:null};
  if(name==='assisted_order_workspace')return {data:{enabled:false,cashEnabled:false,vendors:[],meals:[],requests:[],orders:[],dates:[]},error:null};
 if(name==='get_collection_options')return window.fixtureCollectionError?{data:null,error:{message:'Synthetic collection unavailable'}}:{data:window.fixtureCollection||{enabled:false,windows:[]},error:null};
 if(name==='admin_collection_workspace')return {data:window.fixtureCollectionAdmin||null,error:null};
 if(name==='admin_collection_config'){
  fixture.collectionConfigCalls=(fixture.collectionConfigCalls||0)+1;fixture.collectionConfigChange=args;
  fixture.collectionRequestResults ||= {};
  if(fixture.collectionRequestResults[args.p_request_id])return {data:fixture.collectionRequestResults[args.p_request_id],error:null};
  if(window.fixtureCollectionAdmin)window.fixtureCollectionAdmin.policy.revision++;
  const saved={revision:window.fixtureCollectionAdmin?.policy.revision};fixture.collectionRequestResults[args.p_request_id]=saved;
  if(window.fixtureCollectionResponseLost){window.fixtureCollectionResponseLost=false;return {data:null,error:{message:'Synthetic response lost after commit'}};}
  return {data:saved,error:null};
 }
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
 if(name==='get_customer_legal_state')return {data:fixture.customerLegal || window.fixtureCustomerLegal || {enabled:false,ready:false,documents:{}},error:null};
 if(name==='get_legal_portal'&&fixture.legalPortal)return {data:fixture.legalPortal,error:null};
 if(name==='get_order_legal_receipt')return {data:fixture.orderLegalReceipt || null,error:null};
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
const fixtureStorage=supabase.storage; const originalStorageFrom=fixtureStorage.from.bind(fixtureStorage);
Object.defineProperty(supabase,'storage',{value:{from:bucket=>bucket!=='vendor-compliance'?originalStorageFrom(bucket):{
 upload:async(path,file,options)=>{fixture.complianceUploads ||= [];fixture.complianceUploads.push({path,type:file.type,options});return {data:{path},error:null};},
 createSignedUrl:async(path,seconds)=>{fixture.evidenceLink={path,seconds};return {data:{signedUrl:'https://private-fixture.invalid/evidence'},error:null};},
}}});
supabase.from=()=>({select(){return this;},eq(){return this;},order(){return this;},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}});
history.replaceState({},'',new URLSearchParams(location.search).get('route') || (location.pathname === '/checks/browser-harness.html' ? '/' : location.pathname));
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
