// PostgREST filter values must be quoted when they contain punctuation.
// JSON string escaping also handles embedded quotes and backslashes.
export function catalogueSearchFilter(fields, search) {
  const pattern = JSON.stringify(`%${String(search)}%`);
  return fields.map((field) => `${field}.ilike.${pattern}`).join(",");
}

// ISO calendar dates represent delivery days, not UTC instants. Date objects
// retain the local calendar-date convention used by nextOrderableDate().
export function deliveryWeekday(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }
  return new Date(value).getDay();
}
