import { useState } from "react";
import { FiTrendingUp } from "react-icons/fi";
import Filters from "../../components/ui/Filters";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency } from "../../utils/formatters";

const PERIODS = ["today", "week", "month", "all"];
const PERIOD_LABELS = { today: "Today", week: "This week", month: "This month", all: "All time" };

export default function VendorInsights() {
  const { user } = useAuth();
  const [period, setPeriod] = useState("all");
  const { data: ranked, loading } = useAsync(
    () => vendorService.getPopularMealsForVendor(user.vendorId, period),
    [user.vendorId, period]
  );

  const withSales = (ranked || []).filter((r) => r.salesCount > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Popular meals</h1>
        <p className="text-sm text-ink-muted mt-0.5">Ranked by units sold in the selected period.</p>
      </div>

      <Filters
        options={PERIODS.filter((p) => p !== "all")}
        active={period === "all" ? "all" : period}
        onChange={setPeriod}
        allLabel={PERIOD_LABELS.all}
        labels={PERIOD_LABELS}
      />

      {loading ? (
        <div className="skeleton h-64" />
      ) : withSales.length === 0 ? (
        <EmptyState
          icon={<FiTrendingUp size={20} />}
          title="No sales in this period yet"
          description="Try a wider time range, like All time."
        />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {withSales.map(({ meal, salesCount, revenue, popularityPct }, i) => (
            <div key={meal.id} className="flex items-center gap-3.5 p-4">
              <span className="h-8 w-8 rounded-full bg-nude-100 text-nude-700 text-sm font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <img src={meal.image} alt={meal.name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{meal.name}</p>
                <p className="text-xs text-ink-muted">{salesCount} sold · {popularityPct}% of units</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-ink">{formatCurrency(revenue)}</p>
                {i === 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-success font-medium">
                    <FiTrendingUp size={11} /> Top seller
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
