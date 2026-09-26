import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  FiArrowRight,
  FiClock,
  FiMapPin,
  FiSearch,
  FiShoppingBag,
} from "react-icons/fi";

import SearchBar from "../../components/ui/SearchBar";
import CategoryCard from "../../components/features/CategoryCard";
import FoodCard from "../../components/features/FoodCard";
import BrandMark from "../../components/layout/BrandMark";

import { foodService, CATEGORIES } from "../../services/foodService";
import { useAsync } from "../../hooks/useAsync";

import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { useLocation } from "../../context/LocationContext";

import {
  nextOrderableDate,
  isPastTodaysCutoff,
} from "../../utils/orderRules";

import { formatDate } from "../../utils/formatters";

function MealSkeleton({ wide = false }) {
  return (
    <div
      className={`skeleton rounded-2xl shrink-0 ${
        wide ? "h-56 w-56" : "h-52"
      }`}
    />
  );
}

export default function Home() {
  const [query, setQuery] = useState("");

  const navigate = useNavigate();

  const { user, isAuthenticated } = useAuth();
  const { addItem, itemCount } = useCart();
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

  const nextDelivery = useMemo(() => nextOrderableDate(), []);

  const {
    data: upcomingMeals = [],
    loading: upcomingLoading,
  } = useAsync(
    () =>
      foodService.getMeals({
        forDate: nextDelivery,
        latitude: hasLocation ? latitude : undefined,
        longitude: hasLocation ? longitude : undefined,
      }),
    [nextDelivery, hasLocation, latitude, longitude]
  );

  const {
    data: catalogueMeals = [],
    loading: catalogueLoading,
  } = useAsync(
    () =>
      foodService.getPopularMeals(6, {
        latitude: hasLocation ? latitude : undefined,
        longitude: hasLocation ? longitude : undefined,
      }),
    [hasLocation, latitude, longitude]
  );

  const handleUseLocation = async () => {
    const result = await requestLocation();

    if (result) {
      showToast("Showing food that can deliver to you", {
        type: "success",
      });
    }
  };

  const handleAdd = (meal) => {
    addItem(meal);

    showToast(`${meal.name} added to your cart`, {
      type: "success",
    });
  };

  const goToSearch = () => {
    const value = query.trim();

    if (!value) {
      navigate("/food/search");
      return;
    }

    navigate(`/food/search?q=${encodeURIComponent(value)}`);
  };

  const firstName =
    user?.name?.trim()?.split(/\s+/)?.[0] || "there";

  const deliveryLabel = formatDate(nextDelivery, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  return (
    <div className="app-safe-top">
      {/* =====================================================
          MARKETPLACE HEADER
      ====================================================== */}

      <header className="ob-container pt-5 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {isAuthenticated ? (
              <>
                <p className="text-xs text-ink-muted">
                  Good to see you
                </p>

                <h1 className="text-2xl font-bold tracking-tight text-ink mt-0.5">
                  {firstName}, what are you having?
                </h1>
              </>
            ) : (
              <>
                <BrandMark size="md" />

                <h1 className="text-2xl font-bold tracking-tight text-ink mt-5 max-w-sm">
                  Lunch at work,
                  <br />
                  made easier.
                </h1>

                <p className="text-sm leading-relaxed text-ink-muted mt-2 max-w-sm">
                  Browse local food vendors, order your lunch and
                  track everything from one place.
                </p>
              </>
            )}
          </div>

          {itemCount > 0 && (
            <div className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-3 py-1.5 text-xs font-semibold">
              <FiShoppingBag size={13} />
              {itemCount}
            </div>
          )}
        </div>

        {/* Delivery context */}
        <div className="mt-5 rounded-2xl border border-line bg-nude-50 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-nude-100 text-nude-700 flex items-center justify-center shrink-0">
              <FiClock size={16} />
            </div>

            <div className="min-w-0">
              <p className="text-xs text-ink-muted">
                Next available delivery
              </p>

              <p className="text-sm font-semibold text-ink mt-0.5">
                {deliveryLabel}
              </p>

              {isPastTodaysCutoff() && (
                <p className="text-xs text-ink-muted mt-1">
                  Today's ordering window has closed, so new
                  orders are being scheduled for the next
                  available delivery.
                </p>
              )}
            </div>
          </div>

          {isAuthenticated && user?.building && (
            <div className="flex items-center gap-1.5 text-xs text-ink-muted mt-3 pt-3 border-t border-line">
              <FiMapPin size={12} />
              <span className="truncate">
                Delivering to {user.building}
              </span>
            </div>
          )}
        </div>

        {/* Location discovery */}
        <div className="mt-4">
          {!hasLocation ? (
            <div className="rounded-2xl border border-line bg-paper-raised p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-nude-100 text-nude-700 flex items-center justify-center shrink-0">
                  <FiMapPin size={17} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    Find food that delivers to you
                  </p>

                  <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                    Use your current location to show vendors that
                    can deliver to where you are.
                  </p>

                  <button
                    type="button"
                    onClick={handleUseLocation}
                    disabled={requesting}
                    className="mt-3 text-xs font-semibold text-nude-700 disabled:opacity-50"
                  >
                    {requesting
                      ? "Finding your location..."
                      : "Use my location"}
                  </button>

                  {locationError && (
                    <p className="text-xs text-ink-muted mt-2 leading-relaxed">
                      {locationError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-nude-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FiMapPin
                    size={15}
                    className="text-nude-700 shrink-0"
                  />

                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink">
                      Nearby delivery enabled
                    </p>

                    <p className="text-[11px] text-ink-muted">
                      Showing vendors that deliver to your
                      current location.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearLocation}
                  className="text-xs font-semibold text-ink-muted shrink-0"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="mt-4">
          <SearchBar
            value={query}
            onChange={setQuery}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                goToSearch();
              }
            }}
          />

          <button
            type="button"
            onClick={goToSearch}
            className="sr-only"
          >
            Search
          </button>
        </div>

        {!isAuthenticated && (
          <div className="flex items-center justify-between gap-3 mt-4">
            <p className="text-xs text-ink-muted">
              No account needed to order.
            </p>

            <Link
              to="/login"
              className="text-xs font-semibold text-nude-700 whitespace-nowrap"
            >
              Sign in
            </Link>
          </div>
        )}
      </header>

      {/* =====================================================
          ORDERABLE NEXT
      ====================================================== */}

      <section className="pb-7">
        <div className="ob-container flex items-end justify-between gap-4 mb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-nude-700">
              Order next
            </p>

            <h2 className="text-lg font-bold text-ink mt-0.5">
              Available for {deliveryLabel}
            </h2>
          </div>

          <Link
            to="/food/search"
            className="text-xs font-semibold text-ink-muted flex items-center gap-1 shrink-0"
          >
            See all
            <FiArrowRight size={13} />
          </Link>
        </div>

        {upcomingLoading ? (
          <div className="flex gap-3.5 overflow-hidden px-5">
            <MealSkeleton wide />
            <MealSkeleton wide />
          </div>
        ) : upcomingMeals.length === 0 ? (
          <div className="ob-container">
            <div className="rounded-2xl border border-line bg-paper-raised p-5">
              <div className="h-10 w-10 rounded-xl bg-nude-100 text-nude-700 flex items-center justify-center">
                {hasLocation ? (
                  <FiMapPin size={17} />
                ) : (
                  <FiClock size={17} />
                )}
              </div>

              <h3 className="text-sm font-semibold text-ink mt-3">
                {hasLocation
                  ? "No nearby delivery options yet"
                  : "Menus are still being prepared"}
              </h3>

              <p className="text-xs text-ink-muted leading-relaxed mt-1">
                {hasLocation
                  ? "No approved vendor currently delivers to this location for the next delivery day. You can clear your location to browse the full marketplace."
                  : "No vendor has published food for this delivery day yet. You can still browse the marketplace below."}
              </p>

              {hasLocation && (
                <button
                  type="button"
                  onClick={clearLocation}
                  className="text-xs font-semibold text-nude-700 mt-3"
                >
                  Browse all vendors
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-3.5 overflow-x-auto no-scrollbar px-5 pb-1">
            {upcomingMeals.map((meal) => (
              <FoodCard
                key={meal.id}
                meal={meal}
                onAdd={handleAdd}
                layout="row"
              />
            ))}
          </div>
        )}
      </section>

      {/* =====================================================
          CATEGORIES
      ====================================================== */}

      <section className="pb-7">
        <div className="ob-container mb-3">
          <h2 className="section-title">
            What are you in the mood for?
          </h2>
        </div>

        <div className="flex gap-4 overflow-x-auto no-scrollbar px-5 pb-1">
          {CATEGORIES.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
            />
          ))}
        </div>
      </section>

      {/* =====================================================
          DISCOVER MARKETPLACE
      ====================================================== */}

      <section className="pb-7">
        <div className="ob-container flex items-center justify-between gap-4 mb-3">
          <div>
            <h2 className="section-title">
              {hasLocation
                ? "Food near you"
                : "Explore more food"}
            </h2>

            <p className="text-xs text-ink-muted mt-0.5">
              {hasLocation
                ? "Meals from vendors that deliver to your location"
                : "More available meals from approved vendors"}
            </p>
          </div>

          <Link
            to="/vendors"
            className="text-xs font-semibold text-ink-muted flex items-center gap-1 shrink-0"
          >
            Vendors
            <FiArrowRight size={13} />
          </Link>
        </div>

        {catalogueLoading ? (
          <div className="ob-container grid grid-cols-2 gap-3.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <MealSkeleton key={index} />
            ))}
          </div>
        ) : catalogueMeals.length === 0 ? (
          <div className="ob-container">
            <div className="rounded-2xl border border-line p-5 text-center">
              {hasLocation ? (
                <FiMapPin
                  size={20}
                  className="mx-auto text-ink-muted"
                />
              ) : (
                <FiSearch
                  size={20}
                  className="mx-auto text-ink-muted"
                />
              )}

              <p className="text-sm font-semibold text-ink mt-3">
                {hasLocation
                  ? "Nothing nearby yet"
                  : "Nothing else listed yet"}
              </p>

              <p className="text-xs text-ink-muted mt-1">
                {hasLocation
                  ? "There are no approved vendors delivering to your current location right now."
                  : "New vendor menus will appear here as they become available."}
              </p>

              {hasLocation && (
                <button
                  type="button"
                  onClick={clearLocation}
                  className="text-xs font-semibold text-nude-700 mt-3"
                >
                  Browse the full marketplace
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="ob-container grid grid-cols-2 gap-3.5">
            {catalogueMeals.map((meal) => (
              <FoodCard
                key={meal.id}
                meal={meal}
                onAdd={handleAdd}
              />
            ))}
          </div>
        )}
      </section>

      {/* =====================================================
          MARKETPLACE CTA
      ====================================================== */}

      <section className="ob-container pb-8">
        <Link
          to="/vendors"
          className="block rounded-2xl bg-ink text-paper p-5"
        >
          <p className="text-xs text-paper/60">
            OfficeBites marketplace
          </p>

          <div className="flex items-end justify-between gap-4 mt-1">
            <div>
              <h2 className="text-lg font-semibold">
                Browse by vendor
              </h2>

              <p className="text-xs text-paper/65 mt-1 max-w-xs leading-relaxed">
                See who's cooking, explore their menus and order
                directly from the vendors available on OfficeBites.
              </p>
            </div>

            <div className="h-9 w-9 rounded-full bg-paper text-ink flex items-center justify-center shrink-0">
              <FiArrowRight size={15} />
            </div>
          </div>
        </Link>
      </section>
    </div>
  );
}