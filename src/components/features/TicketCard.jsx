import { FiCheckCircle } from "react-icons/fi";
import { formatCurrency, formatDate } from "../../utils/formatters";
import StatusBadge from "../ui/StatusBadge";

export default function TicketCard({ order }) {
  return (
    <div className="card overflow-hidden">
      <div className="bg-ink text-paper px-5 py-6 flex flex-col items-center text-center gap-2">
        <div className="h-12 w-12 rounded-full bg-paper/10 flex items-center justify-center">
          <FiCheckCircle size={24} />
        </div>
        <p className="text-xs uppercase tracking-wide text-paper/60">Order ticket</p>
        <p className="text-2xl font-bold tracking-tight">{order.ticketNumber}</p>
        <StatusBadge status={order.status} />
      </div>

      {/* Perforated divider look */}
      <div className="relative h-0 border-t border-dashed border-line">
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-paper" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-paper" />
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">Delivery date</span>
          <span className="font-medium text-ink">{formatDate(order.deliveryDate)}</span>
        </div>
        {order.subOrders.map((so) => (
          <div key={so.vendorId} className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-nude-700 uppercase tracking-wide">
              {so.vendorName}
            </p>
            {so.items.map((item) => (
              <div key={item.mealId} className="flex justify-between text-sm">
                <span className="text-ink-soft">
                  {item.qty} × {item.name}
                </span>
                <span className="text-ink">{formatCurrency(item.price * item.qty)}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="flex justify-between pt-3 border-t border-line">
          <span className="text-sm font-semibold text-ink">Total</span>
          <span className="text-base font-bold text-ink">{formatCurrency(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
