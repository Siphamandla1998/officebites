import { FiHeart } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import FoodCard from "../../components/features/FoodCard";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { foodService } from "../../services/foodService";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { useState } from "react";

export default function Favourites() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const [favIds, setFavIds] = useState(user?.favouriteMealIds || []);
  const { data: meals, loading } = useAsync(() => foodService.getMeals(), []);

  const favourites = (meals || []).filter((m) => favIds.includes(m.id));

  const toggleFav = (meal) => {
    setFavIds((prev) =>
      prev.includes(meal.id) ? prev.filter((id) => id !== meal.id) : [...prev, meal.id]
    );
  };

  return (
    <div>
      <Navbar showBack title="Favourites" showCart={false} />
      <div className="ob-container pt-4 pb-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-52" />)}
          </div>
        ) : favourites.length === 0 ? (
          <EmptyState
            icon={<FiHeart size={20} />}
            title="No favourites yet"
            description="Tap the heart on any meal to save it here."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {favourites.map((m) => (
              <FoodCard
                key={m.id}
                meal={m}
                onAdd={(meal) => {
                  addItem(meal);
                  showToast(`Added ${meal.name} to cart`, { type: "success" });
                }}
                isFavourite
                onToggleFavourite={toggleFav}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
