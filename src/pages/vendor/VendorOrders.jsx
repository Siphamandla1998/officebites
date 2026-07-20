import { useState } from "react";
import { FiEye } from "react-icons/fi";
import Filters from "../../components/ui/Filters";
import Table from "../../components/ui/Table";
import StatusBadge from "../../components/ui/StatusBadge";
import Modal from "../../components/ui/Modal";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { formatCurrency, formatDate, formatTime } from "../../utils/formatters";
import {
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  VENDOR_ORDER_FLOW,
  VENDOR_ORDER_ACTION_LABELS,
} from "../../utils/constants";

/** The single valid next status for a vendor order, or null if it's terminal/cancelled. */
function nextStatusFor(status) {
  const i = VENDOR_ORDER_FLOW.indexOf(status);
  if (i === -1 || i === VENDOR_ORDER_FLOW.length - 1) return null;
  return VENDOR_ORDER_FLOW[i + 1];
}

export default function VendorOrders() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const { data: orders, loading, refetch } = useAsync(
    () => orderService.getOrdersForVendor(user.vendorId),
    [user.vendorId]
  );

  const filtered = (orders || []).filter((o) => filter === "all" || o.subOrder.status === filter);

  const advance = async (order) => {
    const next = nextStatusFor(order.subOrder.status);
    if (!next) return;
    try {
      await orderService.updateSubOrderStatus(order.id, user.vendorId, next);
      showToast(`Marked as ${ORDER_STATUS_LABELS[next]}`, { type: "success" });
      refetch();
      if (selected?.id === order.id) {
        setSelected({ ...order, subOrder: { ...order.subOrder, status: next } });
      }
    } catch (err) {
      showToast(err.message || "Couldn't update order", { type: "error" });
    }
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
      render: (o) => {
        const next = nextStatusFor(o.subOrder.status);
        return (
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(o)} className="btn-icon !h-8 !w-8" aria-label="View order">
              <FiEye size={13} />
            </button>
            {next && o.subOrder.status !== ORDER_STATUS.CANCELLED ? (
              <button onClick={() => advance(o)} className="btn-secondary !px-3 !py-1.5 text-xs whitespace-nowrap">
                {VENDOR_ORDER_ACTION_LABELS[next]}
              </button>
            ) : (
              <span className="text-xs text-ink-muted">—</span>
            )}
          </div>
        );
      },
    },
  ];

  const selectedNext = selected ? nextStatusFor(selected.subOrder.status) : null;

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
          ORDER_STATUS.ACCEPTED,
          ORDER_STATUS.PREPARING,
          ORDER_STATUS.READY,
          ORDER_STATUS.COLLECTED,
          ORDER_STATUS.COMPLETED,
          ORDER_STATUS.CANCELLED,
        ]}
        active={filter}
        onChange={setFilter}
        allLabel="All orders"
        labels={ORDER_STATUS_LABELS}
      />
      {loading ? <div className="skeleton h-64" /> : <Table columns={columns} data={filtered} />}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.ticketNumber}
        footer={
          selected &&
          selectedNext &&
          selected.subOrder.status !== ORDER_STATUS.CANCELLED && (
            <button onClick={() => advance(selected)} className="btn-primary w-full">
              {VENDOR_ORDER_ACTION_LABELS[selectedNext]}
            </button>
          )
        }
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={selected.subOrder.status} />
              <StatusBadge status={selected.subOrder.paymentStatus === "paid" ? "completed" : "payment_submitted"} />
            </div>
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
                <p className="text-xs text-ink-muted">Collection time</p>
                <p className="font-medium text-ink">{selected.subOrder.collectionTime || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-ink-muted">Order placed</p>
                <p className="font-medium text-ink">{formatTime(selected.createdAt)}</p>
              </div>
            </div>
            <div className="border-t border-line pt-3 flex flex-col gap-1.5">
              {selected.subOrder.items.map((item) => (
                <div key={item.mealId} className="flex justify-between text-sm">
                  <span className="text-ink-soft">{item.qty} × {item.name}</span>
                  <span className="text-ink">{formatCurrency(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-line">
                <span>Total</span>
                <span>{formatCurrency(selected.subOrder.subtotal)}</span>
              </div>
            </div>
            {selected.subOrder.notes && (
              <div className="rounded-xl bg-nude-50 p-3">
                <p className="text-xs font-medium text-ink-muted mb-1">Customer notes</p>
                <p className="text-sm text-ink-soft">{selected.subOrder.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
