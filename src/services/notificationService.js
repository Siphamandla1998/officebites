import { mockResolve } from "./api/mockAdapter";

const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

let customerNotifications = [
  {
    id: "n-1",
    title: "Order confirmed",
    body: "Your order OB-202607-4821 has been confirmed by Sne's Kitchen.",
    read: false,
    dismissed: false,
    createdAt: hoursAgo(2),
  },
  {
    id: "n-2",
    title: "Payment verified",
    body: "OfficeBites verified your payment for order OB-202607-1187.",
    read: true,
    dismissed: false,
    createdAt: hoursAgo(48),
  },
  {
    id: "n-3",
    title: "New review",
    body: "You received a new 5-star review from Aisha K.",
    read: false,
    dismissed: false,
    createdAt: hoursAgo(96),
  },
];

// Vendor notifications cover the events listed in the vendor dashboard spec:
// new order, order cancelled, payment received, customer message, meal out of stock.
let vendorNotifications = [
  {
    id: "vn-1",
    type: "new_order",
    title: "New order received",
    body: "Order OB-202607-4821 was just confirmed — 2 items for collection today.",
    read: false,
    dismissed: false,
    createdAt: hoursAgo(2),
  },
  {
    id: "vn-2",
    type: "payment_received",
    title: "Payment received",
    body: "Payment for order OB-202607-3391 has been verified by OfficeBites.",
    read: false,
    dismissed: false,
    createdAt: hoursAgo(3),
  },
  {
    id: "vn-3",
    type: "customer_message",
    title: "New customer message",
    body: "A customer asked about extra chakalaka on their order.",
    read: true,
    dismissed: false,
    createdAt: hoursAgo(20),
  },
  {
    id: "vn-4",
    type: "order_cancelled",
    title: "Order cancelled",
    body: "Order OB-202607-2276 was cancelled before payment was verified.",
    read: true,
    dismissed: false,
    createdAt: hoursAgo(28),
  },
  {
    id: "vn-5",
    type: "out_of_stock",
    title: "Meal marked out of stock",
    body: "\"Green Salad\" is running low — consider restocking before lunch.",
    read: false,
    dismissed: false,
    createdAt: hoursAgo(30),
  },
];

export const notificationService = {
  async getNotifications() {
    return mockResolve(customerNotifications.filter((n) => !n.dismissed));
  },

  async markAsRead(id) {
    customerNotifications = customerNotifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    return mockResolve({ success: true }, { delay: 120 });
  },

  async dismiss(id) {
    customerNotifications = customerNotifications.map((n) => (n.id === id ? { ...n, dismissed: true } : n));
    return mockResolve({ success: true }, { delay: 120 });
  },

  async getUnreadCount() {
    return mockResolve(customerNotifications.filter((n) => !n.read && !n.dismissed).length, { delay: 100 });
  },

  // --- Vendor notifications ---
  async getVendorNotifications() {
    return mockResolve(vendorNotifications.filter((n) => !n.dismissed));
  },

  async markVendorNotificationRead(id) {
    vendorNotifications = vendorNotifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    return mockResolve({ success: true }, { delay: 120 });
  },

  async dismissVendorNotification(id) {
    vendorNotifications = vendorNotifications.map((n) => (n.id === id ? { ...n, dismissed: true } : n));
    return mockResolve({ success: true }, { delay: 120 });
  },
};
