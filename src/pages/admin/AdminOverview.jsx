import { FiUsers, FiShoppingBag, FiClock, FiDollarSign } from "react-icons/fi";
import StatCard from "../../components/ui/StatCard";
import LineChart from "../../components/charts/LineChart";
import { useAsync } from "../../hooks/useAsync";
import { adminService } from "../../services/adminService";
import { formatCurrency } from "../../utils/formatters";

export default function AdminOverview() {
  const { data: stats, loading } = useAsync(() => adminService.getPlatformStats(), []);
  const { data: revenue, loading: revLoading } = useAsync(() => adminService.getRevenueReport(), []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Platform overview</h1>
        <p className="text-sm text-ink-muted mt-0.5">A snapshot of OfficeBites right now.</p>
      </div>

      {loading ? (
        <div className="skeleton h-24" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatCard label="Total customers" value={stats.totalCustomers} icon={FiUsers} />
          <StatCard label="Active vendors" value={stats.totalVendors} icon={FiShoppingBag} trend={`${stats.pendingVendors} pending review`} />
          <StatCard label="Orders today" value={stats.ordersToday} icon={FiClock} />
          <StatCard label="GMV this month" value={formatCurrency(stats.gmvThisMonth)} icon={FiDollarSign} trend={`Commission ${formatCurrency(stats.commissionThisMonth)}`} trendUp />
        </div>
      )}

      <div className="card p-5">
        <h3 className="section-title mb-4">GMV & commission (last 4 weeks)</h3>
        {revLoading ? (
          <div className="skeleton h-36" />
        ) : (
          <LineChart data={revenue} xKey="week" yKey="gmv" />
        )}
      </div>
    </div>
  );
}
