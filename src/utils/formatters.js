import { CURRENCY } from "./constants";
import { calendarDate } from './reportingDates';

export function formatCurrency(amount = 0) {
  if (amount === null || !Number.isFinite(Number(amount))) return "Unresolved";
  return `${CURRENCY}${Number(amount).toFixed(2)}`;
}

export function formatDate(date, opts = {}) {
  const d = calendarDate(date);
  return d.toLocaleDateString("en-ZA", {
    ...(typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? {} : { timeZone: "Africa/Johannesburg" }),
    weekday: "short",
    day: "numeric",
    month: "short",
    ...opts,
  });
}

export function formatTime(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" });
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
