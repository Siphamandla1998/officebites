import { mockResolve } from "./api/mockAdapter";

const mockNotifications = [
  {
    id: "n-1",
    title: "Order confirmed",
    body: "Your order OB-202607-4821 has been confirmed by Mama Thandi's Kitchen.",
    read: false,
    createdAt: "2026-07-17T14:35:00",
  },
  {
    id: "n-2",
    title: "Payment verified",
    body: "OfficeBites verified your payment for order OB-202607-1187.",
    read: true,
    createdAt: "2026-07-15T11:20:00",
  },
  {
    id: "n-3",
    title: "New review",
    body: "You received a new 5-star review from Aisha K.",
    read: false,
    createdAt: "2026-07-08T12:41:00",
  },
];

export const notificationService = {
  async getNotifications() {
    return mockResolve(mockNotifications);
  },

  async markAsRead(id) {
    const n = mockNotifications.find((n) => n.id === id);
    if (n) n.read = true;
    return mockResolve({ success: true }, { delay: 120 });
  },

  async getUnreadCount() {
    return mockResolve(mockNotifications.filter((n) => !n.read).length, { delay: 100 });
  },
};
