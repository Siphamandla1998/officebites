import { useState } from "react";
import Filters from "../../components/ui/Filters";
import Table from "../../components/ui/Table";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { ORDER_STATUS, ORDER_STATUS_LABELS } from "../../utils/constants";

const NEXT_STATUS = {
  [ORDER_STATUS.CONFIRMED]: ORDER_STATUS.PREPARING,
  [ORDER_STATUS.PREPARING]: ORDER_STATUS.READY,
  [ORDER_STATUS.READY]: ORDER_STATUS.COMPLETED,
};

export default function VendorOrders() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [filter, setFilter] = useState("all");
  const { data: orders, loading, refetch } = useAsync(
    () => orderService.getOrdersForVendor(user.vendorId),
    [user.vendorId]
  );

  const filtered = (orders || []).filter((o) => filter === "all" || o.subOrder.status === filter);

  const advance = async (order) => {
    const next = NEXT_STATUS[order.subOrder.status];
    if (!next) return;
    await orderService.updateSubOrderStatus(order.id, user.vendorId, next);
    showToast(`Marked as ${ORDER_STATUS_LABELS[next]}`, { type: "success" });
    refetch();
  };

  const columns = [
    { key: "ticket", header: "Ticket", render: (o) => <span className="font-medium text-ink">{o.ticketNumber}</span> },
    { key: "customer", header: "Customer", render: (o) => o.customerName },
    { key: "date", header: "Delivery", render: (o) => formatDate(o.deliveryDate) },
    { key: "items", header: "Items", render: (o) => o.subOrder.items.reduce((s, i) => s + i.qty, 0) },
    { key: "total", header: "Total", render: (o) => formatCurrency(o.subOrder.subtotal) },
    { key: "status", header: "Status", render: (o) => <StatusBadge status={o.subOrder.status} /> },
    {
      key: "action",
      header: "",
      render: (o) =>
        NEXT_STATUS[o.subOrder.status] ? (
          <button onClick={() => advance(o)} className="btn-secondary !px-3 !py-1.5 text-xs">
            Mark {ORDER_STATUS_LABELS[NEXT_STATUS[o.subOrder.status]]}
          </button>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Orders</h1>
        <p className="text-sm text-ink-muted mt-0.5">
          Confirmed orders cannot be rejected — move them through your prep pipeline instead.
        </p>
      </div>
      <Filters
        options={[
          ORDER_STATUS.CONFIRMED,
          ORDER_STATUS.PREPARING,
          ORDER_STATUS.READY,
          ORDER_STATUS.COMPLETED,
        ]}
        active={filter}
        onChange={setFilter}
        allLabel="All orders"
        labels={ORDER_STATUS_LABELS}
      />
      {loading ? <div className="skeleton h-64" /> : <Table columns={columns} data={filtered} />}
    </div>
  );
}
