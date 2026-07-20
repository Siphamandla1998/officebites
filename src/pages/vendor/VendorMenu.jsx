import { FiPlus, FiEdit2 } from "react-icons/fi";
import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { formatCurrency } from "../../utils/formatters";

export default function VendorMenu() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: menu, loading, refetch } = useAsync(
    () => vendorService.getVendorMenu(user.vendorId),
    [user.vendorId]
  );

  const toggleAvailability = async (meal) => {
    await vendorService.updateMealAvailability(meal.id, !meal.available);
    showToast(`${meal.name} marked ${!meal.available ? "available" : "sold out"}`, { type: "info" });
    refetch();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Menu</h1>
          <p className="text-sm text-ink-muted mt-0.5">Manage what customers can order today.</p>
        </div>
        <button className="btn-primary !px-4 !py-2.5 text-sm">
          <FiPlus size={15} /> Add meal
        </button>
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {menu.map((meal) => (
            <div key={meal.id} className="card overflow-hidden">
              <div className="relative">
                <img src={meal.image} alt={meal.name} className="h-32 w-full object-cover" />
                <button className="absolute top-2 right-2 btn-icon !h-8 !w-8">
                  <FiEdit2 size={13} />
                </button>
              </div>
              <div className="p-3.5">
                <h4 className="text-sm font-semibold text-ink truncate">{meal.name}</h4>
                <p className="text-sm font-semibold text-nude-700 mt-1">{formatCurrency(meal.price)}</p>
                <label className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                  <span className="text-xs text-ink-muted">{meal.available ? "Available" : "Sold out"}</span>
                  <button
                    onClick={() => toggleAvailability(meal)}
                    className={`h-6 w-11 rounded-full relative transition-colors ${
                      meal.available ? "bg-ink" : "bg-nude-200"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-paper-raised shadow transition-transform ${
                        meal.available ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
