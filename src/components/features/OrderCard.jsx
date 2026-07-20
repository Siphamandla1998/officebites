import { Link } from "react-router-dom";
import { FiChevronRight } from "react-icons/fi";
import { formatCurrency, formatDate } from "../../utils/formatters";
import StatusBadge from "../ui/StatusBadge";

export default function OrderCard({ order }) {
  return (
    <Link to={`/orders/${order.id}`} className="card p-4 flex flex-col gap-2.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-ink-muted">{order.ticketNumber}</p>
          <p className="text-sm font-semibold text-ink mt-0.5">
            {order.subOrders.length > 1
              ? `${order.subOrders.length} vendors`
              : order.subOrders[0]?.vendorName}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-line">
        <span className="text-xs text-ink-muted">{formatDate(order.deliveryDate)}</span>
        <span className="text-sm font-semibold text-ink flex items-center gap-1">
          {formatCurrency(order.total)}
          <FiChevronRight size={14} className="text-ink-muted" />
        </span>
      </div>
    </Link>
  );
}
