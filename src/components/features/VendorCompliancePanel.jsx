import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useRequestGuard } from '../../hooks/useRequestGuard';
import { vendorComplianceService as service } from '../../services/vendorComplianceService';
import { bankingFields, complianceKinds, complianceExpiry, complianceStatus } from '../../utils/vendorCompliance';
import ComplianceAssignmentForm from './ComplianceAssignmentForm';

function EvidenceAccess({ submission }) {
 const [url, setUrl] = useState(''); const [error, setError] = useState('');
 const guard = useRequestGuard(submission.id);
 return <div className="space-y-2 print:hidden"><button type="button" className="btn-outline min-h-11" onClick={async () => {
  const current = guard.begin(); setError(''); setUrl('');
  try { const link = await service.evidenceUrl(submission.object_path); if (current()) setUrl(link); }
  catch (failure) { if (current()) setError(failure.message); }
 }}>Get private evidence link</button>
  {url && <a className="block underline py-2" href={url} target="_blank" rel="noopener noreferrer">Open evidence — link expires after 60 seconds</a>}
  {error && <p role="alert">{error}</p>}
 </div>;
}
function ComplianceContent({ vendorId, actorId }) {
 const online = useOnlineStatus(); const guard = useRequestGuard(`${actorId}:${vendorId}`); const lock = useRef(false);
 const [data, setData] = useState(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
 const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [uncertain, setUncertain] = useState(false);
 const [reason, setReason] = useState(''); const [until, setUntil] = useState(''); const [legacy, setLegacy] = useState(false); const [enroll, setEnroll] = useState(false);
 const load = useCallback(async () => {
  if (lock.current) return; const current = guard.begin(); setLoading(true); setError('');
  try { const state = await service.state(vendorId); if (current()) {
   if (state?.vendor?.id !== vendorId) throw new Error('Vendor account changed. Reload this page.');
   setData(state); setUncertain(false); setLegacy(false); setEnroll(false);
  }} catch (failure) { if (current()) { setData(null); setError(failure.message); } }
  finally { if (current()) setLoading(false); }
 }, [guard, vendorId]);
 useEffect(() => { if (online) void load(); const focus = () => { if (navigator.onLine) void load(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [load, online]);
 async function run(operation) {
  if (lock.current || !online || uncertain) return; const current = guard.capture(); lock.current = true; setBusy(true); setError(''); setNotice('');
  let timer;
  try { await Promise.race([operation(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Request timed out; the outcome may be unknown.')), 30000); })]); if (!current()) return;
   setNotice('Save completed. Refreshing status and audit history…');
   const next = await service.state(vendorId); if (current()) { setData(next); setNotice('Saved. Reloaded status and audit history are shown below.'); setReason(''); setUntil(''); setLegacy(false); setEnroll(false); }
  } catch (failure) { if (current()) { setError(`${failure.message} Reload status and audit history before retrying.`); setUncertain(true); } }
  finally { clearTimeout(timer); lock.current = false; if (current()) setBusy(false); }
 }
 const disabled = busy || loading || !online || uncertain;
 const reviewDisabled = disabled || reason.trim().length < 15;
 const action = (name, value = {}) => run(() => service.action(vendorId, name, { reason, expectedStatus: data.vendor.status, ...value }));
 return <div className="max-w-4xl mx-auto space-y-5 min-w-0">
  <header className="space-y-2"><h1 className="text-2xl font-semibold">Vendor compliance and approval</h1><p className="text-sm text-ink-soft">Evidence submission, independent verification, agreement acceptance and store activation are separate steps. No payment gateway or settlement setting changes here.</p></header>
  {!online && <p role="status" className="card p-4">You are offline. Reconnect to submit or review evidence. No actions are queued.</p>}
  {loading && <p role="status">Loading compliance status…</p>}{error && <p role="alert" className="card p-4">{error}</p>}{notice && <p role="status" className="card p-4">{notice}</p>}
  <button type="button" className="btn-secondary min-h-11" disabled={busy || !online || loading} onClick={() => void load()}>Reload compliance and audit history</button>
  {!loading && data && <>
   <section className="card p-4 sm:p-6 space-y-3"><h2 className="text-lg font-semibold">{data.vendor.name}</h2>
    <p>Store status: <strong>{data.vendor.status}</strong></p><p>Review stage: <strong>{data.workflow}</strong></p>
    {data.legacyException && <p role="status">New manual EFT/PayShap ordering requires strict agreement, compliance and banking review. An existing-vendor exception does not unlock these payment methods. Existing orders and records are retained.</p>}
    {data.legacyException && <p role="status" className="rounded-xl bg-nude-50 p-3">Existing-vendor transition exception: this vendor is not enrolled in strict B/C compliance checks. This is not proof of verification. Any exception approval needs an explicit acknowledgement and audit reason.</p>}
    {data.vendor.status === 'approved' && data.enrolled && !data.ready && <p role="alert">Verification is incomplete, expired or revoked. New orders are blocked; existing orders and records are retained.</p>}
    <ul className="space-y-1 text-sm">{Object.entries(complianceKinds).map(([kind, label]) => <li key={kind}>{label}: <strong>{complianceStatus(data.events[kind])}</strong>{data.events[kind]?.valid_until && ` · valid until ${new Date(data.events[kind].valid_until).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg' })}`}</li>)}
     <li>Bank verification: <strong>{complianceStatus(data.events.bank)}</strong></li><li>Vendor agreement: <strong>{data.assignmentValid === false ? 'revoked or unavailable' : data.accepted ? 'acceptance recorded' : 'awaiting acceptance'}</strong></li></ul>
   </section>
   {data.admin ? <>
    <section className="card p-4 sm:p-6 space-y-3"><h2 className="text-lg font-semibold">Independent review</h2>
     <p className="text-sm">Review actual identity, premises/activity, food approvals and operating readiness. A file upload is not verification. CoA applicability must be assessed for the actual activity; any non-applicability decision needs a documented legal basis.</p>
     <label className="block text-sm">Review reason / approval evidence<textarea className="input mt-1" value={reason} onChange={e => setReason(e.target.value)} minLength={15} maxLength={1000} disabled={disabled} /></label>
     <label className="block text-sm">Verification valid until (SAST)<input className="input mt-1" type="date" value={until} onChange={e => setUntil(e.target.value)} disabled={disabled} /></label>
     <p className="text-xs text-ink-muted">Reviewer and audit time come from your signed-in account and the server. Never approve your own vendor or a bank profile you submitted.</p>
     <button type="button" className="btn-outline min-h-11" disabled={reviewDisabled || !until} onClick={() => action('waive_coa', { validUntil: complianceExpiry(until) })}>Record justified CoA non-applicability</button>
    </section>
    <ComplianceAssignmentForm data={data} disabled={reviewDisabled} assign={value => action('assign', value)} />
   </> : <>
    <form className="card p-4 sm:p-6 space-y-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => service.uploadEvidence(form.get('kind'), form.get('note'), form.get('file'))); }}>
     <h2 className="text-lg font-semibold">Submit private compliance evidence</h2><p className="text-sm">PDF, JPEG or PNG, up to 5MB. Upload only necessary evidence. Your documents are private and submission does not grant selling privileges.</p>
     <label className="block text-sm">Evidence category<select aria-label="Evidence category" className="input mt-1" name="kind" required disabled={disabled}>{Object.entries(complianceKinds).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
     <label className="block text-sm">Document context / premises reference<textarea className="input mt-1" name="note" required minLength={5} maxLength={1000} disabled={disabled} /></label>
     <label className="block text-sm">Private evidence file<input className="mt-2 block max-w-full text-sm" name="file" type="file" accept="application/pdf,image/jpeg,image/png" required disabled={disabled} /></label>
     <button className="btn-primary min-h-11" disabled={disabled}>Submit evidence for review</button>
    </form>
    <form className="card p-4 sm:p-6 space-y-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); void run(() => service.submitBank(vendorId, Object.fromEntries(Object.keys(bankingFields).map(key => [key, String(form.get(key) || '')])), form.has('eft'), form.has('payshap'))); }}>
     <h2 className="text-lg font-semibold">Submit banking for independent verification</h2><p className="text-sm">Pending vendors may submit their own receiving details. Each change creates a pending version. Existing order instructions remain unchanged.</p>
     <div className="grid sm:grid-cols-2 gap-3">{Object.entries(bankingFields).map(([key, label]) => <label className="text-sm" key={key}>{label}<input className="input mt-1" name={key} autoComplete="off" maxLength={150} required={['accountHolder', 'bank'].includes(key)} disabled={disabled} /></label>)}</div>
     <label className="flex gap-3 text-sm py-2"><input type="checkbox" name="eft" disabled={disabled} />Account supports EFT</label><label className="flex gap-3 text-sm py-2"><input type="checkbox" name="payshap" disabled={disabled} />Registered ShapID supports PayShap</label>
     <button className="btn-secondary min-h-11" disabled={disabled}>Submit banking details</button>
    </form>
    <Link className="underline inline-block py-2" to="/vendor/agreement">Review your assigned agreement and saved acceptance</Link>
   </>}
   <section className="card p-4 sm:p-6 space-y-4"><h2 className="text-lg font-semibold">Compliance submissions</h2>
    {!data.submissions.length && <p>No private evidence submitted yet.</p>}
    {data.submissions.map(s => <details key={s.id} className="border-t border-line pt-3"><summary className="cursor-pointer py-2">{complianceKinds[s.kind]} · {complianceStatus(data.history.find(e => e.subject_id === s.id && e.kind === s.kind))} · {new Date(s.created_at).toLocaleString('en-ZA')}</summary><p className="text-sm break-words py-2">{s.note}</p><p className="text-xs text-ink-muted py-2">Immutable version {s.id}. Verification decisions and expiry appear in the audit history.</p><EvidenceAccess submission={s} />
     {!data.admin && <button type="button" className="btn-outline min-h-11 mt-2" disabled={disabled} onClick={() => run(() => service.finalize(s.id))}>Confirm uploaded evidence</button>}
     {data.admin && <div className="flex flex-wrap gap-2 mt-3">{['verify', 'reject', 'revoke'].map(verb => <button key={verb} type="button" className="btn-outline min-h-11" disabled={reviewDisabled || (verb === 'verify' && !until)} onClick={() => action(verb, { id: s.id, validUntil: verb === 'verify' ? complianceExpiry(until) : null })}>{verb === 'verify' ? 'Verify evidence' : verb === 'reject' ? 'Reject evidence' : 'Revoke evidence'}</button>)}</div>}
    </details>)}
   </section>
   <section className="card p-4 sm:p-6 space-y-3"><h2 className="text-lg font-semibold">Banking versions</h2>{!data.bankProfiles.length && <p>No receiving details submitted.</p>}
    {data.bankProfiles.map(bank => <details key={bank.id} className="border-t pt-3"><summary className="cursor-pointer py-2">Version {bank.id} · {bank.approved_at ? 'bank approval recorded' : 'pending independent approval'}</summary>
     <dl className="grid sm:grid-cols-2 gap-2 py-3 text-sm">{Object.entries(bankingFields).map(([key, label]) => <div key={key}><dt className="text-ink-muted">{label}</dt><dd className="break-all">{bank.destination[key] || 'Not provided'}</dd></div>)}</dl>
     {data.admin && <div className="flex flex-wrap gap-2"><button className="btn-outline min-h-11" disabled={reviewDisabled || !until} onClick={() => action('verify_bank', { id: bank.id, validUntil: complianceExpiry(until) })}>Independently verify banking</button><button className="btn-outline min-h-11" disabled={reviewDisabled} onClick={() => action('revoke_bank', { id: bank.id })}>Revoke banking version</button></div>}
    </details>)}
   </section>
   <section className="card p-4 sm:p-6 space-y-3"><h2 className="text-lg font-semibold">Assigned agreements</h2>{!data.assignments.length && <p>No approved vendor-specific assignment recorded.</p>}
    {data.assignments.map(a => <div key={a.id} className="border-t pt-3 text-sm"><p className="break-all">Assignment {a.id} · {a.change_basis} · effective {new Date(a.effective_at).toLocaleString('en-ZA')}</p><p className="break-words">Approval evidence: {a.approval_reference}</p><p>Status: {data.history.some(e => e.kind === 'assignment' && e.subject_id === a.id && e.status === 'revoked') ? 'revoked — replacement required' : 'assigned'}</p>{data.admin && <button className="btn-outline min-h-11 mt-2" disabled={reviewDisabled} onClick={() => action('revoke_assignment', { id: a.id })}>Revoke assignment</button>}</div>)}
   </section>
   {data.admin && <section className="card p-4 sm:p-6 space-y-4"><h2 className="text-lg font-semibold">Approval and restoration</h2>
    {data.legacyException && <><label className="flex gap-3 py-2 text-sm"><input type="checkbox" checked={legacy} onChange={e => setLegacy(e.target.checked)} disabled={disabled} />I explicitly acknowledge this existing-vendor transition exception.</label>
     <label className="flex gap-3 py-2 text-sm"><input type="checkbox" checked={enroll} onChange={e => setEnroll(e.target.checked)} disabled={disabled} />I understand strict enrollment blocks new orders until all prerequisites are verified.</label>
     <button className="btn-outline min-h-11" disabled={reviewDisabled || !enroll} onClick={() => action('enroll', { confirm: true })}>Enroll in strict compliance review</button></>}
    {data.enrolled && <button className="btn-secondary min-h-11" disabled={reviewDisabled} onClick={() => action('complete_review')}>Complete activation review</button>}
    {['pending', 'suspended'].includes(data.vendor.status) && <button className="btn-primary min-h-11" disabled={reviewDisabled || (data.legacyException ? !legacy : !data.ready)} onClick={() => action('activate', { legacyAcknowledged: legacy })}>{data.vendor.status === 'suspended' ? 'Restore vendor after review' : 'Approve vendor after review'}</button>}
    <div className="flex flex-wrap gap-2"><button className="btn-outline min-h-11" disabled={reviewDisabled} onClick={() => action('request_changes')}>Request updated documents — return to pending</button><button className="btn-outline min-h-11" disabled={reviewDisabled} onClick={() => action('suspend')}>Suspend vendor</button></div>
   </section>}
   <section className="card p-4 sm:p-6 space-y-3"><h2 className="text-lg font-semibold">Immutable audit history</h2>{!data.history.length && <p>No compliance decisions recorded.</p>}
    <ol className="space-y-3 text-sm">{data.history.map(e => <li key={e.id} className="border-t pt-3 break-words"><strong>{e.kind} · {e.status}</strong><p>Reviewer / actor: {e.actor_id} · {new Date(e.at).toLocaleString('en-ZA')}</p><p>{e.reason}</p>{e.valid_until && <p>Valid until: {new Date(e.valid_until).toLocaleString('en-ZA')}</p>}</li>)}</ol>
   </section>
  </>}
 </div>;
}
export default function VendorCompliancePanel({ vendorId }) {
 const { user } = useAuth();
 return <ComplianceContent key={`${user?.id}:${vendorId}`} actorId={user?.id} vendorId={vendorId} />;
}
