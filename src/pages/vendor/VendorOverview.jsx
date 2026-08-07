import {
  FiClock,
  FiCheckCircle,
  FiTrendingUp,
  FiPackage,
  FiXCircle,
  FiStar,
  FiTag,
} from "react-icons/fi";

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

  const vendorId = user?.vendorId;

  const {
    data: orders,
    loading: ordersLoading,
  } = useAsync(
    () =>
      vendorId
        ? orderService.getOrdersForVendor(vendorId)
        : Promise.resolve([]),
    [vendorId]
  );

  const {
    data: stats,
    loading: statsLoading,
  } = useAsync(
    () =>
      vendorId
        ? vendorService.getDashboardStats(vendorId)
        : Promise.resolve(null),
    [vendorId]
  );


  // Prevent dashboard crashing if data is not ready
  const dashboardStats = stats || {
    todaysOrders: 0,
    pendingOrders: 0,
    confirmedOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    totalOrders: 0,

    todaysRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
    averageOrderValue: 0,

    mostPopularMeal: null,
    bestSellingCategory: null,
  };


  const todaysList = (orders || []).filter((o) => {
    const today = new Date().toDateString();
    return new Date(o.createdAt).toDateString() === today;
  });


  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-semibold text-ink">
          Welcome back, {user?.name?.split(" ")[0] || "Vendor"}
        </h1>

        <p className="text-sm text-ink-muted">
          Here's how your store is doing.
        </p>
      </div>


      {statsLoading ? (
        <div className="skeleton h-24" />
      ) : (

        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">

            <StatCard
              label="Today's orders"
              value={dashboardStats.todaysOrders}
              icon={FiClock}
            />

            <StatCard
              label="Pending orders"
              value={dashboardStats.pendingOrders}
              icon={FiPackage}
            />

            <StatCard
              label="Confirmed"
              value={dashboardStats.confirmedOrders}
              icon={FiCheckCircle}
            />

            <StatCard
              label="Preparing"
              value={dashboardStats.preparingOrders}
              icon={FiPackage}
            />

            <StatCard
              label="Ready for collection"
              value={dashboardStats.readyOrders}
              icon={FiPackage}
            />

            <StatCard
              label="Delivered"
              value={dashboardStats.deliveredOrders}
              icon={FiCheckCircle}
            />

            <StatCard
              label="Cancelled"
              value={dashboardStats.cancelledOrders}
              icon={FiXCircle}
            />

            <StatCard
              label="Total orders"
              value={dashboardStats.totalOrders}
              icon={FiTrendingUp}
            />

          </div>


          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">

            <StatCard
              label="Today's revenue"
              value={formatCurrency(dashboardStats.todaysRevenue)}
              icon={FiTrendingUp}
            />

            <StatCard
              label="Weekly revenue"
              value={formatCurrency(dashboardStats.weeklyRevenue)}
              icon={FiTrendingUp}
            />

            <StatCard
              label="Monthly revenue"
              value={formatCurrency(dashboardStats.monthlyRevenue)}
              icon={FiTrendingUp}
            />

            <StatCard
              label="Average order value"
              value={formatCurrency(dashboardStats.averageOrderValue)}
              icon={FiTrendingUp}
            />

          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">

            <StatCard
              label="Most popular meal"
              value={
                dashboardStats.mostPopularMeal?.name ||
                "Not enough data yet"
              }
              icon={FiStar}
            />


            <StatCard
              label="Best selling category"
              value={
                dashboardStats.bestSellingCategory ||
                "Not enough data yet"
              }
              icon={FiTag}
            />

          </div>

        </>
      )}



      <div className="card p-5">

        <h3 className="section-title mb-4">
          Revenue this week
        </h3>

        <BarChart
          data={vendorRevenue7d}
          xKey="day"
          yKey="revenue"
        />

      </div>



      <div>

        <h3 className="section-title mb-3">
          Today's orders
        </h3>


        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">

          {ordersLoading ? (

            <div className="skeleton h-24" />

          ) : todaysList.length === 0 ? (

            <p className="text-sm text-ink-muted">
              No orders placed today yet.
            </p>

          ) : (

            todaysList.map((o) => (
              <OrderCard
                key={o.id}
                order={{
                  ...o,
                  status: o.subOrder.status,
                }}
              />
            ))

          )}

        </div>

      </div>


    </div>
  );
}
