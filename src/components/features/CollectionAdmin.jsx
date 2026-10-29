import {useRef,useState} from 'react';
import {collectionService} from '../../services/collectionService';
import {manualRequestKey} from '../../services/manualPaymentService';
import {useAsync} from '../../hooks/useAsync';
import RequestError from '../ui/RequestError';
export default function CollectionAdmin() {
 const result=useAsync(collectionService.workspace,[],null);
 const [kind,setKind]=useState('window'),[draft,setDraft]=useState({}),[reason,setReason]=useState('');
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(null);
 const lock=useRef(false),operation=useRef(null);const data=result.data;
 async function reconcile(){try{await result.refetch({throwOnError:true});setUncertain(false);setError(null);}catch(e){setError(e);}}
 async function save(event){
  event.preventDefault();if(lock.current||uncertain||!data)return;
  lock.current=true;setBusy(true);setError(null);setMessage('');
  try{
   const change={...draft,kind};const fingerprint=JSON.stringify([change,reason]);
   if(operation.current?.fingerprint!==fingerprint)operation.current={fingerprint,revision:data.policy.revision,request:await manualRequestKey(JSON.stringify(['collection-config',change,data.policy.revision,reason]))};
   const pending=operation.current;
   await collectionService.configure(change,pending.revision,pending.request.id,reason);
   pending.request.clear();operation.current=null;setReason('');setUncertain(true);setMessage('Saved. Reloading collection settings…');
   try{await result.refetch({throwOnError:true});setUncertain(false);setMessage('Saved and reloaded collection settings.');}
   catch(e){setError(e);setMessage('Save succeeded, but reload failed. Reload before making another change.');}
  }catch(e){setError(e);setUncertain(true);setMessage('Save was not confirmed. Reload settings before deciding whether to retry.');}
  finally{lock.current=false;setBusy(false);}
 }
 const field=(name,label,type='text')=><label key={name}>{label}<input className="input min-h-11" type={type} step={type==='number'?'any':undefined} required value={draft[name]??''} onChange={e=>setDraft({...draft,[name]:e.target.value})}/></label>;
 return <section className="card p-4 flex flex-col gap-3" aria-label="Collection administration">
  <h2 className="section-title">Collection booking settings</h2><RequestError error={error||result.error} onRetry={reconcile}/>
  {message&&<p role="status">{message}</p>}
  {!data?.policy?<p>Collection booking settings are unavailable.</p>:<>
   <p>Eduvos collection is free. Delivery pricing and payment activation are managed separately. Booking policy: {data.policy.enabled?'enabled':'disabled'}.</p>
   <form onSubmit={save} className="flex flex-col gap-3"><fieldset className="flex flex-col gap-3" disabled={busy||result.loading||uncertain}>
    <label>Configuration type<select className="input min-h-11" value={kind} onChange={e=>{setKind(e.target.value);setDraft({});}}><option value="window">Collection window</option><option value="destination">Approved pickup point</option><option value="agreement">Commission agreement</option></select></label>
    {kind==='window'&&<>
     <label>Existing window<select className="input min-h-11" value={draft.id||''} onChange={e=>{const w=data.windows.find(w=>w.id===e.target.value);setDraft(w?{id:w.id,vendorId:w.vendor_id,startsAt:w.starts_at,endsAt:w.ends_at,cutoffAt:w.cutoff_at,capacity:w.capacity,preparationMinutes:w.preparation_minutes,available:w.available}:{});}}><option value="">New window</option>{data.windows.map(w=><option key={w.id} value={w.id}>{new Date(w.starts_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})} · {w.vendor_id}</option>)}</select></label>
     {field('vendorId','Vendor ID')}{field('startsAt','Start time (ISO 8601 with timezone)')}{field('endsAt','End time (ISO 8601 with timezone)')}{field('cutoffAt','Booking cutoff (ISO 8601 with timezone)')}{field('preparationMinutes','Preparation lead time (minutes)','number')}{field('capacity','Order capacity','number')}
     <label><input type="checkbox" checked={Boolean(draft.available)} onChange={e=>setDraft({...draft,available:e.target.checked})}/> Available for booking</label>
    </>}
    {kind==='destination'&&<>{field('label','Approved Eduvos pickup point')}<label><input type="checkbox" checked={Boolean(draft.approved)} onChange={e=>setDraft({...draft,approved:e.target.checked})}/> Operator approved this pickup point</label></>}
    {kind==='agreement'&&<>{field('vendorId','Vendor ID')}{field('version','Signed agreement version')}{field('rate','Agreed food commission rate (0 to 1)','number')}<p>Use the actual approved vendor agreement. The 2% component is not an asserted processor charge.</p></>}
    <label>Approval evidence and reason<textarea className="input" required minLength={15} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <button className="btn-primary min-h-11" type="submit">Save collection configuration</button>
   </fieldset></form>
  </>}
  <button className="btn-outline min-h-11" disabled={busy||result.loading} onClick={reconcile}>Reload collection settings</button>
 </section>;
}
