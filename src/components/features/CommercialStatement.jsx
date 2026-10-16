import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { commercialService } from '../../services/commercialService';
import { downloadCsv } from '../../utils/csv';
export default function CommercialStatement({ userId }) {
  const [from, setFrom] = useState('');const [to, setTo] = useState('');
  const { data, loading, error, refetch } = useAsync(()=>commercialService.report(from,to),[userId,from,to],null);
  const rows=data?.rows || [];const standard=data?.standardFees || [];
  return <section className="card p-4 space-y-3"><h2 className="font-semibold">Filtered commercial ledger (SAST)</h2>
    <div className="flex flex-wrap gap-3"><label>From<input className="block border rounded p-2" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input className="block border rounded p-2" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
    {loading && <p role="status">Loading financial ledger…</p>}
    {error && <p role="alert">{error.message} <button onClick={()=>refetch()}>Retry report</button></p>}
    {data && !loading && !error && <>
      <p>{data.totals.chargedOrders} charged orders · {data.totals.qualifyingOrders} remaining qualifying orders · {data.totals.uniquePayingCustomers} unique paying customers</p>
      <p>Acquisition fees R{Number(data.totals.acquisitionFees).toFixed(2)} − credits R{Number(data.totals.acquisitionCredits).toFixed(2)} = R{Number(data.totals.netAcquisitionFees).toFixed(2)}.</p>
      <p>Provider expenses and tax are unresolved in this report. This ledger is not a payable payout statement. Original standard fees are retained; standard refund/settlement reconciliation remains blocked.</p>
      <button className="btn-secondary" onClick={()=>downloadCsv('filtered-acquisition-ledger.csv',['Corporate','Agreement','Vendor','Order','Eligible at','Week SAST','Position','Subtotal','Rate','Fee','Refunded subtotal','Fee credit','Net fee','Disputed'],rows.map(r=>[r.corporate_name,r.agreement_id,r.vendor_id,r.order_id,r.eligible_at,r.week_start,r.position,r.eligible_subtotal,r.rate,r.amount,r.refunded_subtotal,r.acquisition_credit,r.acquisition_net,r.disputed]))}>Download filtered acquisition CSV</button>
      <button className="btn-secondary" onClick={()=>downloadCsv('standard-fee-components.csv',['Suborder','Acceptance','Gross product','Discount','Eligible net product','Platform','Internal processing','Combined','Delivery allocated','Net before acquisition/provider/tax','Tax treatment','Calculation version'],standard.map(r=>[r.suborder_id,r.acceptance_id,r.gross_product_subtotal,r.vendor_discount,r.eligible_net_subtotal,r.platform_amount,r.internal_processing_amount,r.combined_amount,r.delivery_allocated,r.net_before_acquisition_provider_tax,r.tax_treatment,r.calculation_version]))}>Download standard fee components CSV</button>
      <div className="overflow-x-auto"><table className="w-full text-sm"><caption>Weekly qualifying volume per agreement and vendor</caption><thead><tr><th>Week</th><th>Vendor</th><th>Agreement</th><th>Orders</th><th>Paying customers</th><th>Net acquisition fee</th></tr></thead><tbody>{data.weekly.map(w=><tr key={`${w.agreement_id}-${w.vendor_id}-${w.week_start}`}><td>{w.week_start}</td><td className="break-all">{w.vendor_id}</td><td className="break-all">{w.agreement_id}</td><td>{w.qualifying_orders}</td><td>{w.unique_paying_customers}</td><td>R{Number(w.net_acquisition_fee).toFixed(2)}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}
