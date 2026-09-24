import { Link } from "react-router-dom";
import {
  FiUsers,
  FiShoppingBag,
  FiClock,
  FiDollarSign,
  FiCreditCard,
} from "react-icons/fi";
import StatCard from "../../components/ui/StatCard";
import StatusBadge from "../../components/ui/StatusBadge";
import LineChart from "../../components/charts/LineChart";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { adminService } from "../../services/adminService";
import { orderService } from "../../services/orderService";
import {
  formatCurrency,
  formatRelativeTime,
} from "../../utils/formatters";

export default function AdminOverview() {
  const { data: stats, loading } = useAsync(
    () => adminService.getPlatformStats(),
    []
  );

  const { data: revenue, loading: revLoading } = useAsync(
    () => adminService.getRevenueReport(),
    []
  );

  const {
    data: recentPayments = [],
    loading: paymentsLoading,
  } = useAsync(
    () => orderService.getRecentPayments(8),
    []
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">
          Platform overview
        </h1>

        <p className="text-sm text-ink-muted mt-0.5">
          A snapshot of OfficeBites right now.
        </p>
      </div>

      {loading ? (
        <div className="skeleton h-24" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatCard
            label="Total customers"
            value={stats.totalCustomers}
            icon={FiUsers}
          />

          <StatCard
            label="Active vendors"
            value={stats.totalVendors}
            icon={FiShoppingBag}
            trend={`${stats.pendingVendors} pending review`}
          />

          <StatCard
            label="Orders today"
            value={stats.ordersToday}
            icon={FiClock}
          />

          <StatCard
            label="GMV this month"
            value={formatCurrency(stats.gmvThisMonth)}
            icon={FiDollarSign}
            trend={`17% gross commission ${formatCurrency(
              stats.commissionThisMonth
            )}`}
            trendUp
          />
        </div>
      )}

      <div className="card p-5">
        <h3 className="section-title mb-4">
          GMV & commission (last 4 weeks)
        </h3>

        {revLoading ? (
          <div className="skeleton h-36" />
        ) : (
          <LineChart
            data={revenue || []}
            xKey="week"
            yKey="gmv"
          />
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-title">
              Recent PayFast payments
            </h3>

            <p className="text-xs text-ink-muted mt-0.5">
              Payments shown here have been confirmed
              automatically through PayFast.
            </p>
          </div>

          <Link
            to="/admin/payments"
            className="text-xs font-medium text-nude-600"
          >
            View payments
          </Link>
        </div>

        {paymentsLoading ? (
          <div className="skeleton h-36" />
        ) : recentPayments.length === 0 ? (
          <EmptyState
            icon={<FiCreditCard size={18} />}
            title="No confirmed payments yet"
            description="Verified PayFast payments will appear here automatically."
          />
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {recentPayments.map((order) => (
              <div
                key={order.id}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {order.ticketNumber}
                  </p>

                  <p className="text-xs text-ink-muted truncate">
                    {order.customerName} · PayFast
                    {" · "}
                    {formatRelativeTime(order.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold text-ink">
                    {formatCurrency(order.total)}
                  </span>

                  <StatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}