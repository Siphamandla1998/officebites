import { useState } from "react";
import { FiHelpCircle, FiChevronDown } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import SearchBar from "../../components/ui/SearchBar";
import Filters from "../../components/ui/Filters";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { useDebounce } from "../../hooks/useDebounce";
import { supportService } from "../../services/supportService";
import { FAQ_CATEGORIES } from "../../mock/support";

export default function FAQPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [openId, setOpenId] = useState(null);
  const debouncedQuery = useDebounce(query, 250);

  const { data: results, loading } = useAsync(
    () => supportService.searchFAQs({ query: debouncedQuery, category }),
    [debouncedQuery, category]
  );

  return (
    <div className="pb-8">
      <Navbar showBack title="FAQs" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-4">
        <SearchBar value={query} onChange={setQuery} placeholder="Search FAQs..." />
        <Filters options={FAQ_CATEGORIES} active={category} onChange={setCategory} allLabel="All topics" />

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-14" />)}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={<FiHelpCircle size={20} />}
            title="No matching FAQs"
            description="Try a different search term, or contact support directly."
          />
        ) : (
          <div className="card divide-y divide-line overflow-hidden">
            {results.map((f) => {
              const open = openId === f.id;
              return (
                <div key={f.id}>
                  <button
                    onClick={() => setOpenId(open ? null : f.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
                    aria-expanded={open}
                  >
                    <span className="text-sm font-medium text-ink">{f.question}</span>
                    <FiChevronDown
                      size={16}
                      className={`text-ink-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && <p className="px-4 pb-4 text-sm text-ink-soft leading-relaxed">{f.answer}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
