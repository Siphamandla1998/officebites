import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FiCheck, FiClock, FiXCircle } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import StatusBadge from "../../components/ui/StatusBadge";
import Spinner from "../../components/ui/Spinner";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { ORDER_STATUS } from "../../utils/constants";

// PayFast's ITN webhook confirms payment server-side, asynchronously — it
// usually lands within a couple of seconds of the browser returning here,
// but there's no guarantee of order. Poll briefly rather than trusting the
// ?payfast=return redirect itself as proof of payment.
const CONFIRM_POLL_MS = 2500;
const CONFIRM_POLL_ATTEMPTS = 12; // ~30s

/**
 * Handles the two states a customer can land in after being redirected back
 * from PayFast: `payfast=return` (they completed the PayFast form; we're
 * waiting on the server-side ITN to actually confirm it) and
 * `payfast=cancel` (they backed out of PayFast before paying). Neither one
 * means the order is confirmed — only confirm_payfast_payment() does that.
 */
function PayfastReturnBanner({ order, payfastState, onConfirmed, onClearParam }) {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState(0);
  const stillPending = order.status === ORDER_STATUS.PENDING_PAYMENT;

  useEffect(() => {
    if (payfastState !== "return" || !stillPending) return;
    if (attempts >= CONFIRM_POLL_ATTEMPTS) return;
    const timer = setTimeout(async () => {
      const fresh = await onConfirmed();
      if (fresh?.status !== ORDER_STATUS.PENDING_PAYMENT) return;
      setAttempts((a) => a + 1);
    }, CONFIRM_POLL_MS);
    return () => clearTimeout(timer);
  }, [payfastState, stillPending, attempts, onConfirmed]);

  // Payment resolved (confirmed, or cancelled but order already moved on) —
  // drop the query param so a refresh doesn't re-trigger this banner/polling.
  useEffect(() => {
    if (payfastState && !stillPending) onClearParam();
  }, [payfastState, stillPending, onClearParam]);

  if (payfastState === "cancel" && stillPending) {
    return (
      <div className="card p-4 flex items-start gap-3 border-l-4 border-l-red-400">
        <FiXCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">Payment cancelled</p>
          <p className="text-xs text-ink-muted mt-0.5">
            You left PayFast before completing payment. Your order ({order.ticketNumber}) is still
            waiting — you can retry with PayFast or pay by manual EFT instead.
          </p>
          <button
            onClick={() => navigate(`/payment/${order.id}`, { replace: true })}
            className="btn-primary mt-3 !py-2 !text-xs"
          >
            Retry payment
          </button>
        </div>
      </div>
    );
  }

  if (payfastState === "return" && stillPending) {
    const timedOut = attempts >= CONFIRM_POLL_ATTEMPTS;
    return (
      <div className="card p-4 flex items-start gap-3 border-l-4 border-l-nude-400">
        {timedOut ? (
          <FiClock className="text-nude-600 shrink-0 mt-0.5" size={18} />
        ) : (
          <Spinner size={16} className="shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">
            {timedOut ? "Still confirming your payment" : "Confirming your payment…"}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            {timedOut
              ? "PayFast is taking longer than usual to confirm. We'll update this page automatically once it's through — no need to pay again."
              : "PayFast has your payment — we're just waiting for their confirmation to reach us. This is usually instant."}
          </p>
          {timedOut && (
            <button
              onClick={() => navigate(`/payment/${order.id}`, { replace: true })}
              className="btn-outline mt-3 !py-2 !text-xs"
            >
              View payment options
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

const TIMELINE = [
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.COLLECTED,
  ORDER_STATUS.COMPLETED,
];

// Short labels for the compact 6-step mobile timeline (StatusBadge above it
// already shows the full label).
const SHORT_LABELS = {
  [ORDER_STATUS.CONFIRMED]: "Confirmed",
  [ORDER_STATUS.ACCEPTED]: "Accepted",
  [ORDER_STATUS.PREPARING]: "Preparing",
  [ORDER_STATUS.READY]: "Ready",
  [ORDER_STATUS.COLLECTED]: "Collected",
  [ORDER_STATUS.COMPLETED]: "Done",
};

function SubOrderTimeline({ subOrder }) {
  const currentIndex = TIMELINE.indexOf(subOrder.status);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-ink">{subOrder.vendorName}</p>
        <StatusBadge status={subOrder.status} />
      </div>
      <div className="flex items-center">
        {TIMELINE.map((step, i) => (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                i <= currentIndex ? "bg-ink text-paper" : "bg-nude-100 text-ink-muted"
              }`}
            >
              {i <= currentIndex ? <FiCheck size={13} /> : <span className="text-[10px]">{i + 1}</span>}
            </div>
            {i < TIMELINE.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 ${i < currentIndex ? "bg-ink" : "bg-nude-100"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {TIMELINE.map((step) => (
          <span key={step} className="text-[9px] text-ink-muted w-10 text-center first:text-left last:text-right">
            {SHORT_LABELS[step]}
          </span>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-line flex flex-col gap-1">
        {subOrder.items.map((item) => (
          <div key={item.mealId} className="flex justify-between text-sm">
            <span className="text-ink-soft">{item.qty} × {item.name}</span>
            <span className="text-ink">{formatCurrency(item.price * item.qty)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrderTracking() {
  const { orderId } = useParams();
  const { data: order, loading, setData } = useAsync(
    () => orderService.getOrderById(orderId),
    [orderId]
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const payfastState = searchParams.get("payfast"); // "return" | "cancel" | null
  const clearedParam = useRef(false);

  const handleConfirmed = async () => {
    const fresh = await orderService.getOrderById(orderId);
    setData(fresh);
    return fresh;
  };

  const clearPayfastParam = () => {
    if (clearedParam.current) return;
    clearedParam.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete("payfast");
    setSearchParams(next, { replace: true });
  };

  if (loading || !order) {
    return (
      <div>
        <Navbar showBack title="Order" showCart={false} />
        <div className="ob-container pt-4"><div className="skeleton h-64" /></div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <Navbar showBack title={order.ticketNumber} showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-4">
        {payfastState && (
          <PayfastReturnBanner
            order={order}
            payfastState={payfastState}
            onConfirmed={handleConfirmed}
            onClearParam={clearPayfastParam}
          />
        )}
        <p className="text-xs text-ink-muted">Delivery date: {formatDate(order.deliveryDate)}</p>
        {order.subOrders.map((so) => (
          <SubOrderTimeline key={so.vendorId} subOrder={so} />
        ))}
        <div className="card p-4 flex justify-between">
          <span className="text-sm font-semibold text-ink">Order total</span>
          <span className="text-base font-bold text-ink">{formatCurrency(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
