import { CURRENCY } from "./constants";

export function formatCurrency(amount = 0) {
  return `${CURRENCY}${Number(amount).toFixed(2)}`;
}

export function formatDate(date, opts = {}) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...opts,
  });
}

export function formatTime(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

export function formatRelativeTime(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return formatDate(d);
}

export function initials(name = "") {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
