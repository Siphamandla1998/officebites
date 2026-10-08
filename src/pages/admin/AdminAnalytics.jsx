import RequestError from '../../components/ui/RequestError';
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
    loading, error, refetch,
  } = useAsync(
    () => adminService.getPlatformAnalytics('month'),
    []
  );

  const {
    data: categories = [],
    loading: categoriesLoading, error: categoriesError, refetch: retryCategories,
  } = useAsync(
    () => adminService.getCategoryDemand('month'),
    []
  );

  const topVendors =
    analytics?.topVendors?.map((vendor) => ({
      name: vendor.name,
      gmv: vendor.gmv,
    })) || [];

  if (error || categoriesError) return <RequestError error={error || categoriesError} onRetry={() => { refetch(); retryCategories(); }} />;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="page-title">
          Analytics
        </h1>

        <p className="text-sm text-ink-muted">
          Paid business performance this SAST calendar month.
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
              analytics?.grossCommission
            )}
            icon={FiDollarSign}
            trend="Historical commission snapshots"
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
              analytics?.netMarketplaceRevenue
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
          current SAST calendar month.
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