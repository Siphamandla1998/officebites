import {useRef,useState} from 'react';
import {useAsync} from '../../hooks/useAsync';
import {useAuth} from '../../context/AuthContext';
import {assistedOrderService as service} from '../../services/assistedOrderService';
import {manualRequestKey} from '../../services/manualPaymentService';
import {formatCurrency} from '../../utils/formatters';
import RequestError from '../ui/RequestError';

export default function CashCustody({vendorId}){
 const {user}=useAuth();
 const result=useAsync(()=>service.custody(vendorId),[vendorId,user?.id],null);
 return <section className="card p-3 flex flex-col gap-3" aria-label="Cash custody and settlement">
  <h3 className="font-semibold">Cash custody and settlement</h3>
  <RequestError error={result.error} onRetry={result.refetch}/>
  {result.loading&&<p role="status">Loading restricted cash records…</p>}
  {!result.data?.adminCashEnabled&&<p>New admin cash collection and handover initiation are locked. Existing recipient acknowledgements and refund reconciliation remain separate from customer payment status.</p>}
  {result.data?.receipts.map(r=><div key={r.order_id} className="card p-3"><p>{r.reference} · {r.custody==='vendor'?'Vendor-held cash':'Admin-held vendor funds'} · {r.handoverStatus}</p><p>Received {formatCurrency(r.amount)} · Transferred {formatCurrency(r.transferredToVendor)} · Vendor funds outstanding {formatCurrency(r.outstandingToVendor)} · Commission liability {formatCurrency(r.commissionLiability||0)}</p></div>)}
  {result.data?.handovers.map(h=><div key={h.id} className="card p-3"><p>Handover {h.id} · {formatCurrency(h.amount)} · {h.state}</p>{h.recipient_id===user?.id&&['awaiting_vendor_confirmation','disputed'].includes(h.state)&&<HandoverResponse key={h.id} handover={h} reload={result.refetch}/>}</div>)}
 </section>;
}
function HandoverResponse({handover,reload}){
 const [action,setAction]=useState('acknowledged'),[evidence,setEvidence]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(null),[message,setMessage]=useState('');
 const lock=useRef(false),pending=useRef(null);
 async function submit(event){event.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError(null);try{
  const fingerprint=JSON.stringify([handover.id,action,evidence]);if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,request:await manualRequestKey(fingerprint)};
  await service.respondHandover({handoverId:handover.id,requestId:pending.current.request.id,action,evidence});
  pending.current.request.clear();pending.current=null;setEvidence('');setMessage('Acknowledgement recorded. Customer payment status is unchanged.');await reload({throwOnError:true});
 }catch(failure){setError(failure);}finally{lock.current=false;setBusy(false);}}
 return <form className="flex flex-col gap-2" onSubmit={submit} aria-label="Independent handover response"><RequestError error={error}/>{message&&<p role="status">{message}</p>}<fieldset className="flex flex-col gap-2" disabled={busy}>
  <label>Handover response<select className="input min-h-11" value={action} onChange={e=>setAction(e.target.value)}><option value="acknowledged" disabled={handover.state==='disputed'}>I independently received the stated amount</option><option value="disputed" disabled={handover.state==='disputed'}>Dispute the stated receipt</option><option value="reversed">Confirm no transfer occurred / return documented</option></select></label>
  <label>Recipient evidence<textarea className="input" minLength={15} maxLength={1000} required value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
  <button className="btn-outline min-h-11" disabled={busy}>Record independent response</button>
 </fieldset></form>;
}
