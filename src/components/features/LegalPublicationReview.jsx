import { useState } from 'react';
const checks = {completeText:'Complete final text; no placeholders',businessDisclosures:'Verified statutory business disclosures',capabilities:'Promises match enabled and tested capabilities',consumerRights:'Statutory remedies preserved',feesAndVat:'Fees, flat marketing tiers and VAT reviewed',privacyAndStorage:'Data inventory, transfers, retention and storage reviewed',notices:'Notice classification and actual delivery evidence reviewed',legalSignoff:'Explicit final legal sign-off for these exact bytes'};
export default function LegalPublicationReview({ data, busy, save }) {
 const [id,setId]=useState('');const [reference,setReference]=useState('');const [confirmed,setConfirmed]=useState({});
 const selected=data.documents.find(d=>d.id===id);
 return <form className="card p-4 space-y-3" onSubmit={e=>{e.preventDefault();save('approve_document',{id,approvalReference:reference,expectedHash:selected.content_hash,checks:confirmed});}}>
  <h2 className="font-semibold">Review publication readiness</h2>
  <p>Publication is release-disabled until separately authorised. A checklist records review evidence; it cannot supply missing legal sign-off. Working drafts must stay unpublished.</p>
  <label className="block">Unpublished version<select aria-label="Unpublished version" className="input" value={id} onChange={e=>{setId(e.target.value);setConfirmed({});setReference('');}} disabled={busy}><option value="">Select version</option>{data.documents.filter(d=>!d.approved_at).map(d=><option key={d.id} value={d.id}>{d.kind} · {d.version}</option>)}</select></label>
  {selected&&<details><summary className="cursor-pointer py-2">Review exact document text and hash</summary><p className="whitespace-pre-wrap break-words">{selected.content}</p><p className="break-all text-xs">SHA-256: {selected.content_hash}</p></details>}
  <label className="block">Final legal approval reference<textarea className="input" minLength={15} maxLength={1000} value={reference} onChange={e=>setReference(e.target.value)} disabled={busy}/></label>
  {Object.entries(checks).map(([key,label])=><label className="flex gap-3 py-2 text-sm" key={key}><input type="checkbox" checked={confirmed[key]===true} onChange={e=>setConfirmed({...confirmed,[key]:e.target.checked})} disabled={busy}/>{label}</label>)}
  <button className="btn-secondary min-h-11" disabled={busy || data.publicationEnabled!==true || !selected || reference.trim().length<15 || !Object.keys(checks).every(k=>confirmed[k]===true)}>Approve publication</button>
 </form>;
}
