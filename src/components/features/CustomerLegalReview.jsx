import { customerLegalLabels, customerLegalAcknowledgement } from '../../utils/customerLegal';
export function CustomerLegalDocuments({ documents = {}, prefix = 'checkout' }) {
 return <div className="space-y-3 min-w-0">{Object.entries(customerLegalLabels).map(([kind,label]) => documents[kind] && <details key={kind} className="border-t border-line py-2">
  <summary className="cursor-pointer py-2">{label} · {documents[kind].version}</summary>
  <div tabIndex={0} role="region" aria-label={label+' complete text'} className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words py-3 text-sm leading-relaxed print:max-h-none print:overflow-visible" id={prefix+'-'+kind}>{documents[kind].content}</div>
  <p className="text-xs break-all">SHA-256: {documents[kind].content_hash}</p>
 </details>)}</div>;
}
export default function CustomerLegalReview({ result, checked, onChange, disabled }) {
 const state=result.data;
 return <section className="card p-4 space-y-3 min-w-0" aria-labelledby="checkout-legal-heading">
  <h2 id="checkout-legal-heading" className="font-semibold">Review your order terms</h2>
  {result.loading ? <p role="status">Checking legal versions…</p> : result.error ? <div role="alert"><p>Legal review is unavailable. Please retry.</p><button type="button" className="btn-secondary min-h-11" onClick={()=>result.refetch()}>Reload legal review</button></div>
   : state?.enabled !== true ? <p role="status">Legal acceptance is not open. No acceptance is being recorded.</p> : !state.ready ? <p role="alert">Approved documents are not ready. Ordering is unavailable.</p> : <>
    <CustomerLegalDocuments documents={state.documents} />
    <label className="flex gap-3 py-2 text-sm"><input type="checkbox" className="shrink-0 mt-1" checked={checked} onChange={e=>onChange(e.target.checked)} disabled={disabled} />{customerLegalAcknowledgement}</label>
   </>}
 </section>;
}
