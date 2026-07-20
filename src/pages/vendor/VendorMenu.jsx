import { useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiStar, FiShoppingBag } from "react-icons/fi";
import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { formatCurrency } from "../../utils/formatters";
import MealFormModal from "../../components/features/MealFormModal";
import EmptyState from "../../components/ui/EmptyState";

export default function VendorMenu() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: menu, loading, refetch } = useAsync(
    () => vendorService.getVendorMenu(user.vendorId),
    [user.vendorId]
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditingMeal(null);
    setFormOpen(true);
  };

  const openEdit = (meal) => {
    setEditingMeal(meal);
    setFormOpen(true);
  };

  const handleSave = async (formData) => {
    setSaving(true);
    try {
      if (editingMeal) {
        await vendorService.updateMeal(editingMeal.id, formData);
        showToast(`${formData.name} updated`, { type: "success" });
      } else {
        await vendorService.addMeal(user.vendorId, formData);
        showToast(`${formData.name} added to your menu`, { type: "success" });
      }
      setFormOpen(false);
      refetch();
    } catch (err) {
      showToast(err.message || "Couldn't save meal", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (meal) => {
    if (!window.confirm(`Remove "${meal.name}" from your menu? This can't be undone.`)) return;
    await vendorService.deleteMeal(meal.id);
    showToast(`${meal.name} removed`, { type: "info" });
    refetch();
  };

  const toggleAvailability = async (meal) => {
    await vendorService.updateMealAvailability(meal.id, !meal.available);
    showToast(`${meal.name} marked ${!meal.available ? "available" : "sold out"}`, { type: "info" });
    refetch();
  };

  const toggleFeatured = async (meal) => {
    await vendorService.updateMealFeatured(meal.id, !meal.featured);
    showToast(`${meal.name} ${!meal.featured ? "featured" : "unfeatured"}`, { type: "info" });
    refetch();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Menu</h1>
          <p className="text-sm text-ink-muted mt-0.5">Manage what customers can order today.</p>
        </div>
        <button onClick={openAdd} className="btn-primary !px-4 !py-2.5 text-sm">
          <FiPlus size={15} /> Add meal
        </button>
      </div>

      {loading ? (
        <div className="skeleton h-64" />
      ) : menu.length === 0 ? (
        <EmptyState
          icon={<FiShoppingBag size={20} />}
          title="Your menu is empty"
          description="Add your first meal to start receiving orders."
          action={
            <button onClick={openAdd} className="btn-primary">
              <FiPlus size={15} /> Add meal
            </button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {menu.map((meal) => (
            <div key={meal.id} className="card overflow-hidden">
              <div className="relative">
                <img src={meal.image} alt={meal.name} className="h-32 w-full object-cover" />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    onClick={() => toggleFeatured(meal)}
                    className={`btn-icon !h-8 !w-8 ${meal.featured ? "!bg-nude-500 !text-paper !border-nude-500" : ""}`}
                    aria-label="Toggle featured"
                    title="Toggle featured"
                  >
                    <FiStar size={13} />
                  </button>
                  <button onClick={() => openEdit(meal)} className="btn-icon !h-8 !w-8" aria-label="Edit meal">
                    <FiEdit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(meal)}
                    className="btn-icon !h-8 !w-8 !text-danger"
                    aria-label="Delete meal"
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
                {meal.featured && (
                  <span className="absolute bottom-2 left-2 badge bg-nude-500 text-paper">Featured</span>
                )}
              </div>
              <div className="p-3.5">
                <h4 className="text-sm font-semibold text-ink truncate">{meal.name}</h4>
                <p className="text-xs text-ink-muted mt-0.5">{meal.category}</p>
                <p className="text-sm font-semibold text-nude-700 mt-1">{formatCurrency(meal.price)}</p>
                <label className="flex items-center justify-between mt-3 pt-3 border-t border-line">
                  <span className="text-xs text-ink-muted">{meal.available ? "Available" : "Sold out"}</span>
                  <button
                    onClick={() => toggleAvailability(meal)}
                    aria-pressed={meal.available}
                    aria-label={`Mark ${meal.name} as ${meal.available ? "sold out" : "available"}`}
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

      <MealFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        meal={editingMeal}
        saving={saving}
      />
    </div>
  );
}
