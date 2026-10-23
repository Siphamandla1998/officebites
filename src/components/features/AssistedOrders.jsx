import {useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {useAsync} from '../../hooks/useAsync';
import {assistedOrderService as service} from '../../services/assistedOrderService';
import {collectionService} from '../../services/collectionService';
import {manualPaymentService,manualRequestKey} from '../../services/manualPaymentService';
import {formatCurrency} from '../../utils/formatters';
import {validateMobile} from '../../utils/mobile';
import CollectionBooking from './CollectionBooking';
import CashCustody from './CashCustody';
import RequestError from '../ui/RequestError';

export default function AssistedOrders({vendorId}){
 const {user}=useAuth();const [open,setOpen]=useState(false);
 return <section className="card p-4 flex flex-col gap-3" aria-label="Assisted orders">
  <button type="button" className="btn-outline min-h-11" aria-expanded={open} aria-controls="assisted-order-panel" onClick={()=>setOpen(!open)}>Create Order / Assisted Orders</button>
  {open&&<div id="assisted-order-panel"><Workspace key={`${user?.id}:${vendorId||'admin'}`} vendorId={vendorId}/></div>}
 </section>;
}
function Workspace({vendorId}){
 const workspace=useAsync(()=>service.workspace(vendorId),[vendorId],null);
 const [vendor,setVendor]=useState(vendorId||''),[items,setItems]=useState([]),[meal,setMeal]=useState(''),[qty,setQty]=useState(1);
 const [customer,setCustomer]=useState({name:'',phone:'',email:''});
 const [cashReceipt,setCashReceipt]=useState({amount:'',identifier:'',evidence:'',personallyReceived:false});
 const [choice,setChoice]=useState(null),[method,setMethod]=useState('manual_eft'),[channel,setChannel]=useState('in_person'),[notes,setNotes]=useState(''),[evidence,setEvidence]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[failure,setFailure]=useState(null),[created,setCreated]=useState(null),[selectedRequest,setSelectedRequest]=useState(null);
 const lock=useRef(false),operation=useRef(null);
 const options=useAsync(()=>collectionService.options(vendor),[vendor],null);
 const methods=useAsync(()=>vendor?manualPaymentService.methods(vendor):Promise.resolve({}),[vendor],{});
 const data=workspace.data;
 const valid=choice?.id&&choice.policyRevision===options.data?.revision&&options.data.windows?.some(w=>w.id===choice.id&&w.destinationId===choice.destinationId&&w.revision===choice.revision);
 const total=Number(items.reduce((sum,item)=>sum+Number(item.price)*item.qty,0).toFixed(2));
 const prepaid=method!=='cash'||(Number(cashReceipt.amount)===total&&cashReceipt.identifier.trim().length>=3&&cashReceipt.evidence.trim().length>=15&&cashReceipt.personallyReceived);
 const canCreate=data?.enabled&&valid&&methods.data?.[method]===true&&(method!=='cash'||data.cashEnabled)&&items.length&&confirmed&&prepaid&&!busy&&!options.error&&!methods.error;
 async function submit(event){
  event.preventDefault();if(lock.current||!canCreate)return;lock.current=true;setBusy(true);setFailure(null);
  try{
   const mobile=validateMobile(customer.phone);if(!mobile.valid)throw new Error(mobile.message);
   const input={vendorId:vendor,customer:{...customer,phone:mobile.value,...(method==='cash'?{cashReceipt:{...cashReceipt,amount:Number(cashReceipt.amount)}}:{})},items,collection:choice,method,total,channel,notes,evidence};
   const fingerprint=JSON.stringify([selectedRequest,input]);
   if(operation.current?.fingerprint!==fingerprint)operation.current={fingerprint,request:await manualRequestKey(fingerprint)};
   const request=operation.current.request;input.requestId=request.id;
   const result=selectedRequest?await service.convert(selectedRequest,input):await service.create(input);
   request.clear();operation.current=null;setCreated(result);await workspace.refetch();
  }catch(error){setFailure(error);}finally{lock.current=false;setBusy(false);}
 }
 function selectRequest(request){
  setSelectedRequest(request.id);setVendor(request.vendorId);setChoice(null);setConfirmed(false);
  setCustomer({name:request.name,phone:request.phone,email:''});setNotes(request.note||'');setChannel('customer_request');
  setItems(request.items.map(i=>{const m=data.meals.find(m=>m.id===i.mealId);return {...i,name:m?.name||'Unavailable item',price:m?.price||0};}));
 }
 if(workspace.loading)return <p role="status">Loading assisted-order controls…</p>;
 return <div className="flex flex-col gap-4">
  <RequestError error={failure||workspace.error||options.error||methods.error} onRetry={()=>{workspace.refetch();options.refetch();methods.refetch();}}/>
  {!data?.enabled&&<p role="status">Assisted ordering is locked. No payment or booking is activated.</p>}
  {!vendorId&&<p>Admin cash custody remains locked until a separate custody and settlement policy is approved. Assisted EFT remains subject to its own activation checks.</p>}
  {created?<div role="status"><p>Order created: <strong>{created.ticket_number}</strong>. {created.payment_method==='cash'?'Cash receipt and collection reservation recorded together.':'Awaiting independent bank receipt verification.'}</p><Link className="btn-outline min-h-11" to={`/payment/${created.id}`}>View protected order payment details</Link></div>:<form onSubmit={submit} className="flex flex-col gap-3" aria-label="Create assisted order">
   <fieldset disabled={busy||!data?.enabled} className="flex flex-col gap-3">
    <label>Vendor<select className="input min-h-11" required disabled={!!vendorId||busy} value={vendor} onChange={e=>{setVendor(e.target.value);setItems([]);setChoice(null);setSelectedRequest(null);}}><option value="">Choose vendor</option>{data?.vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
    <label>Customer name<input className="input" required maxLength={200} value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})}/></label>
    <label>Customer phone<input className="input" type="tel" required maxLength={24} value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})}/></label>
    <label>Customer email (optional)<input className="input" type="email" value={customer.email} onChange={e=>setCustomer({...customer,email:e.target.value})}/></label>
    <label>Marketing campaign (optional)<input className="input" maxLength={100} value={customer.campaign||''} onChange={e=>setCustomer({...customer,campaign:e.target.value})}/></label>
    <label>Menu item<select className="input min-h-11" value={meal} onChange={e=>setMeal(e.target.value)}><option value="">Choose item</option>{data?.meals.filter(m=>m.vendorId===vendor).map(m=><option key={m.id} value={m.id}>{m.name} · {formatCurrency(m.price)}</option>)}</select></label>
    <label>Quantity<input className="input" type="number" min={1} max={100} value={qty} onChange={e=>setQty(Number(e.target.value))}/></label>
    <button type="button" className="btn-outline min-h-11" disabled={!meal||qty<1||qty>100||!Number.isInteger(qty)} onClick={()=>{const m=data.meals.find(m=>m.id===meal);setItems(list=>[...list.filter(i=>i.mealId!==meal),{mealId:meal,qty,name:m.name,price:m.price}]);}}>Add item</button>
    {items.map(i=><p key={i.mealId}>{i.qty} × {i.name}<button className="btn-outline" type="button" onClick={()=>setItems(items.filter(item=>item.mealId!==i.mealId))}>Remove {i.name}</button></p>)}
    {options.data?.enabled&&<CollectionBooking options={options.data} value={choice} onChange={setChoice} disabled={busy}/>}
    <label>Payment method<select className="input min-h-11" value={method} onChange={e=>setMethod(e.target.value)}><option value="manual_eft" disabled={!methods.data?.manual_eft}>Vendor-direct EFT</option><option value="cash" disabled={!data?.cashEnabled||!methods.data?.cash}>Cash Received — staff only</option></select></label>
    {method==='cash'&&<fieldset className="card p-3 flex flex-col gap-3"><legend>Cash received before ordering</legend>
     <p>Only the authorised staff member who personally received the full amount may submit. This is not cash on collection.</p>
     <label>Amount actually received (R)<input className="input" type="number" step="0.01" min="0.01" required value={cashReceipt.amount} onChange={e=>setCashReceipt({...cashReceipt,amount:e.target.value})}/></label>
     <label>Cash receipt identifier<input className="input" required minLength={3} maxLength={100} value={cashReceipt.identifier} onChange={e=>setCashReceipt({...cashReceipt,identifier:e.target.value})}/></label>
     <label>Receipt evidence<textarea className="input" required minLength={15} maxLength={1000} value={cashReceipt.evidence} onChange={e=>setCashReceipt({...cashReceipt,evidence:e.target.value})}/></label>
     <label><input type="checkbox" checked={cashReceipt.personallyReceived} onChange={e=>setCashReceipt({...cashReceipt,personallyReceived:e.target.checked})}/> I personally received the full amount as an authorised recipient</label>
    </fieldset>}
    <label>Request received through<select className="input min-h-11" value={channel} onChange={e=>setChannel(e.target.value)}><option value="in_person">In person</option><option value="phone">Phone</option><option value="customer_request">Customer order request</option></select></label>
    <label>Internal notes<textarea className="input" maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    <label>Customer confirmation evidence<textarea className="input" required minLength={15} maxLength={1000} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
    <p>R0 collection · Total {formatCurrency(total)}. Prices, dates and capacity are checked again by the server. {method==='cash'?'The order, actual cash receipt and reservation must all succeed together.':'Order creation does not confirm an EFT receipt.'}</p>
    <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Customer confirmed the items, total and collection window</label>
    <button className="btn-primary min-h-11" disabled={!canCreate}>Create assisted order</button>
   </fieldset>
  </form>}
  {!!data?.requests.length&&<section><h3 className="font-semibold">Customer order requests</h3>{data.requests.map(r=><div key={r.id} className="card p-3"><p>{r.name} · {r.serviceDate} · {r.convertedOrderId?'Converted':'Request only — not an order'}</p>{!r.convertedOrderId&&<button className="btn-outline min-h-11" disabled={busy||!data.enabled} onClick={()=>selectRequest(r)}>Review request from {r.name}</button>}</div>)}</section>}
  {!!data?.orders.length&&<section className="flex flex-col gap-3"><h3 className="font-semibold">Assisted and cash reconciliation</h3>{data.orders.map(o=><ReceiptCard key={o.id} order={o} onSaved={workspace.refetch}/>)}</section>}
  {vendorId&&<ServiceDate vendorId={vendorId} dates={data?.dates||[]} reload={workspace.refetch}/>}
  <CashCustody vendorId={vendorId}/>
 </div>;
}
function ReceiptCard({order,onSaved}){
 const [kind,setKind]=useState('report'),[amount,setAmount]=useState(''),[reference,setReference]=useState(''),[evidence,setEvidence]=useState(''),[affirm,setAffirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(null);
 const lock=useRef(false),pending=useRef(null);
 async function save(e){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError(null);try{
  const fingerprint=JSON.stringify([order.id,kind,amount,reference,evidence,affirm]);if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,request:await manualRequestKey(fingerprint)};
  if(order.method==='cash')await service.cash(order.id,{requestId:pending.current.request.id,kind,amount,reference,evidence,personallyReceived:affirm});
  else await service.verifyEft(order.id,{amount,reference,evidence,verified:affirm});
  pending.current.request.clear();pending.current=null;setEvidence('');await onSaved();
 }catch(failure){setError(failure);}finally{lock.current=false;setBusy(false);}}
 return <form className="card p-3 flex flex-col gap-2" aria-label={`Reconcile ${order.reference}`} onSubmit={save}>
  <p>{order.reference} · {order.customer} · {order.serviceDate} · {order.method==='cash'?'Cash':'EFT'} · {order.paymentState}</p>
  {order.method==='cash'&&<p>Cash net {formatCurrency(order.cashNet)} · Outstanding before settlement {formatCurrency(order.balance)} · Cash returned {formatCurrency(order.cashRefunded||0)}. Physical refunds still require independent financial reconciliation.</p>}
  <RequestError error={error}/><fieldset disabled={busy} className="flex flex-col gap-2">
   {order.method==='cash'&&<label>Cash action<select className="input min-h-11" value={kind} onChange={e=>{setKind(e.target.value);setAffirm(false);}}><option value="report">Reported only — not verified</option><option value="receipt">Actual cash received</option><option value="refund">Actual cash returned</option></select></label>}
   <label>Amount (R)<input className="input" type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <label>{order.method==='cash'?'Receipt identifier':'Bank transaction reference'}<input className="input" required value={reference} onChange={e=>setReference(e.target.value)}/></label>
   <label>Independent evidence<textarea className="input" required minLength={15} maxLength={1000} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
   <label><input type="checkbox" checked={affirm} onChange={e=>setAffirm(e.target.checked)}/>{order.method==='cash'?'I personally received or returned this cash as an authorised recipient':'I independently checked the vendor bank records'}</label>
   <button className="btn-outline min-h-11" disabled={busy||(order.method!=='cash'||kind!=='report')&&!affirm}>Record {order.method==='cash'?'cash action':'bank verification'}</button>
  </fieldset>
 </form>;
}
function ServiceDate({vendorId,dates,reload}){
 const [date,setDate]=useState(''),[enabled,setEnabled]=useState(true),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(null);const pending=useRef(null),lock=useRef(false);
 async function save(e){e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);try{const current=dates.find(d=>d.vendor_id===vendorId&&d.service_date===date);const fingerprint=JSON.stringify([date,enabled,reason]);if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,revision:current?.revision||0,request:await manualRequestKey(fingerprint)};await service.setDate(vendorId,date,enabled,pending.current.revision,pending.current.request.id,reason);pending.current.request.clear();pending.current=null;setReason('');await reload();setError(null);}catch(e){setError(e);}finally{lock.current=false;setBusy(false);}}
 return <form className="card p-3 flex flex-col gap-2" onSubmit={save} aria-label="Vendor service dates"><h3 className="font-semibold">Approve future service dates</h3><RequestError error={error}/><fieldset className="flex flex-col gap-2" disabled={busy}><label>Service date<input className="input" type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Vendor will serve this date</label><label>Date approval evidence<textarea className="input" required minLength={15} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="btn-outline min-h-11">Save service date</button></fieldset></form>;
}
