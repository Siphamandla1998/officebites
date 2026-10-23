import {formatCurrency} from '../../utils/formatters';
import {collectionDay,collectionLabel} from '../../utils/collection';
export default function CollectionBooking({options,value,onChange,disabled}) {
 const windows=options.windows||[];
 const days=[...new Set(windows.map(w=>collectionDay(w.startsAt)))];
 const day=value?.day||'';
 return <section className="card p-4 flex flex-col gap-3" aria-label="Collection booking">
  <h2 className="section-title">Collect your order</h2>
  <p>Collection at the approved Eduvos pickup point is {formatCurrency(0)}. Delivery is unavailable for this collection pilot.</p>
  {!windows.length?<p role="status">No collection windows are available. Your cart is saved; please try later.</p>:<>
   <label>Collection day<select className="input min-h-11" disabled={disabled} value={day} onChange={e=>onChange({day:e.target.value})}>
    <option value="">Choose a day</option>{days.map(d=><option key={d} value={d}>{d}</option>)}
   </select></label>
   <label>Collection window<select className="input min-h-11" disabled={disabled||!day} value={value?.key||''} onChange={e=>{
    const window=windows.find(w=>`${w.id}:${w.destinationId}`===e.target.value);
    onChange(window?{day,key:e.target.value,...window,policyRevision:options.revision}:{day});
   }}>
    <option value="">Choose an available window</option>{windows.filter(w=>collectionDay(w.startsAt)===day).map(w=><option key={`${w.id}:${w.destinationId}`} value={`${w.id}:${w.destinationId}`}>{collectionLabel(w)} · {w.destinationLabel}</option>)}
   </select></label>
  </>}
  {value?.id&&<p role="status">{value.destinationLabel} · {collectionLabel(value)}. Your place is reserved only after checkout succeeds. Payment still requires independent receipt verification.</p>}
 </section>;
}
