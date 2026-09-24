import { useState } from "react";
import {
  FiTrendingUp,
  FiDollarSign,
  FiShoppingBag,
  FiBarChart2,
  FiLock,
  FiBriefcase,
} from "react-icons/fi";

import Filters from "../../components/ui/Filters";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency } from "../../utils/formatters";

const PERIODS = [
  "today",
  "week",
  "month",
  "all",
];

const PERIOD_LABELS = {
  today: "Today",
  week: "This week",
  month: "This month",
  all: "All time",
};

const ANALYTICS_DAYS = {
  today: 1,
  week: 7,
  month: 30,
  all: 365,
};

function MetricCard({
  icon,
  label,
  value,
  description,
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-ink-muted">
            {label}
          </p>

          <p className="text-xl font-bold text-ink mt-1">
            {value}
          </p>
        </div>

        <div className="h-9 w-9 rounded-xl bg-nude-100 flex items-center justify-center text-nude-700 shrink-0">
          {icon}
        </div>
      </div>

      {description && (
        <p className="text-[11px] text-ink-muted mt-2">
          {description}
        </p>
      )}
    </div>
  );
}

export default function VendorInsights() {
  const { user } = useAuth();

  const [period, setPeriod] =
    useState("month");

  const {
    data: vendor,
    loading: vendorLoading,
  } = useAsync(
    () =>
      vendorService.getVendorById(
        user.vendorId
      ),
    [user.vendorId]
  );

  const {
    data: ranked,
    loading: mealsLoading,
  } = useAsync(
    () =>
      vendorService.getPopularMealsForVendor(
        user.vendorId,
        period
      ),
    [user.vendorId, period]
  );

  const analyticsEnabled =
    vendor?.analyticsEnabled === true;

  const {
    data: analytics,
    loading: analyticsLoading,
  } = useAsync(
    () => {
      if (!analyticsEnabled) {
        return Promise.resolve(null);
      }

      return vendorService.getVendorAnalytics(
        user.vendorId,
        ANALYTICS_DAYS[period]
      );
    },
    [
      user.vendorId,
      period,
      analyticsEnabled,
    ]
  );

  const withSales = (ranked || []).filter(
    (result) => result.salesCount > 0
  );

  if (vendorLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="skeleton h-20" />
        <div className="skeleton h-40" />
        <div className="skeleton h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">
            Insights
          </h1>

          <p className="text-sm text-ink-muted mt-0.5">
            Understand how your food is performing
            on OfficeBites.
          </p>
        </div>

        <span className="shrink-0 rounded-full bg-nude-100 px-3 py-1 text-[11px] font-semibold text-nude-700 capitalize">
          {vendor?.plan || "marketplace"}
        </span>
      </div>

      {/* Period filter */}

      <Filters
        options={PERIODS.filter(
          (item) => item !== "all"
        )}
        active={
          period === "all"
            ? "all"
            : period
        }
        onChange={setPeriod}
        allLabel={PERIOD_LABELS.all}
        labels={PERIOD_LABELS}
      />

      {/* Growth analytics */}

      {analyticsEnabled ? (
        analyticsLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map(
              (_, index) => (
                <div
                  key={index}
                  className="skeleton h-28"
                />
              )
            )}
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    Financial performance
                  </h2>

                  <p className="text-xs text-ink-muted mt-0.5">
                    Calculated from confirmed
                    OfficeBites orders.
                  </p>
                </div>

                <span className="text-[10px] font-semibold uppercase tracking-wide text-nude-700">
                  Growth analytics
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricCard
                  icon={
                    <FiDollarSign size={16} />
                  }
                  label="Gross sales"
                  value={formatCurrency(
                    analytics?.grossRevenue || 0
                  )}
                  description="Customer spend before marketplace commission."
                />

                <MetricCard
                  icon={
                    <FiShoppingBag size={16} />
                  }
                  label="Orders"
                  value={
                    analytics?.orders || 0
                  }
                  description="Paid orders in this period."
                />

                <MetricCard
                  icon={
                    <FiBarChart2 size={16} />
                  }
                  label="Average order"
                  value={formatCurrency(
                    analytics?.averageOrderValue ||
                      0
                  )}
                  description="Average value of paid orders."
                />

                <MetricCard
                  icon={
                    <FiTrendingUp size={16} />
                  }
                  label="Estimated vendor net"
                  value={formatCurrency(
                    analytics?.vendorNet || 0
                  )}
                  description="Gross sales less OfficeBites marketplace commission."
                />
              </div>
            </div>

            <div className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-ink-muted">
                    OfficeBites marketplace commission
                  </p>

                  <p className="text-lg font-bold text-ink mt-1">
                    {formatCurrency(
                      analytics?.platformCommission ||
                        0
                    )}
                  </p>
                </div>

                <span className="rounded-full bg-nude-100 px-2.5 py-1 text-[10px] font-medium text-nude-700">
                  {Math.round(
                    (vendor?.commissionRate ||
                      0.17) * 100
                  )}
                  %
                </span>
              </div>

              <p className="text-[11px] text-ink-muted mt-2">
                Your applicable marketplace
                commission rate is stored against your
                vendor account.
              </p>
            </div>
          </>
        )
      ) : (
        <div className="card overflow-hidden">
          <div className="p-5">
            <div className="h-10 w-10 rounded-xl bg-nude-100 flex items-center justify-center text-nude-700">
              <FiLock size={17} />
            </div>

            <h2 className="text-base font-bold text-ink mt-4">
              Unlock deeper business analytics
            </h2>

            <p className="text-sm text-ink-muted mt-1.5 max-w-xl">
              Growth vendors can access deeper
              financial performance, longer-term
              insights and business intelligence
              designed to help improve their
              performance on OfficeBites.
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mt-5">
              <div className="rounded-xl bg-nude-50 p-3">
                <FiTrendingUp
                  size={15}
                  className="text-nude-700"
                />

                <p className="text-xs font-semibold text-ink mt-2">
                  Deeper analytics
                </p>

                <p className="text-[11px] text-ink-muted mt-1">
                  Understand sales and financial
                  performance over time.
                </p>
              </div>

              <div className="rounded-xl bg-nude-50 p-3">
                <FiBarChart2
                  size={15}
                  className="text-nude-700"
                />

                <p className="text-xs font-semibold text-ink mt-2">
                  Recommendations
                </p>

                <p className="text-[11px] text-ink-muted mt-1">
                  Receive recommendations when
                  OfficeBites has enough real data to
                  support them.
                </p>
              </div>

              <div className="rounded-xl bg-nude-50 p-3">
                <FiBriefcase
                  size={15}
                  className="text-nude-700"
                />

                <p className="text-xs font-semibold text-ink mt-2">
                  Corporate opportunities
                </p>

                <p className="text-[11px] text-ink-muted mt-1">
                  Eligible Growth vendors can receive
                  priority access to qualified
                  corporate opportunities.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real meal performance */}

      <div>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-ink">
            Popular meals
          </h2>

          <p className="text-xs text-ink-muted mt-0.5">
            Ranked using actual units sold in the
            selected period.
          </p>
        </div>

        {mealsLoading ? (
          <div className="skeleton h-64" />
        ) : withSales.length === 0 ? (
          <EmptyState
            icon={
              <FiTrendingUp size={20} />
            }
            title="No sales in this period yet"
            description="There isn't enough sales activity to rank your meals for this period."
          />
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {withSales.map(
              (
                {
                  meal,
                  salesCount,
                  revenue,
                  popularityPct,
                },
                index
              ) => (
                <div
                  key={meal.id}
                  className="flex items-center gap-3.5 p-4"
                >
                  <span className="h-8 w-8 rounded-full bg-nude-100 text-nude-700 text-sm font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>

                  <img
                    src={meal.image}
                    alt={meal.name}
                    className="h-12 w-12 rounded-lg object-cover shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">
                      {meal.name}
                    </p>

                    <p className="text-xs text-ink-muted">
                      {salesCount} sold ·{" "}
                      {popularityPct}% of units
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-ink">
                      {formatCurrency(revenue)}
                    </p>

                    {index === 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-success font-medium">
                        <FiTrendingUp
                          size={11}
                        />
                        Top seller
                      </span>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}