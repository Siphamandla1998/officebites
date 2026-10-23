import {useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAsync} from '../../hooks/useAsync';
import {assistedOrderService as service} from '../../services/assistedOrderService';
import {manualRequestKey} from '../../services/manualPaymentService';
import {validateMobile} from '../../utils/mobile';
import RequestError from '../ui/RequestError';
export default function CustomerOrderRequest({vendorId,items,customer}){
 const options=useAsync(()=>vendorId?service.options(vendorId):Promise.resolve(null),[vendorId],null);
 const [open,setOpen]=useState(false),[name,setName]=useState(customer?.name||''),[phone,setPhone]=useState(customer?.phone||''),[date,setDate]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(null),[request,setRequest]=useState(null),[status,setStatus]=useState(null);
 const lock=useRef(false),pending=useRef(null);
 async function submit(event){event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError(null);try{
  const mobile=validateMobile(phone);if(!mobile.valid)throw new Error(mobile.message);
  const input={vendorId,name,phone:mobile.value,items,date,note};const fingerprint=JSON.stringify(input);
  if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,request:await manualRequestKey(fingerprint)};
  const result=await service.submitRequest({...input,requestId:pending.current.request.id});
  pending.current.request.clear();pending.current=null;setRequest(result);
  try{sessionStorage.setItem('ob_order_request:'+result.id,JSON.stringify({token:result.token}));}catch{/* Current-session receipt still available. */}
 }catch(failure){setError(failure);}finally{lock.current=false;setBusy(false);}}
 async function refresh(){if(lock.current)return;lock.current=true;setBusy(true);try{setStatus(await service.request(request.id,request.token));setError(null);}catch(e){setError(e);}finally{lock.current=false;setBusy(false);}}
 if(!options.data?.requestsEnabled)return null;
 return <section className="card p-4 flex flex-col gap-3" aria-label="Order request">
  <button className="btn-outline min-h-11" type="button" aria-expanded={open} aria-controls="customer-order-request" onClick={()=>setOpen(!open)}>Request help placing this order</button>
  {open&&<div id="customer-order-request" className="flex flex-col gap-3">
   <p>A request is not a confirmed order, payment or booking. The vendor must confirm the current price and collection window before creating your order. Your cart stays saved.</p>
   <RequestError error={error}/>
   {request?<div role="status"><p>Request submitted. Reference {request.id}. Save this reference and keep this tab available for private status checks.</p><button className="btn-outline min-h-11" disabled={busy} onClick={refresh}>Check request status</button>{status&&<p>{status.state==='converted'?`Vendor created your order: ${status.orderTicket||status.convertedOrderId}`:'Awaiting vendor confirmation. No order is booked yet.'}</p>}<Link className="btn-outline" to="/track">Track a confirmed order with its ticket and your phone</Link></div>:<form onSubmit={submit} className="flex flex-col gap-3"><fieldset className="flex flex-col gap-3" disabled={busy}>
    <label>Request customer name<input className="input" required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Request customer phone<input className="input" type="tel" required value={phone} onChange={e=>setPhone(e.target.value)}/></label>
    <label>Requested service date<select className="input min-h-11" required value={date} onChange={e=>setDate(e.target.value)}><option value="">Choose vendor-approved date</option>{options.data.dates.map(d=><option key={d} value={d}>{d}</option>)}</select></label>
    <p>Preference: free collection at an approved Eduvos pickup point. Delivery is not offered.</p>
    <label>Request note (optional)<textarea className="input" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <button className="btn-outline min-h-11" disabled={!items.length||busy}>Submit order request</button>
   </fieldset></form>}
  </div>}
 </section>;
}
