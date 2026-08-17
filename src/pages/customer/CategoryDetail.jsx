import { useParams } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import FoodCard from "../../components/features/FoodCard";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { foodService, CATEGORIES } from "../../services/foodService";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { FiSearch } from "react-icons/fi";

export default function CategoryDetail() {
  const { id } = useParams();
  const category = CATEGORIES.find((c) => c.id === id);
  const { addItem } = useCart();
  const { showToast } = useToast();

  const { data: meals, loading } = useAsync(
    () => foodService.getMeals({ category: category?.name }),
    [category?.name]
  );

  return (
    <div>
      <Navbar showBack title={category ? `${category.emoji} ${category.name}` : "Category"} />
      <div className="ob-container pt-4 pb-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-52" />)}
          </div>
        ) : meals.length === 0 ? (
          <EmptyState icon={<FiSearch size={20} />} title="Nothing here yet" description="Check back soon for new meals." />
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {meals.map((m) => (
              <FoodCard
                key={m.id}
                meal={m}
                onAdd={(meal) => {
                  addItem(meal);
                  showToast(`Added ${meal.name} to cart`, { type: "success" });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
