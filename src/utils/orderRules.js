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

export function generateTicketNumber() {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `OB-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${rand}`;
}
