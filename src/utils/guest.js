// Lightweight guest-session helpers so ordering never requires an account.
// A guest gets a stable local id (so repeat orders in the same browser group
// together) and a list of their placed order ids (so /orders can show their
// history without a login). None of this is tied to a real person's
// identity beyond "this browser" — it's the local-only equivalent of a
// "continue as guest" checkout flow.

const GUEST_ID_KEY = "ob_guest_id";
const GUEST_ORDERS_KEY = "ob_guest_order_ids";

export function getOrCreateGuestId() {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = `guest-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

export function getGuestOrderIds() {
  try {
    return JSON.parse(localStorage.getItem(GUEST_ORDERS_KEY)) || [];
  } catch {
    return [];
  }
}

export function addGuestOrderId(orderId) {
  const ids = getGuestOrderIds();
  if (!ids.includes(orderId)) {
    localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify([orderId, ...ids]));
  }
}
