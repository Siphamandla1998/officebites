import { Link } from 'react-router-dom';
import { agreementLabels as labels, agreementKinds } from '../../utils/vendorAgreement';
export function AgreementDocuments({ documents, prefix = 'current' }) {
  return <div className="space-y-5 min-w-0">
    {agreementKinds.map(kind => {
      const document = documents?.[kind];
      if (!document) return null;
      const titleId = `${prefix}-${kind}`;
      return <section key={kind} aria-labelledby={titleId} className="min-w-0">
        <h3 id={titleId} className="font-semibold text-ink">{labels[kind]}</h3>
        <p className="text-xs text-ink-muted mt-1">Version {document.version}</p>
        <div className="mt-2 max-h-[26rem] overflow-y-auto print:max-h-none print:overflow-visible rounded-xl border border-line bg-paper p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-nude-700"
          tabIndex={0} role="region" aria-label={`${labels[kind]} full text`}>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{document.content}</p>
        </div>
        <details className="text-xs text-ink-muted mt-2"><summary className="cursor-pointer py-2">Document verification details</summary>
          <p className="break-all">SHA-256: {document.content_hash}</p>
        </details>
      </section>;
    })}
  </div>;
}
export function AgreementHistory({ history = [] }) {
  return <section className="card p-4 sm:p-6 space-y-3" aria-labelledby="agreement-history">
    <h2 id="agreement-history" className="text-lg font-semibold">Previously accepted agreements</h2>
    {!history.length && <p className="text-sm text-ink-muted">No acceptance has been recorded for this account and vendor.</p>}
    {history.map(receipt => <details key={receipt.id} className="border-t border-line pt-3">
      <summary className="cursor-pointer py-2 text-sm font-medium">{receipt.assignment_id ? 'Agreement accepted' : 'Earlier consent record'} · {new Date(receipt.accepted_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST</summary>
      <div className="space-y-4 py-3">
        <p className="text-sm">{receipt.acknowledgement_text || 'Earlier application acknowledgements are retained as originally recorded.'}</p>
        <p className="text-xs break-all">Receipt: {receipt.id} · Signer: {receipt.signer_name || receipt.actor_id}</p>
        <AgreementDocuments documents={receipt.documents} prefix={`receipt-${receipt.id}`} />
        <details className="text-xs"><summary className="cursor-pointer py-2">Original consent evidence</summary>
          <p>Method: {receipt.method}</p><p className="break-words">Acknowledgements: {JSON.stringify(receipt.acknowledgements)}</p>
        </details>
      </div>
    </details>)}
    <button type="button" className="btn-secondary min-h-11 print:hidden" onClick={event => {
      const records = [...event.currentTarget.closest('section').querySelectorAll('details')];
      const opened = records.map(record => record.open);
      records.forEach(record => { record.open = true; });
      try { window.print(); } finally { records.forEach((record, index) => { record.open = opened[index]; }); }
    }}>Print / save agreement records</button>
    <p className="text-xs text-ink-muted">For an accessible copy or questions, contact <Link className="underline" to="/help/contact">Support</Link>.</p>
  </section>;
}
