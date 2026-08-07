import { FiTrendingUp } from "react-icons/fi";
import LineChart from "../../components/charts/LineChart";
import BarChart from "../../components/charts/BarChart";
import { useAsync } from "../../hooks/useAsync";
import { adminService } from "../../services/adminService";
import { vendorService } from "../../services/vendorService";
import { foodService } from "../../services/foodService";

export default function AdminAnalytics() {
  const { data: revenue, loading: revenueLoading } = useAsync(() => adminService.getRevenueReport(), []);
  const { data: vendors, loading: vendorsLoading } = useAsync(
    () => vendorService.getVendors({}),
    []
  );
  const { data: meals, loading: mealsLoading } = useAsync(() => foodService.getMeals(), []);

  const topVendors = (vendors || [])
    .slice()
    .sort((a, b) => b.rating * b.reviewCount - a.rating * a.reviewCount)
    .slice(0, 5)
    .map((v) => ({ name: v.name, score: Math.round(v.rating * v.reviewCount) }));

  const categoryCounts = (meals || []).reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Analytics</h1>
        <p className="text-sm text-ink-muted mt-0.5">Platform-wide performance trends.</p>
      </div>

      <div className="card p-5">
        <h3 className="section-title mb-4">Commission revenue trend</h3>
        {revenueLoading ? <div className="skeleton h-36" /> : <LineChart data={revenue || []} xKey="week" yKey="commission"/>
      </div>

      <div className="card p-5">
        <h3 className="section-title mb-4">Top performing vendors</h3>
        {vendorsLoading ? (
          <div className="skeleton h-36" />
        ) : topVendors.length === 0 ? (
          <p className="text-sm text-ink-muted">No approved vendors yet.</p>
        ) : (
          <BarChart data={topVendors} xKey="name" yKey="score" formatValue={(v) => `${v} pts`} />
        )}
      </div>

      <div className="card p-5">
        <h3 className="section-title mb-4 flex items-center gap-2">
          <FiTrendingUp size={15} className="text-nude-600" /> Category demand
        </h3>
        {mealsLoading ? (
          <div className="skeleton h-20" />
        ) : Object.keys(categoryCounts).length === 0 ? (
          <p className="text-sm text-ink-muted">No meals listed yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <div key={cat} className="rounded-xl bg-nude-50 p-3">
                <p className="text-xs text-ink-muted">{cat}</p>
                <p className="text-lg font-bold text-ink">{count} meals</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
