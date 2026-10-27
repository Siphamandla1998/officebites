import { useState } from 'react';
import { AgreementDocuments } from './AgreementDocuments';
const fields = { agreement: 'vendor-agreement', schedule: 'vendor-fees', standards: 'vendor-standards', privacy: 'privacy', refunds: 'refund-policy' };
const names = { agreement: 'Vendor Agreement', schedule: 'Vendor-specific Commercial Schedule', standards: 'Operating Standards', privacy: 'Privacy', refunds: 'Refunds' };
export default function ComplianceAssignmentForm({ data, disabled, assign }) {
 const [selected, setSelected] = useState({});
 const documents = Object.fromEntries(Object.entries(selected).map(([field, id]) => [fields[field], data.documents.find(d => d.id === id)]));
 return <form className="card p-4 sm:p-6 space-y-4" onSubmit={event => {
  event.preventDefault(); const form = new FormData(event.currentTarget);
  assign({ ...selected, changeBasis: form.get('basis'), notifiedAt: `${form.get('notice')}:00+02:00`, effectiveAt: `${form.get('effective')}:00+02:00` });
 }}>
  <h2 className="text-lg font-semibold">Assign approved agreement versions</h2>
  <p className="text-sm">Only already-approved versions are available. This action does not publish documents, open vendor acceptance or send notices. Record actual notice delivery and the approved legal basis.</p>
  {!data.documents.length && <p role="status">No approved versions are available. Working drafts cannot be assigned.</p>}
  {Object.entries(fields).map(([field, kind]) => <label className="block text-sm" key={field}>{names[field]}
   <select aria-label={names[field]} className="input mt-1 w-full" required disabled={disabled} value={selected[field] || ''} onChange={event => setSelected(current => ({ ...current, [field]: event.target.value }))}>
    <option value="">Select an approved version</option>
    {data.documents.filter(d => d.kind === kind && (field !== 'schedule' || d.vendor_id === data.vendor.id)).map(d => <option key={d.id} value={d.id}>{d.title} · {d.version} · {d.content_hash.slice(0, 10)}</option>)}
   </select>
  </label>)}
  <details><summary className="cursor-pointer py-2">Review selected text and exact hashes</summary><AgreementDocuments documents={documents} prefix="assignment-preview" /></details>
  <label className="block text-sm">Approved change classification<select className="input mt-1" name="basis" required disabled={disabled}>
   <option value="initial">Initial agreement</option><option value="material">Material change — 30-day notice</option><option value="urgent">Approved urgent exception</option><option value="informational">Informational — no new assent</option>
  </select></label>
  <div className="grid sm:grid-cols-2 gap-3"><label className="text-sm">Notice delivered at (SAST)<input className="input mt-1" type="datetime-local" name="notice" required disabled={disabled} /></label>
   <label className="text-sm">Effective at (SAST)<input className="input mt-1" type="datetime-local" name="effective" required disabled={disabled} /></label></div>
  <button className="btn-secondary min-h-11" disabled={disabled || !data.documents.length}>Assign approved versions</button>
 </form>;
}
