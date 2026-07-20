import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMapPin, FiChevronRight } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import SearchBar from "../../components/ui/SearchBar";
import CategoryCard from "../../components/features/CategoryCard";
import VendorCard from "../../components/features/VendorCard";
import FoodCard from "../../components/features/FoodCard";
import { useAsync } from "../../hooks/useAsync";
import { foodService } from "../../services/foodService";
import { vendorService } from "../../services/vendorService";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { isOrderingOpen } from "../../utils/orderRules";

export default function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { showToast } = useToast();

  const { data: categories, loading: catLoading } = useAsync(() => foodService.getCategories(), []);
  const { data: featuredVendors, loading: vendorLoading } = useAsync(
    () => vendorService.getFeaturedVendors(),
    []
  );
  const { data: popularMeals, loading: mealsLoading } = useAsync(
    () => foodService.getPopularMeals(6),
    []
  );

  const orderingOpen = isOrderingOpen(new Date());

  const handleAdd = (meal) => {
    addItem(meal);
    showToast(`Added ${meal.name} to cart`, { type: "success" });
  };

  const goToSearch = () => {
    if (query.trim()) navigate(`/vendors?q=${encodeURIComponent(query)}`);
  };

  return (
    <div>
      <Navbar />
      <div className="ob-container pt-1 pb-5">
        <div className="flex items-center gap-1.5 text-xs text-ink-muted mb-1">
          <FiMapPin size={13} />
          {user?.building || "Set your building"}
        </div>
        <h2 className="text-xl font-bold text-ink tracking-tight">
          Hey {user?.name?.split(" ")[0] || "there"}, hungry?
        </h2>

        {!orderingOpen && (
          <div className="mt-3 rounded-xl bg-nude-100 text-nude-800 text-xs px-3.5 py-2.5">
            Today's ordering window has closed. Orders now go toward the next available delivery day.
          </div>
        )}

        <div className="mt-4">
          <SearchBar
            value={query}
            onChange={setQuery}
            onKeyDown={(e) => e.key === "Enter" && goToSearch()}
          />
        </div>
      </div>

      {/* Categories */}
      <section className="pb-6">
        <div className="ob-container flex items-center justify-between mb-3">
          <h3 className="section-title">Categories</h3>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar px-5 pb-1">
          {catLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-16 w-16 rounded-2xl shrink-0" />
              ))
            : categories.map((c) => <CategoryCard key={c.id} category={c} />)}
        </div>
      </section>

      {/* Featured vendors */}
      <section className="pb-6">
        <div className="ob-container flex items-center justify-between mb-3">
          <h3 className="section-title">Featured vendors</h3>
          <button onClick={() => navigate("/vendors")} className="section-link flex items-center gap-0.5">
            See all <FiChevronRight size={12} />
          </button>
        </div>
        <div className="flex gap-3.5 overflow-x-auto no-scrollbar px-5 pb-1">
          {vendorLoading
            ? Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="skeleton h-40 w-64 shrink-0" />
              ))
            : featuredVendors.map((v) => <VendorCard key={v.id} vendor={v} />)}
        </div>
      </section>

      {/* Popular meals */}
      <section className="pb-8">
        <div className="ob-container flex items-center justify-between mb-3">
          <h3 className="section-title">Popular right now</h3>
        </div>
        <div className="ob-container grid grid-cols-2 gap-3.5">
          {mealsLoading
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-52" />)
            : popularMeals.map((m) => <FoodCard key={m.id} meal={m} onAdd={handleAdd} />)}
        </div>
      </section>
    </div>
  );
}
