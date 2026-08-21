import React from "react";

export default function Filters({
  options = [],
  active,
  onChange,
  allLabel = "All",
  labels = {},
}) {
  const safeOptions = Array.isArray(options) ? options : [];
  const list = ["all", ...safeOptions];

  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      {list.map((opt) => {
        const isActive = active === opt;

        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium border transition-colors ${
              isActive
                ? "bg-ink text-paper border-ink"
                : "bg-paper-raised text-ink-soft border-line hover:border-nude-400"
            }`}
          >
            {opt === "all" ? allLabel : labels[opt] || opt}
          </button>
        );
      })}
    </div>
  );
}
