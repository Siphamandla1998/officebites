import { useEffect, useRef, useState } from 'react';
import ManualSettingsForm from './ManualSettingsForm';
import AdminPaymentProfileForm from './AdminPaymentProfileForm';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useRequestGuard } from '../../hooks/useRequestGuard';
import { manualPaymentService as service } from '../../services/manualPaymentService';
import { downloadCsv } from '../../utils/csv';
import { formatCurrency } from '../../utils/formatters';
import { periodDates, sastDateKey } from '../../utils/reportingDates';
import RequestError from '../ui/RequestError';
import VendorPaymentProfileForm from './VendorPaymentProfileForm';

const fields = { accountHolder: 'Account holder', bank: 'Bank', accountNumber: 'Account number', accountType: 'Account type', branchCode: 'Branch code', shapId: 'Registered ShapID' };
const balance = r => (Math.round(Number(r.commission)*100)-Math.round(Number(r.credits)*100)-Math.round(Number(r.collected)*100))/100;

export default function ManualPaymentWorkspace({ admin = false, profiles = false }) {
  const { user } = useAuth();
  const [testOnly, setTestOnly] = useState(false);
  const result = useAsync(() => service.workspace(testOnly), [user?.id, user?.vendorId, testOnly], null);
  const guard = useRequestGuard(user?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [statementFrom, setStatementFrom] = useState('');
  const [statementTo, setStatementTo] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    lock.current = false; setBusy(false); setError(null); setMessage('');
  }, [user?.id, user?.vendorId]);
  async function run(fn) {
    if (lock.current) return;
    const current = guard.capture();const operation = Symbol();lock.current = operation;setBusy(true);setError(null);setMessage('');
    try { const state = await fn();if (current()) { await result.refetch({ throwOnError: true });setMessage(state === 'under_review' ? 'Payment remains unpaid and requires admin review.' : 'Saved and reloaded.'); } }
    catch (failure) { if (current()) setError(failure); }
    finally { if (lock.current === operation) { lock.current = false;if (current()) setBusy(false); } }
  }
  const data = result.data;
  const rows = (data?.receivables || []).filter(r => (!statementFrom || sastDateKey(r.created_at)>=statementFrom) && (!statementTo || sastDateKey(r.created_at)<=statementTo));
  const exportBlocked = result.loading || !!result.error || !!error || busy || !rows.length;
  const exportRows = () => {
    if (exportBlocked) return;
    downloadCsv(testOnly ? 'synthetic-vendor-direct-statement.csv' : 'vendor-direct-statement.csv', ['Data scope','Order','Vendor','Verified date','Vendor-direct gross (ZAR)','Commission receivable (ZAR)','Refunds (ZAR)','Commission credits (ZAR)','Commission collected (ZAR)','Balance (ZAR)'], rows.map(r => [testOnly ? 'synthetic' : 'operational',r.reference,r.vendor_id,r.created_at,r.gross,r.commission,r.refunds,r.credits,r.collected,balance(r).toFixed(2)]));
  };
  return <section className="card p-4 flex flex-col gap-4">
    <h2 className="section-title">Vendor-direct payments</h2>
    {!profiles && <label><input type="checkbox" checked={testOnly} disabled={busy} onChange={event => setTestOnly(event.target.checked)} /> Show synthetic test orders only</label>}
    {testOnly && <p role="status">Test orders only. These figures are excluded from normal statements and operational revenue.</p>}
    <RequestError error={error || result.error} onRetry={result.refetch} />
    {profiles && !admin && <VendorPaymentProfileForm vendorId={user?.vendorId} onSaved={() => result.refetch({ throwOnError: true })} />}
    {message && <p role="status">{message}</p>}
    {result.loading && <p>Loading payment workspace…</p>}
    {admin && <AdminPaymentProfileForm key={`banking:${user?.id}`} userId={user?.id} fields={fields} busy={busy} submit={(vendor, destination, eft, payshap) => run(() => service.submit(vendor, destination, eft, payshap))} />}
    {admin && !data && result.error && <p role="alert">The admin payment workspace could not load. Banking submissions can be attempted above, but existing profiles and approval actions cannot be safely verified until this read succeeds. Use Retry before approving or resubmitting anything.</p>}
    {data && <>
      {admin && data.settings && <ManualSettingsForm key={user?.id} settings={data.settings} loading={result.loading} loadError={result.error} reload={result.refetch} onBusyChange={setBusy} />}
      {admin && !data.settings && <p role="alert">Admin settings were not returned by the backend. Saving is intentionally unavailable until the settings RPC contract is repaired; do not try to bypass this safeguard.</p>}
      {(profiles || admin) && <details><summary className="font-semibold cursor-pointer">Payment profile versions ({(data.profiles || []).length})</summary>
        {!(data.profiles || []).length && <p>No vendor banking profiles were returned. If a vendor says they submitted details, do not ask them to resubmit yet; check the submission RPC and audit records first.</p>}
        {data.profiles.map(p => <div className="border-t py-3 flex flex-col gap-2" key={p.id}>
          <p>Vendor {p.vendor_id} · Version {p.id} · {p.approved_at ? 'Approved' : 'Pending verification'} · {new Date(p.created_at).toLocaleString()}</p>
          <dl>{Object.entries(fields).map(([key,label]) => <div key={key}><dt className="text-xs">{label}</dt><dd className="break-all">{p.destination[key] || '—'}</dd></div>)}</dl>
          {admin && !p.approved_at && <form onSubmit={event => { event.preventDefault();const f = new FormData(event.currentTarget);void run(() => service.approve(p.id,String(f.get('evidence')))); }}>
            <p>Single-admin approval is permitted for the current OfficeBites setup. Record how you verified the bank-account owner, recipient name and EFT receiving capability. Do not enable PayShap unless the registered ShapID is separately verified.</p>
            <label>Bank ownership, recipient and EFT receiving-capability verification evidence<textarea className="input" name="evidence" required minLength={15} maxLength={1000} placeholder="e.g. I checked the account holder and bank details against the vendor-provided bank confirmation." /></label>
            <button className="btn-outline" disabled={busy}>Approve verified profile</button>
          </form>}
        </div>)}
      </details>}
      {!profiles && <>
        <h3 className="font-semibold">Payment verification queue</h3>
        <p>Check your bank account independently before confirming receipt. Customer reports and proof of payment are not confirmation. Flag incorrect amounts, duplicate payments, outdated recipients and suspicious transactions for support review.</p>
        {data.payments.map(p => <article key={p.orderId} className="border-t pt-3 flex flex-col gap-2">
          <p className="font-semibold">{p.reference} · {formatCurrency(p.amount)} · {p.method === 'manual_payshap' ? 'PayShap' : 'EFT'}</p>
          <p>{p.state.replaceAll('_',' ')} · Order {p.orderStatus} · Deadline {new Date(p.deadline).toLocaleString()} · Reported {p.reportedAt ? new Date(p.reportedAt).toLocaleString() : 'not yet'}</p>
          {p.reviewRequired && <p>Additional admin review required.</p>}
          {p.state !== 'paid' && <form className="flex flex-col gap-2" onSubmit={event => { event.preventDefault();const f = new FormData(event.currentTarget);void run(() => service.verify(p.orderId,f.get('amount'),String(f.get('reference')),f.has('suspicious'))); }}>
            <label>Amount independently received (ZAR)<input className="input" name="amount" type="number" min="0.01" step="0.01" required /></label>
            <label>Bank transaction reference<input className="input" name="reference" minLength={3} maxLength={200} required /></label>
            <label><input type="checkbox" name="suspicious" /> Suspicious or unmatched payment</label>
            <button className="btn-primary" disabled={busy}>Confirm bank receipt / submit for review</button>
          </form>}
          {p.verifiedAt && <p>Verified {new Date(p.verifiedAt).toLocaleString()} by {p.verifiedBy} · {formatCurrency(p.verifiedAmount)}</p>}
          <form onSubmit={event => { event.preventDefault();const f = new FormData(event.currentTarget);void run(() => service.flag(p.orderId,String(f.get('reason')))); }}>
            <label>Dispute / refund review reason<textarea className="input" name="reason" required minLength={10} maxLength={1000} /></label>
            <button className="btn-outline" disabled={busy}>Flag for support review</button>
          </form>
          {admin && p.reviewRequired && <form onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget);void run(()=>service.resolveDispute(p.orderId,String(f.get('evidence'))));}}>
            <label>Independent dispute-resolution evidence<textarea className="input" name="evidence" required minLength={15} maxLength={1000} /></label>
            <button className="btn-outline" disabled={busy}>Resolve dispute hold (does not confirm receipt)</button>
          </form>}
          <details><summary className="font-semibold cursor-pointer">Vendor refund workflow</summary>
            <p>Send refunds through the vendor’s bank after independently checking the recipient. Record supporting evidence here; this form does not send money. Completion requires admin reconciliation.</p>
            <form className="flex flex-col gap-2" onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget);void run(()=>service.refund(p.orderId,String(f.get('status')),f.get('amount'),f.get('productRefund'),String(f.get('evidence'))));}}>
              <label>Refund status<select className="input" name="status"><option value="requested">Requested</option><option value="vendor_processing">Vendor processing</option>{admin && <><option value="completed">Completed with bank evidence</option><option value="declined">Declined after review</option></>}</select></label>
              <label>Refund amount (required for completion)<input className="input" type="number" name="amount" min="0.01" step="0.01" /></label>
              <label>Product portion (zero for delivery-only refund)<input className="input" type="number" name="productRefund" min="0" step="0.01" defaultValue="0" required /></label>
              <label>Refund request / bank evidence<textarea className="input" name="evidence" minLength={15} maxLength={1000} required /></label>
              <button className="btn-outline" disabled={busy}>Record refund status</button>
            </form>
          </details>
          {admin && p.state === 'paid' && p.orderStatus !== 'completed' && <form onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget);void run(()=>service.cancelRefunded(p.orderId,String(f.get('reason'))));}}>
            <label>Reviewed cancellation reason (full vendor refund must be reconciled)<textarea className="input" name="reason" required minLength={15} maxLength={1000} /></label>
            <button className="btn-outline" disabled={busy}>Cancel fully refunded order</button>
          </form>}
        </article>)}
        <h3 className="font-semibold">Commission receivables and statements</h3>
        <p>Food payments are received by vendors. Commission is owed to OfficeBites separately; collected commission is recorded only with bank evidence. {testOnly ? 'This view contains synthetic test statements only.' : 'Test orders are excluded.'} Marketing fees and VAT are not added here.</p>
        <div className="flex flex-wrap gap-3">
          <label>Statement from (SAST)<input className="input" type="date" value={statementFrom} onChange={e=>setStatementFrom(e.target.value)} /></label>
          <label>Statement to (SAST)<input className="input" type="date" value={statementTo} onChange={e=>setStatementTo(e.target.value)} /></label>
          <button className="btn-outline" onClick={()=>{const range=periodDates('week');setStatementFrom(range.from);setStatementTo(range.to);}}>This week</button>
          <button className="btn-outline" onClick={()=>{setStatementFrom('');setStatementTo('');}}>All dates</button>
        </div>
        <p>Vendor-direct sales: {formatCurrency(rows.reduce((n,r)=>n+Number(r.gross),0))} · Commission receivable before credits: {formatCurrency(rows.reduce((n,r)=>n+Number(r.commission),0))} · Commission collected: {formatCurrency(rows.reduce((n,r)=>n+Number(r.collected),0))}. Collected commission is cash received by OfficeBites; it is separate from vendor sales. Accounting revenue and tax recognition require the agreed policy.</p>
        <button className="btn-outline" disabled={exportBlocked} onClick={exportRows}>Export commission statement CSV</button>
        {rows.map(r => <div key={r.order_id} className="border-t pt-3 flex flex-col gap-2">
          <p>{r.reference} · Vendor-direct gross {formatCurrency(r.gross)} · Commission {formatCurrency(r.commission)} · Credits {formatCurrency(r.credits)} · Collected {formatCurrency(r.collected)} · Balance {formatCurrency(balance(r))}</p>
          {admin && <form className="flex flex-col gap-2" onSubmit={event => { event.preventDefault();const f = new FormData(event.currentTarget);void run(() => service.entry(r.order_id,String(f.get('kind')),f.get('amount'),String(f.get('evidence')),f.get('productRefund'))); }}>
            <label>Reconciliation type<select className="input" name="kind"><option value="collection">Commission received by OfficeBites</option><option value="commission_return">Commission returned to vendor with bank evidence</option></select></label>
            <label>Amount (ZAR)<input className="input" name="amount" type="number" min="0.01" step="0.01" required /></label>
            <label>Product part of refund (ZAR; zero for commission collections)<input className="input" name="productRefund" type="number" min="0" step="0.01" defaultValue="0" required /></label>
            <label>Unique bank evidence / invoice reference<textarea className="input" name="evidence" required minLength={10} maxLength={1000} /></label>
            <button className="btn-outline" disabled={busy}>Record reconciliation evidence</button>
          </form>}
        </div>)}
      </>}
      <details><summary className="font-semibold cursor-pointer">Payment audit history</summary>{data.events.map(e => <p className="border-t py-2 break-words" key={e.id}>{new Date(e.created_at).toLocaleString()} · {e.action} · {e.actor_id || 'Customer capability'} · {e.note}</p>)}</details>
      <button className="btn-outline" disabled={busy} onClick={() => result.refetch()}>Refresh payment workspace</button>
    </>}
  </section>;
}
