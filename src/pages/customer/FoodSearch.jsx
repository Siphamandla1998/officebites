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
import { useLocation } from "../../context/LocationContext";
import { FiMapPin, FiSearch } from "react-icons/fi";

export default function FoodSearch() {
  const [params, setParams] = useSearchParams();

  const query = params.get("q") || "";
  const debouncedQuery = useDebounce(query, 300);

  const { addItem } = useCart();
  const { showToast } = useToast();

  const {
    latitude,
    longitude,
    hasLocation,
    requesting,
    error: locationError,
    requestLocation,
    clearLocation,
  } = useLocation();

  const {
    data: meals = [],
    loading,
  } = useAsync(
    () =>
      foodService.getMeals({
        search:
          debouncedQuery || undefined,
        forDate: nextOrderableDate(),
        latitude:
          hasLocation
            ? latitude
            : undefined,
        longitude:
          hasLocation
            ? longitude
            : undefined,
      }),
    [
      debouncedQuery,
      hasLocation,
      latitude,
      longitude,
    ]
  );

  const handleUseLocation = async () => {
    await requestLocation();
  };

  return (
    <div>
      <Navbar
        showBack
        title="Search meals"
      />

      <div className="ob-container pt-4 pb-8 flex flex-col gap-4">
        <SearchBar
          value={query}
          onChange={(value) =>
            setParams(
              value
                ? { q: value }
                : {}
            )
          }
        />

        {!hasLocation ? (
          <div className="rounded-2xl border border-line bg-paper-raised px-4 py-3">
            <div className="flex items-start gap-3">
              <FiMapPin
                size={15}
                className="text-nude-700 mt-0.5 shrink-0"
              />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-ink">
                  Search nearby food
                </p>

                <p className="text-[11px] text-ink-muted mt-0.5">
                  Use your location to only see meals
                  from vendors that deliver to you.
                </p>

                <button
                  type="button"
                  onClick={handleUseLocation}
                  disabled={requesting}
                  className="text-xs font-semibold text-nude-700 mt-2 disabled:opacity-50"
                >
                  {requesting
                    ? "Finding your location..."
                    : "Use my location"}
                </button>

                {locationError && (
                  <p className="text-[11px] text-ink-muted mt-2">
                    {locationError}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-nude-50 border border-line px-3.5 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FiMapPin
                size={14}
                className="text-nude-700"
              />

              <span className="text-xs text-ink">
                Searching vendors that deliver to you
              </span>
            </div>

            <button
              type="button"
              onClick={clearLocation}
              className="text-xs font-semibold text-ink-muted shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3.5">
            {Array.from({ length: 4 }).map(
              (_, i) => (
                <div
                  key={i}
                  className="skeleton h-52"
                />
              )
            )}
          </div>
        ) : !query.trim() ? (
          <EmptyState
            icon={<FiSearch size={20} />}
            title="Search for a meal"
            description={
              hasLocation
                ? "Search for a dish or ingredient from vendors that deliver to you."
                : "Try a dish, ingredient, or vendor's specialty."
            }
          />
        ) : meals.length === 0 ? (
          <EmptyState
            icon={
              hasLocation ? (
                <FiMapPin size={20} />
              ) : (
                <FiSearch size={20} />
              )
            }
            title={
              hasLocation
                ? "No nearby meals found"
                : "No meals found"
            }
            description={
              hasLocation
                ? "No vendor delivering to your location matched this search. Try another meal or clear your location."
                : "Try a different search term, or browse vendors directly."
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {meals.map((meal) => (
              <FoodCard
                key={meal.id}
                meal={meal}
                onAdd={(selectedMeal) => {
                  addItem(selectedMeal);

                  showToast(
                    `Added ${selectedMeal.name} to cart`,
                    {
                      type: "success",
                    }
                  );
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}