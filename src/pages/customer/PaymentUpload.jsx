import { useState } from "react";
import { useParams } from "react-router-dom";
import { FiCreditCard } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import Spinner from "../../components/ui/Spinner";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { paymentService } from "../../services/paymentService";
import { useToast } from "../../context/ToastContext";
import { formatCurrency } from "../../utils/formatters";
import { getGuestOrderAccess } from "../../utils/guest";

export default function PaymentUpload() {
  const { orderId } = useParams();
  const { showToast } = useToast();
  const [payfastLoading, setPayfastLoading] = useState(false);

  const { data: order, loading } = useAsync(
    () => orderService.getOrderById(orderId),
    [orderId]
  );

  const handlePayfast = async () => {
    setPayfastLoading(true);

    try {
      const guestAccess = getGuestOrderAccess(orderId);

      const { processUrl, fields } =
        await paymentService.initiatePayfastPayment(
          orderId,
          guestAccess?.contact || null
        );

      paymentService.redirectToPayfast({ processUrl, fields });
    } catch (err) {
      showToast(
        err.message || "Couldn't start PayFast payment",
        { type: "error" }
      );
      setPayfastLoading(false);
    }
  };

  if (loading || !order) {
    return (
      <div>
        <Navbar showBack title="Payment" showCart={false} />
        <div className="ob-container pt-4">
          <div className="skeleton h-48" />
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
              PayFast will confirm your payment automatically once it has been verified.
            </p>
          </div>

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