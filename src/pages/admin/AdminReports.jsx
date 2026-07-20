import { FiDownload, FiFileText } from "react-icons/fi";
import Table from "../../components/ui/Table";
import { orders } from "../../mock/orders";
import { formatCurrency, formatDate } from "../../utils/formatters";
import StatusBadge from "../../components/ui/StatusBadge";

const REPORTS = [
  { id: "rep-1", name: "Monthly commission report — June 2026", type: "Commission", date: "2026-07-01" },
  { id: "rep-2", name: "Vendor payout summary — Week 28", type: "Payouts", date: "2026-07-14" },
  { id: "rep-3", name: "Customer growth report — Q2 2026", type: "Growth", date: "2026-07-01" },
];

export default function AdminReports() {
  const columns = [
    { key: "ticket", header: "Ticket", render: (o) => o.ticketNumber },
    { key: "customer", header: "Customer", render: (o) => o.customerName },
    { key: "vendors", header: "Vendors", render: (o) => o.subOrders.map((s) => s.vendorName).join(", ") },
    { key: "date", header: "Delivery", render: (o) => formatDate(o.deliveryDate) },
    { key: "total", header: "Total", render: (o) => formatCurrency(o.total) },
    { key: "status", header: "Status", render: (o) => <StatusBadge status={o.status} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Reports</h1>
        <p className="text-sm text-ink-muted mt-0.5">Download platform reports or review raw order data.</p>
      </div>

      <div className="card divide-y divide-line overflow-hidden">
        {REPORTS.map((r) => (
          <div key={r.id} className="flex items-center gap-3.5 p-4">
            <div className="h-10 w-10 rounded-xl bg-nude-100 text-nude-700 flex items-center justify-center shrink-0">
              <FiFileText size={17} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{r.name}</p>
              <p className="text-xs text-ink-muted">{r.type} · {formatDate(r.date)}</p>
            </div>
            <button className="btn-icon shrink-0" aria-label="Download report">
              <FiDownload size={15} />
            </button>
          </div>
        ))}
      </div>

      <div>
        <h3 className="section-title mb-3">All orders</h3>
        <Table columns={columns} data={orders} />
      </div>
    </div>
  );
}
