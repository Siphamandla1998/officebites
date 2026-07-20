import { FiStar } from "react-icons/fi";

export default function Rating({ value = 0, count, size = 12, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 text-ink-soft ${className}`}>
      <FiStar size={size} className="fill-nude-500 text-nude-500" />
      <span className="text-xs font-medium">{value.toFixed(1)}</span>
      {count != null && <span className="text-xs text-ink-muted">({count})</span>}
    </span>
  );
}
