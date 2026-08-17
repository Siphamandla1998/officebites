import { formatCurrency } from "../../utils/formatters";

/**
 * Minimal dependency-free bar chart. Keeps the stack to exactly what was
 * requested (no chart library) while still giving the dashboards real visuals.
 */
export default function BarChart({ data, xKey, yKey, height = 160, formatValue = formatCurrency }) {
  const max = Math.max(...data.map((d) => d[yKey]), 1);

  return (
    <div>
      <div className="flex items-end gap-2.5" style={{ height }}>
        {data.map((d) => {
          const barHeight = Math.max((d[yKey] / max) * (height - 28), 4);
          return (
            <div key={d[xKey]} className="flex-1 flex flex-col items-center justify-end gap-1.5 group">
              <span className="text-[10px] text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity">
                {formatValue(d[yKey])}
              </span>
              <div
                className="w-full rounded-md bg-nude-400 group-hover:bg-nude-600 transition-colors"
                style={{ height: barHeight }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2.5 mt-2">
        {data.map((d) => (
          <span key={d[xKey]} className="flex-1 text-center text-[10px] text-ink-muted">
            {d[xKey]}
          </span>
        ))}
      </div>
    </div>
  );
}
