import {supabase} from './api/supabaseClient';
import {savePaymentToken} from './manualPaymentService';
async function rpc(name,args,missing){const {data,error}=await supabase.rpc(name,args);if(error?.code==='PGRST202'&&missing!==undefined)return missing;if(error)throw new Error(error.message||'Order assistance unavailable');return data;}
export const assistedOrderService={
 workspace:vendorId=>rpc('assisted_order_workspace',{p_vendor:vendorId||null},{enabled:false,cashEnabled:false,vendors:[],meals:[],requests:[],orders:[],dates:[]}),
 options:vendorId=>rpc('get_order_assistance_options',{p_vendor:vendorId},{requestsEnabled:false,dates:[]}),
 async create(input){const order=await rpc('create_assisted_order',{
  p_vendor:input.vendorId,p_customer:input.customer,p_items:input.items.map(i=>({mealId:i.mealId,qty:Number(i.qty)})),
  p_window:input.collection.id,p_destination:input.collection.destinationId,p_policy_revision:input.collection.policyRevision,p_window_revision:input.collection.revision,
  p_method:input.method,p_request:input.requestId,p_confirmed_total:input.total,p_channel:input.channel,p_notes:input.notes,p_request_evidence:input.evidence,
 });savePaymentToken(order.id,order.payment_token);return order;},
 cash:(orderId,value)=>rpc('record_cash_event',{p_order:orderId,p_request:value.requestId,p_kind:value.kind,p_amount:Number(value.amount),p_receipt:value.reference,p_evidence:value.evidence,p_personally_received:value.personallyReceived}),
 verifyEft:(id,value)=>rpc('record_eft_receipt',{p_order:id,p_amount:Number(value.amount),p_reference:value.reference,p_evidence:value.evidence,p_independently_verified:value.verified}),
 setDate:(vendorId,date,enabled,revision,requestId,reason)=>rpc('vendor_set_service_date',{p_vendor:vendorId,p_date:date,p_enabled:enabled,p_revision:revision,p_request:requestId,p_reason:reason}),
 submitRequest:value=>rpc('submit_order_request',{p_vendor:value.vendorId,p_name:value.name,p_phone:value.phone,p_items:value.items.map(i=>({mealId:i.mealId,qty:Number(i.qty)})),p_date:value.date,p_note:value.note,p_request:value.requestId}),
 request:(id,token)=>rpc('get_order_request',{p_request:id,p_token:token}),
 custody:vendorId=>rpc('cash_custody_workspace',{p_vendor:vendorId||null},{adminCashEnabled:false,receipts:[],handovers:[]}),
 initiateHandover:value=>rpc('initiate_cash_handover',{p_order:value.orderId,p_request:value.requestId,p_recipient:value.recipientId,p_amount:Number(value.amount),p_method:value.method,p_evidence:value.evidence}),
 respondHandover:value=>rpc('respond_cash_handover',{p_handover:value.handoverId,p_request:value.requestId,p_action:value.action,p_evidence:value.evidence}),
 convert:(id,value)=>rpc('convert_order_request',{p_request:id,p_window:value.collection.id,p_destination:value.collection.destinationId,p_policy_revision:value.collection.policyRevision,p_window_revision:value.collection.revision,p_method:value.method,p_operation:value.requestId,p_confirmed_total:value.total,p_evidence:value.evidence,p_cash_receipt:value.method==='cash'?value.customer.cashReceipt:null}),
};
