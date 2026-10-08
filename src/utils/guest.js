const GUEST_ID_KEY = "ob_guest_id";
const GUEST_ORDERS_KEY = "ob_guest_orders";

export function getOrCreateGuestId() {
  let id = localStorage.getItem(GUEST_ID_KEY);

  if (!id) {
    id = `guest-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    localStorage.setItem(GUEST_ID_KEY, id);
  }

  return id;
}

export function getGuestOrders() {
  try {
    const stored = JSON.parse(
      localStorage.getItem(GUEST_ORDERS_KEY)
    );

    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function addGuestOrder(order) {
  if (!order?.id || !order?.ticketNumber || !order?.contact) {
    return;
  }

  const orders = getGuestOrders();

  const next = [
    {
      id: order.id,
      ticketNumber: order.ticketNumber,
      contact: order.contact,
    },
    ...orders.filter((item) => item.id !== order.id),
  ];

  localStorage.setItem(
    GUEST_ORDERS_KEY,
    JSON.stringify(next)
  );
}

export function getGuestOrderAccess(orderId) {
  return (
    getGuestOrders().find(
      (order) => order.id === orderId
    ) || null
  );
}

export function removeGuestOrder(orderId) {
  const next = getGuestOrders().filter(
    (order) => order.id !== orderId
  );

  localStorage.setItem(
    GUEST_ORDERS_KEY,
    JSON.stringify(next)
  );
}