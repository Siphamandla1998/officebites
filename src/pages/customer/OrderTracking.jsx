import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { FiCheck, FiClock } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { ORDER_STATUS } from "../../utils/constants";
import RequestError from '../../components/ui/RequestError';

// Recovery is based on the stored order state, including browser Back returns
// where PayFast never adds a return/cancel query parameter.
function PaymentRecovery({ order, payfastState, onRefresh, onPayment, refreshing, refreshError }) {
  if (order.status !== ORDER_STATUS.PENDING_PAYMENT) return null;
  const returned = payfastState === "return";
  return (
    <div className="card p-4 flex items-start gap-3 border-l-4 border-l-nude-400">
      <FiClock className="text-nude-600 shrink-0 mt-0.5" size={18} />
      <div className="flex-1">
        <p className="text-sm font-semibold text-ink">
          {returned ? "Payment confirmation pending" : "Payment still required"}
        </p>
        <p className="text-xs text-ink-muted mt-1">
          OfficeBites has not received payment confirmation for {order.ticketNumber}.
          If your bank shows a debit, wait for confirmation or contact support before paying again.
          If you did not complete payment, reopen the payment options for this order.
        </p>
        {refreshError && <p role="alert" className="text-xs text-red-600 mt-2">{refreshError}</p>}
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={onPayment} disabled={refreshing} className="btn-primary !py-2 !text-xs">
            {returned ? "View payment options" : "Retry payment"}
          </button>
          <button onClick={onRefresh} disabled={refreshing} className="btn-outline !py-2 !text-xs">
            {refreshing ? "Checking…" : "Refresh payment status"}
          </button>
        </div>
      </div>
    </div>
  );
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
  const navigate = useNavigate();
  const { data: order, loading, error, refetch, setData } = useAsync(
    () => orderService.getOrderById(orderId),
    [orderId]
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const payfastState = searchParams.get("payfast");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const refreshOrder = useCallback(async () => {
    const fresh = await orderService.getOrderById(orderId);
    if (!fresh?.id) throw new Error("Order unavailable. Please try again.");
    setData(fresh);
    return fresh;
  }, [orderId, setData]);

  const checkPayment = async (openOptions = false) => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      const fresh = await refreshOrder();
      if (openOptions && fresh.status === ORDER_STATUS.PENDING_PAYMENT) {
        navigate(`/payment/${orderId}`);
      }
    } catch (err) {
      setRefreshError(err.message || "Could not check payment status. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  // Refresh payment and fulfilment until the order reaches a terminal state.
  useEffect(() => {
    if (!order?.id || [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED].includes(order.status)) return;
    let active = true;
    let running = false;
    const refresh = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      try {
        const fresh = await orderService.getOrderById(orderId);
        if (active && fresh?.id) setData(fresh);
      } catch {
        // A transient background failure must not erase the loaded order.
      } finally {
        running = false;
      }
    };
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [orderId, order?.id, order?.status, setData]);

  useEffect(() => {
    if (!payfastState || !order?.id || order.status === ORDER_STATUS.PENDING_PAYMENT) return;
    const next = new URLSearchParams(searchParams);
    next.delete("payfast");
    setSearchParams(next, { replace: true });
  }, [payfastState, order?.id, order?.status, searchParams, setSearchParams]);

  if (loading) {
    return (
      <div>
        <Navbar showBack title="Order" showCart={false} />
        <div className="ob-container pt-4"><div className="skeleton h-64" /></div>
      </div>
    );
  }

  if (error || !order?.id) {
    return (
      <div>
        <Navbar showBack title="Order" showCart={false} />
        <p role="alert" className="ob-container pt-4 text-sm text-ink-muted">
          Could not load this order. Please refresh or open it from your order history.
        </p>
        <RequestError error={error || new Error('Order unavailable')} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <Navbar showBack title={order.ticketNumber} showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-4">
        <PaymentRecovery
          order={order}
          payfastState={payfastState}
          onRefresh={() => checkPayment()}
          onPayment={() => checkPayment(true)}
          refreshing={refreshing}
          refreshError={refreshError}
        />
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
