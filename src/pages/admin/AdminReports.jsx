import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { financialService, financialRpc } from '../../services/financialService';
import { downloadCsv } from '../../utils/csv';
import { periodDates, sastDateKey } from '../../utils/reportingDates';
import { formatCurrency } from '../../utils/formatters';
import RequestError from '../../components/ui/RequestError';
import PayoutLedger from '../../components/features/PayoutLedger';

const AUDIT_ORDER = 'ce050a2e-a430-4019-9a02-ce4c7664f485';
export default function AdminReports() {
  const [from, setFrom] = useState(periodDates('month').from);
  const [to, setTo] = useState(sastDateKey());
  const report = useAsync(() => financialService.report({ from, to }), [from, to], null);
  const payouts = useAsync(() => financialService.payouts(), [], null);
  const [preview, setPreview] = useState(null);
  const [retention, setRetention] = useState(null);
  const [days, setDays] = useState(30);
  const [schedule, setSchedule] = useState('0 0 * * *');
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  async function action(fn) {
    setBusy(true); setFailure(null);
    try { await fn(); } catch (e) { setFailure(e); } finally { setBusy(false); }
  }
  function exportSales() {
    const rows = report.data.rows.map(r => [r.financial_date,r.date_basis,r.order_id,r.ticket_number,r.suborder_id,r.vendor_id,r.vendor_name,r.status,r.gross,r.commission_rate ?? 'Unresolved',r.commission ?? 'Unresolved',r.processor_fee,r.vendor_earnings ?? 'Unresolved',report.data.feePolicy || 'Undecided']);
    const t = report.data.totals;
    rows.push(['TOTAL','','','','','','','',t.gmv,'',t.grossCommission ?? 'Unresolved',t.processorFees,t.vendorEarnings ?? 'Unresolved','']);
    downloadCsv(`officebites-sales-${from || 'all'}-${to || 'all'}.csv`, ['SAST financial date','Date basis','Order ID','Ticket','Suborder ID','Vendor ID','Vendor','Status','Gross sales ZAR','Commission rate','Commission ZAR','Processor fees ZAR','Vendor earnings before fees ZAR','Fee policy'], rows);
  }
  function exportPayouts() {
    const rows = payouts.data.payouts.filter(p => (!from || sastDateKey(p.created_at) >= from) && (!to || sastDateKey(p.created_at) <= to));
    const cells = rows.map(p => [p.id,p.vendor_id,sastDateKey(p.created_at),p.status,p.fee_policy,p.amount,p.reference || '',p.reconciled_at || '']);
    for (const status of ['allocated','paid','void']) cells.push([`TOTAL ${status}`,'','','','',rows.filter(p => p.status === status).reduce((s,p) => s + Number(p.amount),0),'','']);
    downloadCsv('officebites-payouts.csv', ['Payout ID','Vendor ID','SAST reservation date','Status','Fee policy','Amount ZAR','External reference or void reason','Reconciled timestamp'],cells);
  }
  function exportReconciliation() {
    downloadCsv('officebites-order-reconciliation.csv',['Order ID','Ticket','Recorded order total ZAR','All suborders gross ZAR','Eligible business gross ZAR','Recorded COMPLETE receipts ZAR','COMPLETE receipt count','Order minus suborders ZAR'],report.data.reconciliation.map(r => [r.order_id,r.ticket_number,r.recordedOrderTotal,r.allSuborderGross,r.eligibleBusinessGross,r.recordedCompletePayments,r.completePaymentCount,r.orderAmountDifference]));
  }
  const t = report.data?.totals;
  return <div className="flex flex-col gap-6">
    <h1 className="text-xl font-bold">Reports and reconciliation</h1>
    <p>Paid business sales only. Dates are inclusive South African calendar dates. Historical rates remain unresolved until supported by evidence. Downloads contain the selected financial period; payout filters use reservation dates.</p>
    <div className="flex gap-3 flex-wrap"><label>From <input aria-label="Report from date" type="date" value={from || ''} onChange={e => setFrom(e.target.value)} /></label><label>To <input aria-label="Report to date" type="date" value={to || ''} onChange={e => setTo(e.target.value)} /></label><button onClick={() => { setFrom(''); setTo(''); }}>All time</button></div>
    {report.error ? <RequestError error={report.error} onRetry={report.refetch} /> : report.loading ? <div className="skeleton h-32" /> : t && <section className="card p-5">
      <p>Gross sales: {formatCurrency(t.gmv)} · Commission: {formatCurrency(t.grossCommission)} · Processor fees: {formatCurrency(t.processorFees)} · Vendor earnings before fees: {formatCurrency(t.vendorEarnings)} · Marketplace revenue after fee policy: {formatCurrency(t.netMarketplaceRevenue)}</p>
      <p>{t.paidOrders} paid orders · {t.unresolvedCommission} unresolved commission snapshots.</p>
      <p>Gross minus commission minus vendor earnings: {t.grossCommission == null ? 'Unresolved' : formatCurrency(Number(t.gmv)-Number(t.grossCommission)-Number(t.vendorEarnings))}.</p>
      {!report.data.rows.length && <p>No eligible paid business sales in this period.</p>}
      <button className="btn-primary mt-3" onClick={exportSales}>Download sales and commissions CSV</button>
      <button className="btn-secondary mt-3" onClick={exportReconciliation}>Download order/payment reconciliation CSV</button>
      <p>{report.data.reconciliation.filter(r => Number(r.orderAmountDifference) !== 0 || Number(r.completePaymentCount) !== 1).length} orders need amount or receipt review. Imported/manual historical receipts may be absent. Multiple COMPLETE receipts require checking duplicate payments outside this ledger; no refunds are assumed.</p>
    </section>}
    {payouts.error ? <RequestError error={payouts.error} onRetry={payouts.refetch} /> : <button className="btn-secondary" disabled={payouts.loading || !payouts.data} onClick={exportPayouts}>Download payout reconciliation CSV</button>}
    <PayoutLedger admin />
    {failure && <RequestError error={failure} onRetry={() => setFailure(null)} />}
    <section className="card p-5"><h2 className="section-title">OB-57C1D4 review</h2><p>Preview only. Actual classification remains pending your review; no other order is inferred to be a test.</p><button disabled={busy} onClick={() => action(async () => setPreview(await financialService.previewTestOrder(AUDIT_ORDER)))}>Preview exact order and reporting impact</button>{preview && <><p>Gross sales before {formatCurrency(preview.before.gmv)}; after exclusion {formatCurrency(preview.after.gmv)}. Commission before {formatCurrency(preview.before.grossCommission)}; after {formatCurrency(preview.after.grossCommission)}. Fees before {formatCurrency(preview.before.processorFees)}; after {formatCurrency(preview.after.processorFees)}.</p><pre className="overflow-auto text-xs">{JSON.stringify(preview,null,2)}</pre></>}</section>
    <section className="card p-5"><h2 className="section-title">Conversation retention dry run</h2><label>Retention days <input type="number" min="1" max="3650" value={days} onChange={e => setDays(Number(e.target.value))} /></label><label>UTC cron schedule <input value={schedule} onChange={e => setSchedule(e.target.value)} /></label><button disabled={busy} onClick={() => action(async () => { await financialRpc('admin_configure_retention',{p_days:days,p_schedule:schedule}); setRetention(await financialRpc('admin_preview_retention')); })}>Save configuration with purge disabled</button><button disabled={busy} onClick={() => action(async () => setRetention(await financialRpc('admin_preview_retention')))}>Preview retained conversations</button>{retention && <pre className="overflow-auto text-xs">{JSON.stringify(retention,null,2)}</pre>}</section>
  </div>;
}
