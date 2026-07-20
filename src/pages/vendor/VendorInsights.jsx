import { FiTrendingUp } from "react-icons/fi";
import Rating from "../../components/ui/Rating";
import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { useAuth } from "../../context/AuthContext";
import { formatCurrency } from "../../utils/formatters";

export default function VendorInsights() {
  const { user } = useAuth();
  const { data: menu, loading } = useAsync(() => vendorService.getVendorMenu(user.vendorId), [user.vendorId]);

  const ranked = [...(menu || [])].sort((a, b) => b.rating - a.rating);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Popular meals</h1>
        <p className="text-sm text-ink-muted mt-0.5">Ranked by customer rating and demand.</p>
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {ranked.map((meal, i) => (
            <div key={meal.id} className="flex items-center gap-3.5 p-4">
              <span className="h-8 w-8 rounded-full bg-nude-100 text-nude-700 text-sm font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <img src={meal.image} alt={meal.name} className="h-12 w-12 rounded-lg object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{meal.name}</p>
                <Rating value={meal.rating} count={meal.reviewCount} />
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-ink">{formatCurrency(meal.price)}</p>
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
