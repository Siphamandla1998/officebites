import RequestError from '../../components/ui/RequestError';
import { useAuth } from '../../context/AuthContext';
import { useRequestGuard } from '../../hooks/useRequestGuard';
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiCreditCard } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import Spinner from "../../components/ui/Spinner";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { paymentService } from "../../services/paymentService";
import { useToast } from "../../context/ToastContext";
import { formatCurrency } from "../../utils/formatters";
import { ORDER_STATUS } from "../../utils/constants";
import { getGuestOrderAccess } from "../../utils/guest";

export default function PaymentUpload() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const guard = useRequestGuard(`${user?.id || 'guest'}:${orderId}`);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [payfastLoading, setPayfastLoading] = useState(false);

  const { data: order, loading, error, refetch } = useAsync(
    () => orderService.getOrderById(orderId),
    [orderId, user?.id], null
  );

  useEffect(() => {
    setPayfastLoading(false);
    const refresh = () => { guard.invalidate(); setPayfastLoading(false); void refetch({ silent: true }); };
    window.addEventListener('pageshow', refresh);
    return () => window.removeEventListener('pageshow', refresh);
  }, [orderId, user?.id, refetch, guard]);

  const handlePayfast = async () => {
    if (payfastLoading) return;
    const current = guard.begin();
    setPayfastLoading(true);

    try {
      const fresh = await refetch({ silent: true, throwOnError: true });
      if (!current()) return;
      if (!fresh?.id) throw new Error("Could not check this order. Please try again.");
      if (fresh.status !== ORDER_STATUS.PENDING_PAYMENT) {
        setPayfastLoading(false);
        showToast("This order is no longer awaiting payment.", { type: "info" });
        navigate(`/orders/${orderId}`, { replace: true });
        return;
      }
      const guestAccess = getGuestOrderAccess(orderId);
      if (!fresh.customerId && !guestAccess?.contact) {
        throw new Error("Verify your order code and phone number on Track Order before retrying payment.");
      }

      const { processUrl, fields } =
        await paymentService.initiatePayfastPayment(
          orderId,
          guestAccess?.contact || null
        );

      if (!current()) return;
      paymentService.redirectToPayfast({ processUrl, fields });
    } catch (err) {
      if (!current()) return;
      showToast(
        err.message || "Couldn't start PayFast payment",
        { type: "error" }
      );
      setPayfastLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <Navbar showBack title="Payment" showCart={false} />
        <div className="ob-container pt-4">
          <div className="skeleton h-48" />
        </div>
      </div>
    );
  }

  if (error || !order?.id) {
    return (
      <div>
        <Navbar showBack title="Payment" showCart={false} />
        <p role="alert" className="ob-container pt-4 text-sm text-ink-muted">
          Could not load this order. Please refresh or open it from your order history.
        </p>
        <RequestError error={error || new Error("Order unavailable")} onRetry={refetch} />
      </div>
    );
  }

  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) {
    return (
      <div>
        <Navbar showBack title="Payment" showCart={false} />
        <div className="ob-container pt-4 flex flex-col gap-3">
          <p className="text-sm text-ink-muted">This order is no longer awaiting payment.</p>
          <button onClick={() => navigate(`/orders/${orderId}`)} className="btn-primary">View order status</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <Navbar showBack title="Payment" showCart={false} />

      <div className="ob-container pt-4 flex flex-col gap-5">
        <div className="flex justify-between pt-1 pb-1">
          <span className="text-sm font-semibold text-ink">
            Amount due
          </span>

          <span className="text-base font-bold text-ink">
            {formatCurrency(order.total)}
          </span>
        </div>

        <div className="card p-4 flex flex-col gap-3">
          <div className="h-9 w-9 rounded-lg bg-nude-100 text-nude-700 flex items-center justify-center">
            <FiCreditCard size={16} />
          </div>

          <div>
            <p className="text-sm font-semibold text-ink">
              Pay securely with PayFast
            </p>

            <p className="text-xs text-ink-muted mt-1">
              You'll be redirected to PayFast to complete your payment.
              OfficeBites will confirm your order automatically after
              PayFast verifies the transaction.
            </p>
          </div>

          <div className="rounded-xl bg-nude-50 px-3.5 py-3">
            <p className="text-xs text-ink-muted">
              This payment is for your existing order {order.ticketNumber}.
              If your bank already shows a debit, wait for confirmation or contact
              support before making another payment.
            </p>
          </div>

          <button
            onClick={() => navigate(`/orders/${orderId}`)}
            className="btn-outline w-full"
          >
            View order status
          </button>

          <button
            onClick={handlePayfast}
            className="btn-primary w-full"
            disabled={payfastLoading}
          >
            {payfastLoading ? (
              <Spinner
                size={16}
                className="!border-paper/30 !border-t-paper"
              />
            ) : (
              `Pay ${formatCurrency(order.total)} with PayFast`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
