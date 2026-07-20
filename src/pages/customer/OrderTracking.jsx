import { useParams } from "react-router-dom";
import { FiCheck } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { ORDER_STATUS } from "../../utils/constants";

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
  const { data: order, loading } = useAsync(() => orderService.getOrderById(orderId), [orderId]);

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
