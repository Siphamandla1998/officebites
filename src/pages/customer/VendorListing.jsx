import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import SearchBar from "../../components/ui/SearchBar";
import Filters from "../../components/ui/Filters";
import VendorCard from "../../components/features/VendorCard";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { vendorService } from "../../services/vendorService";
import { categories } from "../../mock/categories";
import { FiSearch } from "react-icons/fi";

export default function VendorListing() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [category, setCategory] = useState("all");
  const debouncedQuery = useDebounce(query, 300);

  const { data: vendors, loading } = useAsync(
    () =>
      vendorService.getVendors({
        search: debouncedQuery || undefined,
        category: category === "all" ? undefined : category,
      }),
    [debouncedQuery, category]
  );

  const categoryNames = useMemo(() => categories.map((c) => c.name), []);

  return (
    <div>
      <Navbar title="Vendors" />
      <div className="ob-container pt-4 flex flex-col gap-4">
        <SearchBar value={query} onChange={setQuery} placeholder="Search vendors..." />
        <Filters options={categoryNames} active={category} onChange={setCategory} />
      </div>

      <div className="ob-container mt-5 flex flex-col gap-3.5 pb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24" />)
          : vendors.length === 0
          ? (
            <EmptyState
              icon={<FiSearch size={20} />}
              title="No vendors found"
              description="Try a different search term or category."
            />
          )
          : vendors.map((v) => <VendorCard key={v.id} vendor={v} layout="row" />)}
      </div>
    </div>
  );
}
