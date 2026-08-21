import { ORDER_CUTOFF_HOUR, COMMISSION_RATE } from "./constants";

/**
 * Orders for a given delivery date close at 19:00 the previous day.
 * Returns true if ordering is still open for `deliveryDate`.
 */
export function isOrderingOpen(deliveryDate = new Date()) {
  const now = new Date();
  const cutoff = new Date(deliveryDate);
  cutoff.setDate(cutoff.getDate() - 1);
  cutoff.setHours(ORDER_CUTOFF_HOUR, 0, 0, 0);
  return now.getTime() < cutoff.getTime();
}

export function nextOrderableDate() {
  const now = new Date();
  const todayCutoff = new Date();
  todayCutoff.setHours(ORDER_CUTOFF_HOUR, 0, 0, 0);
  const target = new Date();
  // If we're past today's 19:00 cutoff for "tomorrow", push to the day after.
  target.setDate(target.getDate() + (now > todayCutoff ? 2 : 1));
  return target;
}

/** True once today's cutoff for ordering "for tomorrow" has passed. */
export function isPastTodaysCutoff() {
  const todayCutoff = new Date();
  todayCutoff.setHours(ORDER_CUTOFF_HOUR, 0, 0, 0);
  return new Date() > todayCutoff;
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

export function calcCommission(amount) {
  const commission = +(amount * COMMISSION_RATE).toFixed(2);
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
