import RequestError from '../../components/ui/RequestError';
import CheckoutControls from '../../components/features/CheckoutControls';
import { FiCreditCard } from "react-icons/fi";
import EmptyState from "../../components/ui/EmptyState";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import {
  formatCurrency,
  formatDate,
} from "../../utils/formatters";

export default function AdminPayments() {
  const {
    data: payments = [],
    loading, error, refetch,
  } = useAsync(
    () => orderService.getRecentPayments(20),
    []
  );

  return (
    <div className="flex flex-col gap-6">
      <CheckoutControls />
      <div>
        <h1 className="text-xl font-bold text-ink">
          Payments
        </h1>

        <p className="text-sm text-ink-muted mt-0.5">
          Provider payments are confirmed after secure server-side verification.
          Paid is a payment status, separate from vendor acceptance and fulfilment.
        </p>
      </div>

      {error ? <RequestError error={error} onRetry={refetch} /> : loading ? (
        <div className="skeleton h-64" />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<FiCreditCard size={20} />}
          title="No confirmed payments yet"
          description="Reconciled provider payments will appear here automatically. Unresolved sales remain in financial reports."
        />
      ) : (
        <div className="card overflow-hidden">
          {payments.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between gap-4 px-4 py-3 border-b border-line last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {order.ticketNumber}
                </p>

                <p className="text-xs text-ink-muted truncate">
                  {order.customerName} ·{" "}
                  {formatDate(order.financialDate)}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge
                  status={order.status}
                />

                <span className="text-sm font-semibold text-ink">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
