import { FiClock, FiCheckCircle, FiTrendingUp, FiPackage } from "react-icons/fi";
import StatCard from "../../components/ui/StatCard";
import OrderCard from "../../components/features/OrderCard";
import BarChart from "../../components/charts/BarChart";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { useAuth } from "../../context/AuthContext";
import { vendorRevenue7d } from "../../mock/analytics";
import { formatCurrency } from "../../utils/formatters";
import { ORDER_STATUS } from "../../utils/constants";

export default function VendorOverview() {
  const { user } = useAuth();
  const { data: orders, loading } = useAsync(
    () => orderService.getOrdersForVendor(user.vendorId),
    [user.vendorId]
  );

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const todayOrders = (orders || []).filter((o) => o.deliveryDate === today);
  const tomorrowOrders = (orders || []).filter((o) => o.deliveryDate === tomorrow);
  const pending = (orders || []).filter((o) => o.subOrder.status === ORDER_STATUS.PAYMENT_SUBMITTED);
  const completed = (orders || []).filter((o) => o.subOrder.status === ORDER_STATUS.COMPLETED);
  const revenue = vendorRevenue7d.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Welcome back, {user?.name?.split(" ")[0]}</h1>
        <p className="text-sm text-ink-muted mt-0.5">Here's how your store is doing.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard label="Today's orders" value={todayOrders.length} icon={FiClock} />
        <StatCard label="Tomorrow's orders" value={tomorrowOrders.length} icon={FiPackage} />
        <StatCard label="Pending" value={pending.length} icon={FiCheckCircle} />
        <StatCard label="7-day revenue" value={formatCurrency(revenue)} icon={FiTrendingUp} trend="+12% vs last week" trendUp />
      </div>

      <div className="card p-5">
        <h3 className="section-title mb-4">Revenue this week</h3>
        <BarChart data={vendorRevenue7d} xKey="day" yKey="revenue" />
      </div>

      <div>
        <h3 className="section-title mb-3">Today's orders</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {loading ? (
            <div className="skeleton h-24" />
          ) : todayOrders.length === 0 ? (
            <p className="text-sm text-ink-muted">No orders for today yet.</p>
          ) : (
            todayOrders.map((o) => <OrderCard key={o.id} order={{ ...o, status: o.subOrder.status }} />)
          )}
        </div>
      </div>
    </div>
  );
}
