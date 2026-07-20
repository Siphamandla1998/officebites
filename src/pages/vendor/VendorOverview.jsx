import { FiClock, FiCheckCircle, FiTrendingUp, FiPackage, FiXCircle, FiStar, FiTag } from "react-icons/fi";
import StatCard from "../../components/ui/StatCard";
import OrderCard from "../../components/features/OrderCard";
import BarChart from "../../components/charts/BarChart";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { vendorService } from "../../services/vendorService";
import { useAuth } from "../../context/AuthContext";
import { vendorRevenue7d } from "../../mock/analytics";
import { formatCurrency } from "../../utils/formatters";

export default function VendorOverview() {
  const { user } = useAuth();
  const { data: orders, loading: ordersLoading } = useAsync(
    () => orderService.getOrdersForVendor(user.vendorId),
    [user.vendorId]
  );
  const { data: stats, loading: statsLoading } = useAsync(
    () => vendorService.getDashboardStats(user.vendorId),
    [user.vendorId]
  );

  const todaysList = (orders || []).filter((o) => {
    const today = new Date().toDateString();
    return new Date(o.createdAt).toDateString() === today;
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Welcome back, {user?.name?.split(" ")[0]}</h1>
        <p className="text-sm text-ink-muted mt-0.5">Here's how your store is doing.</p>
      </div>

      {statsLoading ? (
        <div className="skeleton h-24" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <StatCard label="Today's orders" value={stats.todaysOrders} icon={FiClock} />
            <StatCard label="Pending orders" value={stats.pendingOrders} icon={FiPackage} />
            <StatCard label="Confirmed" value={stats.confirmedOrders} icon={FiCheckCircle} />
            <StatCard label="Preparing" value={stats.preparingOrders} icon={FiPackage} />
            <StatCard label="Ready for collection" value={stats.readyOrders} icon={FiPackage} />
            <StatCard label="Delivered" value={stats.deliveredOrders} icon={FiCheckCircle} />
            <StatCard label="Cancelled" value={stats.cancelledOrders} icon={FiXCircle} />
            <StatCard label="Total orders" value={stats.totalOrders} icon={FiTrendingUp} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <StatCard label="Today's revenue" value={formatCurrency(stats.todaysRevenue)} icon={FiTrendingUp} />
            <StatCard label="Weekly revenue" value={formatCurrency(stats.weeklyRevenue)} icon={FiTrendingUp} />
            <StatCard label="Monthly revenue" value={formatCurrency(stats.monthlyRevenue)} icon={FiTrendingUp} />
            <StatCard label="Average order value" value={formatCurrency(stats.averageOrderValue)} icon={FiTrendingUp} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <StatCard
              label="Most popular meal"
              value={stats.mostPopularMeal?.name || "Not enough data yet"}
              icon={FiStar}
            />
            <StatCard
              label="Best selling category"
              value={stats.bestSellingCategory || "Not enough data yet"}
              icon={FiTag}
            />
          </div>
        </>
      )}

      <div className="card p-5">
        <h3 className="section-title mb-4">Revenue this week</h3>
        <BarChart data={vendorRevenue7d} xKey="day" yKey="revenue" />
      </div>

      <div>
        <h3 className="section-title mb-3">Today's orders</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {ordersLoading ? (
            <div className="skeleton h-24" />
          ) : todaysList.length === 0 ? (
            <p className="text-sm text-ink-muted">No orders placed today yet.</p>
          ) : (
            todaysList.map((o) => <OrderCard key={o.id} order={{ ...o, status: o.subOrder.status }} />)
          )}
        </div>
      </div>
    </div>
  );
}
