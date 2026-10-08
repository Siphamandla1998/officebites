import { ORDER_CUTOFF_HOUR, COMMISSION_RATE } from "./constants";

/**
 * Orders for a given delivery date close at 19:00 the previous day.
 * Returns true if ordering is still open for `deliveryDate`.
 */
export function deliveryDateKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sastParts(now) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

export function isOrderingOpen(deliveryDate = new Date(), now = new Date()) {
  const [year, month, day] = deliveryDateKey(deliveryDate).split("-").map(Number);
  // SAST is UTC+2 and has no daylight-saving changes.
  const cutoff = Date.UTC(year, month - 1, day - 1, ORDER_CUTOFF_HOUR - 2);
  return now.getTime() < cutoff;
}

export function nextOrderableDate(now = new Date()) {
  const parts = sastParts(now);
  const target = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + (parts.hour >= ORDER_CUTOFF_HOUR ? 2 : 1)));
  // Represent this calendar date locally for existing date labels/day filters.
  return new Date(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 12);
}

/** True once today's cutoff for ordering "for tomorrow" has passed. */
export function isPastTodaysCutoff(now = new Date()) {
  return sastParts(now).hour >= ORDER_CUTOFF_HOUR;
}

/** Split a single multi-vendor cart into per-vendor sub-orders (business rule). */
export function splitCartByVendor(cartItems) {
  const byVendor = {};
  cartItems.forEach((item) => {
    if (!byVendor[item.vendorId]) {
      byVendor[item.vendorId] = { vendorId: item.vendorId, vendorName: item.vendorName, items: [] };
    }
    byVendor[item.vendorId].items.push(item);
  });
  return Object.values(byVendor);
}

export function calcCommission(amount, rate = COMMISSION_RATE) {
  const commission = +(amount * rate).toFixed(2);
  return { commission, vendorPayout: +(amount - commission).toFixed(2) };
}

// Crockford-style alphabet: uppercase, no 0/O/1/I/L — avoids characters
// customers commonly misread when reading a ticket code off a screen.
const TICKET_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Cryptographically random, customer-facing order code — e.g. "OB-7F42KQ".
 * 32^6 ≈ 1.07 billion combinations, generated with a CSPRNG (not Math.random),
 * so it can't be brute-forced or guessed the way the previous small
 * sequential/date-based number could. This is the "order code" half of the
 * guest order-tracking verification (see get_guest_order_by_ticket_json in
 * the guest-order-security migration) — the internal orders.id UUID stays
 * separate and is never shown to the customer.
 */
export function generateTicketNumber() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(bytes, (b) => TICKET_ALPHABET[b % TICKET_ALPHABET.length]).join("");
  return `OB-${code}`;
}
