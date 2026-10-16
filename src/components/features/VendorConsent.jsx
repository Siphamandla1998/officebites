import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { commercialService } from '../../services/commercialService';
const statements = [
  'I have read and accepted the Vendor Partnership Agreement.',
  'I understand the 15% platform commission.',
  'I understand the 2% transaction-processing charge.',
  'I understand that standard deductions total 17%.',
  'I have reviewed the Privacy & POPIA Policy.',
  'I have reviewed the Refund & Cancellation Policy.',
  'I understand corporate acquisition commissions are optional, additional and require a separate agreement.',
  'I am authorised to accept these terms on behalf of the vendor.',
];
export default function VendorConsent({ onChange }) {
  const { data, loading, error, refetch } = useAsync(() => commercialService.portal(), [], null);
  const [checked, setChecked] = useState(Array(8).fill(false));
  const documents = Object.fromEntries(Object.entries(data?.documents || {}).map(([k, v]) => [k, v.id]));
  const ready = data?.businessReady && ['vendor-agreement','vendor-fees','privacy','refund-policy'].every(k => documents[k]);
  return <fieldset className="card p-4 space-y-3"><legend className="font-semibold">Vendor agreement</legend>
    <p className="text-sm"><Link className="underline" to="/privacy">Privacy</Link> · <Link className="underline" to="/refund-policy">Refunds</Link></p>
    {['vendor-agreement', 'vendor-fees'].map(kind => data?.documents?.[kind] && <details key={kind}>
      <summary className="cursor-pointer underline">{kind === 'vendor-agreement' ? 'Review vendor agreement' : 'Review vendor fee schedule'}</summary>
      <p>{data.documents[kind].title} · {data.documents[kind].version}</p>
      <div className="whitespace-pre-wrap break-words text-sm">{data.documents[kind].content}</div>
    </details>)}
    {loading && <p role="status">Loading agreement requirements…</p>}
    {error && <p role="alert">Agreement requirements unavailable. <button type="button" onClick={() => refetch()}>Retry</button></p>}
    {!ready && !loading && !error && <p>Approved documents and disclosures are pending. No acceptance of unpublished terms will be recorded. The new agreement programme remains disabled.</p>}
    {ready && statements.map((statement, index) => <label key={statement} className="flex items-start gap-3 text-sm">
      <input type="checkbox" checked={checked[index]} required={data.onboardingEnforced} onChange={e => {
        const next = checked.map((v, i) => i === index ? e.target.checked : v);
        setChecked(next);onChange({ documents, acknowledgements: next });
      }} />{statement}
    </label>)}
  </fieldset>;
}
