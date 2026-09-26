import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import SearchBar from "../../components/ui/SearchBar";
import Filters from "../../components/ui/Filters";
import VendorCard from "../../components/features/VendorCard";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { vendorService } from "../../services/vendorService";
import { useLocation } from "../../context/LocationContext";
import { FiMapPin, FiSearch } from "react-icons/fi";

export default function VendorListing() {
  const [params] = useSearchParams();

  const [query, setQuery] = useState(params.get("q") || "");
  const [category, setCategory] = useState("all");

  const debouncedQuery = useDebounce(query, 300);

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
    data: vendors = [],
    loading,
  } = useAsync(
    async () => {
      const filters = {
        search: debouncedQuery || undefined,
        category:
          category === "all"
            ? undefined
            : category,
      };

      // Without a location, preserve the normal marketplace.
      if (!hasLocation) {
        return vendorService.getVendors(filters);
      }

      // Ask Supabase which vendors actually deliver to this location.
      const nearbyRows =
        await vendorService.getNearbyVendors(
          latitude,
          longitude,
          100
        );

      if (!nearbyRows.length) {
        return [];
      }

      // Fetch the normal vendor objects so VendorCard keeps receiving
      // exactly the structure it already expects.
      const allMatchingVendors =
        await vendorService.getVendors(filters);

      const distanceByVendorId = new Map(
        nearbyRows.map((row) => [
          row.id,
          row.distanceKm,
        ])
      );

      return allMatchingVendors
        .filter((vendor) =>
          distanceByVendorId.has(vendor.id)
        )
        .map((vendor) => ({
          ...vendor,
          distanceKm:
            distanceByVendorId.get(vendor.id) ??
            null,
        }))
        .sort(
          (a, b) =>
            (a.distanceKm ??
              Number.POSITIVE_INFINITY) -
            (b.distanceKm ??
              Number.POSITIVE_INFINITY)
        );
    },
    [
      debouncedQuery,
      category,
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
      <Navbar />

      <div className="ob-container mt-5">
        <div className="mb-4">
          {!hasLocation ? (
            <div className="rounded-2xl border border-line bg-paper-raised p-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-nude-100 text-nude-700 flex items-center justify-center shrink-0">
                  <FiMapPin size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    Find vendors that deliver to you
                  </p>

                  <p className="text-xs text-ink-muted mt-1">
                    Use your current location to filter
                    OfficeBites vendors by delivery area.
                  </p>

                  <button
                    type="button"
                    onClick={handleUseLocation}
                    disabled={requesting}
                    className="mt-2 text-xs font-semibold text-nude-700 disabled:opacity-50"
                  >
                    {requesting
                      ? "Finding your location..."
                      : "Use my location"}
                  </button>

                  {locationError && (
                    <p className="text-xs text-ink-muted mt-2">
                      {locationError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-nude-50 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FiMapPin
                  size={15}
                  className="text-nude-700 shrink-0"
                />

                <div>
                  <p className="text-xs font-semibold text-ink">
                    Showing vendors that deliver to you
                  </p>

                  <p className="text-[11px] text-ink-muted">
                    Nearest delivery options appear first.
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
          )}
        </div>

        <SearchBar
          value={query}
          onChange={setQuery}
        />

        <Filters
          value={category}
          onChange={setCategory}
        />

        <div className="mt-5 flex flex-col gap-3.5 pb-8">
          {loading ? (
            Array.from({ length: 4 }).map(
              (_, i) => (
                <div
                  key={i}
                  className="skeleton h-24"
                />
              )
            )
          ) : vendors.length === 0 ? (
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
                  ? "No vendors deliver here yet"
                  : "No vendors found"
              }
              description={
                hasLocation
                  ? "Try clearing your location to browse the full OfficeBites marketplace."
                  : "Try a different search term or category."
              }
            />
          ) : (
            vendors.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                layout="row"
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}