import { FiCreditCard } from "react-icons/fi";
import EmptyState from "../../components/ui/EmptyState";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import {
  formatCurrency,
  formatRelativeTime,
} from "../../utils/formatters";

export default function AdminPayments() {
  const {
    data: payments = [],
    loading,
  } = useAsync(
    () => orderService.getRecentPayments(20),
    []
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">
          Payments
        </h1>

        <p className="text-sm text-ink-muted mt-0.5">
          PayFast payments are confirmed automatically
          after secure server-side verification.
        </p>
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<FiCreditCard size={20} />}
          title="No confirmed payments yet"
          description="Successfully verified PayFast payments will appear here automatically."
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
                  {formatRelativeTime(
                    order.createdAt
                  )}
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