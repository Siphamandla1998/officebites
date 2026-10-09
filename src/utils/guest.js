const GUEST_ID_KEY = "ob_guest_id";
const GUEST_ORDERS_KEY = "ob_guest_orders";
// Verified details stay in this tab's memory when browser storage is unavailable.
// They are never placed in the URL, and the server still verifies every lookup.
let temporaryId;
const temporaryOrders = new Map();
const removedOrders = new Set();

export function getOrCreateGuestId() {
  try { temporaryId ||= localStorage.getItem(GUEST_ID_KEY); } catch { /* Optional persistence. */ }
  temporaryId ||= `guest-${crypto.randomUUID()}`;
  try { localStorage.setItem(GUEST_ID_KEY, temporaryId); } catch { /* Use this tab. */ }
  return temporaryId;
}

export function getGuestOrders() {
  let stored = [];
  try {
    const value = JSON.parse(localStorage.getItem(GUEST_ORDERS_KEY));
    if (Array.isArray(value)) stored = value.filter(o => o?.id && o?.ticketNumber && o?.contact);
  } catch { /* Use verified in-memory details. */ }
  return [...new Map([...stored, ...temporaryOrders.values()].filter(o => !removedOrders.has(o.id)).map(o => [o.id, o])).values()];
}

export function addGuestOrder(order) {
  if (!order?.id || !order?.ticketNumber || !order?.contact) return false;
  temporaryOrders.set(order.id, { id: order.id, ticketNumber: order.ticketNumber, contact: order.contact });
  removedOrders.delete(order.id);
  try {
    localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(getGuestOrders()));
    return true;
  } catch { return false; }
}

export function getGuestOrderAccess(orderId) {
  return getGuestOrders().find(order => order.id === orderId) || null;
}

export function removeGuestOrder(orderId) {
  temporaryOrders.delete(orderId);
  removedOrders.add(orderId);
  try { localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(getGuestOrders())); } catch { /* Removed in this tab. */ }
}
