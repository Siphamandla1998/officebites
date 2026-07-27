import { useState } from "react";
import { FiCheckCircle, FiCreditCard, FiXCircle } from "react-icons/fi";
import EmptyState from "../../components/ui/EmptyState";
import StatusBadge from "../../components/ui/StatusBadge";
import Modal from "../../components/ui/Modal";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { useToast } from "../../context/ToastContext";
import { formatCurrency, formatDate, formatRelativeTime } from "../../utils/formatters";

export default function AdminPayments() {
  const { showToast } = useToast();
  const { data: pending, loading, refetch } = useAsync(
    () => orderService.getOrdersPendingPaymentReview(),
    []
  );
  const [selected, setSelected] = useState(null);
  const [acting, setActing] = useState(false);

  const decide = async (order, approve) => {
    setActing(true);
    try {
      await orderService.verifyPayment(order.id, approve);
      showToast(
        approve ? `${order.ticketNumber} confirmed` : `${order.ticketNumber} rejected`,
        { type: approve ? "success" : "info" }
      );
      setSelected(null);
      refetch();
    } catch (err) {
      showToast(err.message || "Couldn't update payment status", { type: "error" });
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Payments</h1>
        <p className="text-sm text-ink-muted mt-0.5">
          Review uploaded proof of payment and confirm or reject each order. Confirming here is what
          moves an order from "payment submitted" to "confirmed" for the vendor.
        </p>
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : pending.length === 0 ? (
        <EmptyState
          icon={<FiCreditCard size={20} />}
          title="Nothing waiting on review"
          description="Orders will show up here as soon as a customer uploads proof of payment."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {pending.map((order) => (
            <button
              key={order.id}
              onClick={() => setSelected(order)}
              className="card p-4 text-left flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-ink-muted">{order.ticketNumber}</p>
                  <p className="text-sm font-semibold text-ink mt-0.5">{order.customerName}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              {order.paymentProof && (
                <img
                  src={order.paymentProof}
                  alt="Proof of payment"
                  className="h-28 w-full object-cover rounded-xl"
                />
              )}
              <div className="flex items-center justify-between pt-2 border-t border-line">
                <span className="text-xs text-ink-muted">{formatRelativeTime(order.createdAt)}</span>
                <span className="text-sm font-semibold text-ink">{formatCurrency(order.total)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => !acting && setSelected(null)}
        title={selected?.ticketNumber}
        footer={
          selected && (
            <div className="flex gap-2.5">
              <button
                onClick={() => decide(selected, false)}
                className="btn-outline flex-1 !text-danger !border-danger/30"
                disabled={acting}
              >
                <FiXCircle size={15} /> Reject
              </button>
              <button onClick={() => decide(selected, true)} className="btn-primary flex-1" disabled={acting}>
                <FiCheckCircle size={15} /> Confirm order
              </button>
            </div>
          )
        }
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-ink-muted">Customer</p>
                <p className="font-medium text-ink">{selected.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Delivery date</p>
                <p className="font-medium text-ink">{formatDate(selected.deliveryDate)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Total</p>
                <p className="font-medium text-ink">{formatCurrency(selected.total)}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Vendors</p>
                <p className="font-medium text-ink">{selected.subOrders.map((s) => s.vendorName).join(", ")}</p>
              </div>
            </div>
            {selected.paymentProof ? (
              <img src={selected.paymentProof} alt="Proof of payment" className="w-full rounded-xl object-cover" />
            ) : (
              <p className="text-sm text-ink-muted">No proof of payment attached.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
