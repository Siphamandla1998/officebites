import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useOperationalRefresh } from '../../hooks/useOperationalRefresh';
import { manualPaymentService } from '../../services/manualPaymentService';
import RequestError from '../ui/RequestError';
const labels = {awaiting_payment:'Awaiting payment',payment_reported:'Payment reported — awaiting verification',under_review:'Payment under verification',paid:'Payment confirmed',expired:'Payment expired — contact support if already paid',disputed:'Payment disputed — contact support',cancelled:'Order cancelled — contact support if already paid'};
export default function ManualPaymentStatus({ orderId }) {
  const { user } = useAuth();
  const result = useAsync(() => manualPaymentService.instructions(orderId), [orderId,user?.id], null);
  useOperationalRefresh(() => result.refetch({ silent: true }),`manual-state:${orderId}:${user?.id}`,15000);
  return <section className="card p-4"><RequestError error={result.error} onRetry={result.refetch} /><p role="status">{result.data ? result.data.disputed ? 'Payment disputed — fulfilment on hold pending admin review' : labels[result.data.state] || 'Payment needs review' : 'Payment status requires protected access. Use the payment screen or contact support.'}</p>{result.data?.refundStatus && <p>Vendor refund: {result.data.refundStatus.replaceAll('_',' ')}</p>}</section>;
}
