import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { financialService } from '../../services/financialService';
import { formatCurrency } from '../../utils/formatters';
import RequestError from '../../components/ui/RequestError';
import PayoutLedger from '../../components/features/PayoutLedger';
export default function VendorRevenue() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useAsync(() => financialService.report({ vendorId: user.vendorId, period: 'month' }), [user.id,user.vendorId], null);
  return <div className="flex flex-col gap-6"><h1 className="text-xl font-bold">Revenue</h1><p>This South African calendar month. Paid business sales; commission uses historical snapshots, including 0% overrides.</p>
    {error ? <RequestError error={error} onRetry={refetch} /> : loading || !data ? <div className="skeleton h-32" /> : <section className="card p-5"><p>Gross sales: {formatCurrency(data.totals.gmv)}</p><p>Commission: {formatCurrency(data.totals.grossCommission)}</p><p>Allocated processor fees: {formatCurrency(data.totals.processorFees)}</p><p>Vendor earnings before processor-fee policy: {formatCurrency(data.totals.vendorEarnings)}</p><p>{data.totals.unresolvedCommission} historical commissions need evidence. Fee policy: {data.feePolicy || 'Awaiting business decision'}.</p></section>}
    <PayoutLedger vendorId={user.vendorId} />
  </div>;
}
