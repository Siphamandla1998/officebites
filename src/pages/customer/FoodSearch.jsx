import { useSearchParams } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import SearchBar from "../../components/ui/SearchBar";
import FoodCard from "../../components/features/FoodCard";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { foodService } from "../../services/foodService";
import { nextOrderableDate } from "../../utils/orderRules";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { FiSearch } from "react-icons/fi";

export default function FoodSearch() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const debouncedQuery = useDebounce(query, 300);
  const { addItem } = useCart();
  const { showToast } = useToast();

  const { data: meals, loading } = useAsync(
    () => foodService.getMeals({ search: debouncedQuery || undefined, forDate: nextOrderableDate() }),
    [debouncedQuery]
  );

  return (
    <div>
      <Navbar showBack title="Search meals" />
      <div className="ob-container pt-4 pb-8 flex flex-col gap-4">
        <SearchBar value={query} onChange={(value) => setParams(value ? { q: value } : {})} />

        {loading ? (
          <div className="grid grid-cols-2 gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-52" />)}
          </div>
        ) : !query.trim() ? (
          <EmptyState icon={<FiSearch size={20} />} title="Search for a meal" description="Try a dish, ingredient, or vendor's specialty." />
        ) : meals.length === 0 ? (
          <EmptyState
            icon={<FiSearch size={20} />}
            title="No meals found"
            description="Try a different search term, or browse vendors directly."
          />
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
