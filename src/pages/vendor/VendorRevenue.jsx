import { FiDollarSign, FiPercent, FiTrendingUp } from "react-icons/fi";
import StatCard from "../../components/ui/StatCard";
import BarChart from "../../components/charts/BarChart";
import Table from "../../components/ui/Table";
import StatusBadge from "../../components/ui/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { paymentService } from "../../services/paymentService";
import { useAuth } from "../../context/AuthContext";
import { vendorRevenue7d } from "../../mock/analytics";
import { formatCurrency, formatDate } from "../../utils/formatters";

export default function VendorRevenue() {
  const { user } = useAuth();
  const { data: payouts, loading } = useAsync(() => paymentService.getVendorPayouts(user.vendorId), [user.vendorId]);

  const gross = vendorRevenue7d.reduce((s, d) => s + d.revenue, 0);
  const { commission, vendorPayout } = paymentService.calculateCommission(gross);

  const columns = [
    { key: "date", header: "Date", render: (p) => formatDate(p.date) },
    { key: "gross", header: "Gross", render: (p) => formatCurrency(p.gross) },
    { key: "commission", header: "Commission", render: (p) => formatCurrency(p.commission) },
    { key: "net", header: "Net payout", render: (p) => formatCurrency(p.net) },
    { key: "status", header: "Status", render: (p) => <StatusBadge status={p.status === "paid" ? "completed" : "pending_payment"} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Revenue</h1>
        <p className="text-sm text-ink-muted mt-0.5">OfficeBites takes a 10% commission per completed order.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5">
        <StatCard label="Gross (7 days)" value={formatCurrency(gross)} icon={FiTrendingUp} />
        <StatCard label="Commission" value={formatCurrency(commission)} icon={FiPercent} />
        <StatCard label="Net payout" value={formatCurrency(vendorPayout)} icon={FiDollarSign} trend="Paid weekly" trendUp />
      </div>

      <div className="card p-5">
        <h3 className="section-title mb-4">Revenue trend</h3>
        <BarChart data={vendorRevenue7d} xKey="day" yKey="revenue" />
      </div>

      <div>
        <h3 className="section-title mb-3">Payout history</h3>
        {loading ? <div className="skeleton h-40" /> : <Table columns={columns} data={payouts} />}
      </div>
    </div>
  );
}
