import { useFinancialRevision } from '../../hooks/useFinancialRevision';
import { useRef, useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { financialService } from '../../services/financialService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import RequestError from '../ui/RequestError';

export default function PayoutLedger({ vendorId = null, admin = false }) {
  const revision = useFinancialRevision();
  const { data, loading, error, refetch } = useAsync(() => financialService.payouts(vendorId), [vendorId, revision], null);
  const [policy, setPolicy] = useState('platform_absorbs');
  const [reason, setReason] = useState('');
  const [references, setReferences] = useState({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const requests = useRef(new Map());
  async function act(fn) {
    setBusy(true); setFailure(null);
    try { await fn(); await refetch(); } catch (e) { setFailure(e); } finally { setBusy(false); }
  }
  if (error) return <RequestError error={error} onRetry={refetch} />;
  if (loading || !data) return <div className="skeleton h-32" />;
  const groups = data.eligible.reduce((groups, row) => { (groups[row.vendor_id] ||= []).push(row); return groups; }, {});
  return <section className="card p-5 flex flex-col gap-4">
    <h2 className="section-title">Payout ledger</h2>
    <p className="text-sm">{data.settlementRule} Fee policy: {data.policy || 'Awaiting business decision; payable balances unavailable'}.</p>
    {failure && <RequestError error={failure} onRetry={() => { setFailure(null); refetch(); }} />}
    {admin && <div className="flex flex-wrap gap-2">
      <select aria-label="Processor fee allocation policy" value={policy} onChange={e => setPolicy(e.target.value)}><option value="platform_absorbs">Platform absorbs processor fees</option><option value="vendor_proportional">Vendors pay proportional fees</option></select>
      <input aria-label="Fee policy decision reason" placeholder="Decision reason (10+ characters)" value={reason} onChange={e => setReason(e.target.value)} />
      <button className="btn-secondary" disabled={busy || reason.trim().length < 10} onClick={() => act(() => financialService.setFeePolicy(policy, reason))}>Record fee policy</button>
    </div>}
    {Object.entries(groups).map(([id, rows]) => <div key={id} className="border-t pt-3">
      <p>{id}: {rows.length} completed, unallocated suborders; payable {formatCurrency(rows.some(r => r.payable == null) ? null : rows.reduce((s, r) => s + Number(r.payable), 0))}</p>
      {admin && <button className="btn-secondary" disabled={busy || !data.policy || rows.some(r => r.payable == null || Number(r.payable) < 0)} onClick={() => act(async () => {
        if (data.payouts.some(p => p.request_id === requests.current.get(id))) requests.current.delete(id);
        if (!requests.current.has(id)) requests.current.set(id, crypto.randomUUID());
        await financialService.allocate(id, rows.map(r => r.suborder_id), requests.current.get(id));
        requests.current.delete(id);
      })}>Reserve payout (no bank transfer)</button>}
    </div>)}
    {!data.eligible.length && <p>No completed unallocated business sales.</p>}
    {data.payouts.map(p => <div key={p.id} className="border-t pt-3">
      <p>{formatDate(p.created_at)} · {p.status} · {formatCurrency(p.amount)} · {p.reference || 'Not externally reconciled'}</p>
      {admin && p.status === 'allocated' && <div className="flex flex-wrap gap-2"><input aria-label={`External transfer reference or void reason for ${p.id}`} value={references[p.id] || ''} onChange={e => setReferences({ ...references, [p.id]: e.target.value })} />
        <button disabled={busy || (references[p.id] || '').trim().length < 5} onClick={() => act(() => financialService.reconcile(p.id, 'paid', references[p.id]))}>Record completed external transfer</button>
        <button disabled={busy || (references[p.id] || '').trim().length < 5} onClick={() => act(() => financialService.reconcile(p.id, 'void', references[p.id]))}>Void reservation</button>
      </div>}
    </div>)}
    {!data.payouts.length && <p>No payout batches recorded.</p>}
  </section>;
}
