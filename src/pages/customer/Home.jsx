import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import SearchBar from "../../components/ui/SearchBar";
import CategoryCard from "../../components/features/CategoryCard";
import FoodCard from "../../components/features/FoodCard";

import { useAsync } from "../../hooks/useAsync";
import { foodService } from "../../services/foodService";

import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";

import { nextOrderableDate, isPastTodaysCutoff } from "../../utils/orderRules";
import { formatDate } from "../../utils/formatters";
import { APP_NAME } from "../../utils/constants";

export default function Home() {
  const [query, setQuery] = useState("");

  const navigate = useNavigate();

  const { user, isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const { showToast } = useToast();


  const {
    data: categories = [],
    loading: catLoading,
  } = useAsync(
    () => foodService.getCategories(),
    []
  );


  const {
    data: upcomingMeals = [],
    loading: upcomingLoading,
  } = useAsync(
    () => foodService.getMeals({ forDate: nextOrderableDate() }),
    []
  );


  const {
    data: popularMeals = [],
    loading: mealsLoading,
  } = useAsync(
    // "Available Menus" is general catalogue discovery, deliberately NOT
    // filtered to the upcoming preorder date — that's what the section
    // above is for. Passing forDate here would make the two sections show
    // near-identical content.
    () => foodService.getPopularMeals(6),
    []
  );


  const nextDelivery = nextOrderableDate();

  // Group the upcoming day's orderable meals by vendor for the "Wednesday,
  // 26 August" style showcase — driven by actual availability data
  // (meals.available_days, see migration 0013) rather than a hard-coded
  // day/date the way "Featured vendors" used to be a fixed, uncurated list.
  const upcomingByVendor = (upcomingMeals || []).reduce((acc, meal) => {
    const key = meal.vendorId;
    if (!acc[key]) {
      acc[key] = { vendorId: meal.vendorId, vendorName: meal.vendorName, meals: [] };
    }
    acc[key].meals.push(meal);
    return acc;
  }, {});
  const upcomingVendorGroups = Object.values(upcomingByVendor);


  const handleAdd = (meal) => {
    addItem(meal);

    showToast(
      `Added ${meal.name} to cart`,
      {
        type: "success",
      }
    );
  };


  const goToSearch = () => {
    if (query.trim()) {
      navigate(
        `/food/search?q=${encodeURIComponent(query)}`
      );
    }
  };


  return (
    <div className="app-safe-top">
  
      {/* Header */}
      <div className="ob-container pt-6 pb-5">
  
        {isAuthenticated ? (
          <>
            <div className="text-sm text-ink-muted">
              {user?.building || "Set your building"}
            </div>
            <h1 className="text-2xl font-semibold mt-2">
              {`Hey ${user?.name?.split(" ")[0] || "there"}, hungry?`}
            </h1>
          </>
        ) : (
          <div className="flex flex-col items-center text-center pt-2 pb-3">
            <BrandMark size="md" tagline />
            <h1 className="text-xl font-bold mt-5 text-ink leading-snug">
              Order from local office vendors
            </h1>
            <p className="text-xs text-ink-muted mt-2 max-w-[280px]">
              No account needed —{" "}
              <Link to="/login" className="text-nude-600 font-medium">
                sign in
              </Link>{" "}
              anytime to save favourites and track orders.
            </p>
          </div>
        )}


        <div className="mt-3 rounded-xl bg-nude-100 text-nude-800 text-xs px-3.5 py-2.5">
          Ordering now for {formatDate(nextDelivery)} delivery
          {isPastTodaysCutoff() ? " — today's cutoff has passed" : ""}
        </div>


        <div className="mt-4">
          <SearchBar
            value={query}
            onChange={setQuery}
            onKeyDown={(e) =>
              e.key === "Enter" && goToSearch()
            }
          />
        </div>

      </div>



      {/* Categories */}
      <section className="pb-6">

        <div className="ob-container flex items-center justify-between mb-3">

          <h3 className="section-title">
            Categories
          </h3>

        </div>


        <div className="flex gap-4 overflow-x-auto no-scrollbar px-5 pb-1">

          {catLoading ? (

            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="skeleton h-16 w-16 rounded-2xl shrink-0"
              />
            ))

          ) : (

            (categories || []).map((category) => (
              <CategoryCard
                key={category.id || category.name}
                category={category}
              />
            ))

          )}

        </div>

      </section>




      {/* Upcoming preorder day */}
      <section className="pb-6">

        <div className="ob-container mb-3">

          <h3 className="section-title">
            {formatDate(nextDelivery, { weekday: "long", month: "long" })}
          </h3>

          <p className="text-xs text-ink-muted mt-0.5">
            Meals vendors have available to preorder for this day
          </p>

        </div>


        {upcomingLoading ? (

          <div className="flex gap-3.5 overflow-x-auto no-scrollbar px-5 pb-1">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="skeleton h-40 w-56 shrink-0" />
            ))}
          </div>

        ) : upcomingVendorGroups.length === 0 ? (

          <p className="ob-container text-sm text-ink-muted py-4">
            No vendors have posted a menu for this day yet — check back soon.
          </p>

        ) : (

          <div className="flex flex-col gap-5">
            {upcomingVendorGroups.map((group) => (
              <div key={group.vendorId}>
                <p className="ob-container text-xs font-semibold text-nude-700 uppercase tracking-wide mb-2">
                  {group.vendorName}
                </p>
                <div className="flex gap-3.5 overflow-x-auto no-scrollbar px-5 pb-1">
                  {group.meals.map((meal) => (
                    <FoodCard key={meal.id} meal={meal} onAdd={handleAdd} layout="row" />
                  ))}
                </div>
              </div>
            ))}
          </div>

        )}

      </section>





      {/* Available menus — general catalogue, not tied to a specific preorder date */}
      <section className="pb-8">

        <div className="ob-container flex items-center justify-between mb-3">

          <h3 className="section-title">
            Available Menus
          </h3>

        </div>



        <div className="ob-container grid grid-cols-2 gap-3.5">


          {mealsLoading ? (

            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="skeleton h-52"
              />
            ))

          ) : (

            (popularMeals || []).map((meal) => (
              <FoodCard
                key={meal.id}
                meal={meal}
                onAdd={handleAdd}
              />
            ))

          )}


        </div>

      </section>


    </div>
  );
}
