import {
  FiTrendingUp,
  FiDollarSign,
  FiShoppingBag,
  FiCreditCard,
} from "react-icons/fi";
import LineChart from "../../components/charts/LineChart";
import BarChart from "../../components/charts/BarChart";
import StatCard from "../../components/ui/StatCard";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { adminService } from "../../services/adminService";
import { formatCurrency } from "../../utils/formatters";

export default function AdminAnalytics() {
  const {
    data: analytics,
    loading,
  } = useAsync(
    () => adminService.getPlatformAnalytics(28),
    []
  );

  const {
    data: categories = [],
    loading: categoriesLoading,
  } = useAsync(
    () => adminService.getCategoryDemand(28),
    []
  );

  const topVendors =
    analytics?.topVendors?.map((vendor) => ({
      name: vendor.name,
      gmv: vendor.gmv,
    })) || [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="page-title">
          Analytics
        </h1>

        <p className="text-sm text-ink-muted">
          Real marketplace performance from the last
          28 days.
        </p>
      </div>

      {loading ? (
        <div className="skeleton h-24" />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatCard
            label="GMV"
            value={formatCurrency(
              analytics?.gmv || 0
            )}
            icon={FiShoppingBag}
          />

          <StatCard
            label="Gross commission"
            value={formatCurrency(
              analytics?.grossCommission || 0
            )}
            icon={FiDollarSign}
            trend="17% marketplace rate"
          />

          <StatCard
            label="PayFast fees"
            value={formatCurrency(
              analytics?.processorFees || 0
            )}
            icon={FiCreditCard}
          />

          <StatCard
            label="Net marketplace revenue"
            value={formatCurrency(
              analytics?.netMarketplaceRevenue || 0
            )}
            icon={FiTrendingUp}
          />
        </div>
      )}

      <div className="card p-5">
        <h3 className="section-title mb-1">
          Marketplace GMV
        </h3>

        <p className="text-xs text-ink-muted mb-4">
          Confirmed marketplace sales by week.
        </p>

        {loading ? (
          <div className="skeleton h-36" />
        ) : !analytics?.weekly?.length ? (
          <EmptyState
            title="Not enough sales data yet"
            description="Weekly GMV will appear as real PayFast-confirmed orders are processed."
          />
        ) : (
          <LineChart
            data={analytics.weekly}
            xKey="week"
            yKey="gmv"
          />
        )}
      </div>

      <div className="card p-5">
        <h3 className="section-title mb-1">
          Top vendors by GMV
        </h3>

        <p className="text-xs text-ink-muted mb-4">
          Based on actual marketplace sales, not
          ratings or menu size.
        </p>

        {loading ? (
          <div className="skeleton h-36" />
        ) : topVendors.length === 0 ? (
          <EmptyState
            title="No vendor sales yet"
            description="Vendor rankings will appear after confirmed orders."
          />
        ) : (
          <BarChart
            data={topVendors}
            xKey="name"
            yKey="gmv"
            formatValue={formatCurrency}
          />
        )}
      </div>

      <div className="card p-5">
        <h3 className="section-title mb-1 flex items-center gap-2">
          <FiTrendingUp
            size={15}
            className="text-nude-600"
          />
          Category demand
        </h3>

        <p className="text-xs text-ink-muted mb-4">
          What customers actually bought during the
          last 28 days.
        </p>

        {categoriesLoading ? (
          <div className="skeleton h-20" />
        ) : categories.length === 0 ? (
          <EmptyState
            title="No category demand yet"
            description="Demand will be calculated from completed marketplace purchases."
          />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {categories.map((item) => (
              <div
                key={item.category}
                className="rounded-xl bg-nude-50 p-3"
              >
                <p className="text-xs text-ink-muted">
                  {item.category}
                </p>

                <p className="text-lg font-bold text-ink mt-1">
                  {item.units} sold
                </p>

                <p className="text-xs text-ink-muted mt-1">
                  {formatCurrency(item.revenue)} GMV
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}