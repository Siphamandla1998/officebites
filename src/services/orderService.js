import { mockResolve } from "./api/mockAdapter";
import { orders } from "../mock/orders";
import { splitCartByVendor, generateTicketNumber } from "../utils/orderRules";
import { ORDER_STATUS } from "../utils/constants";

let orderStore = [...orders];

export const orderService = {
  async getOrdersByCustomer(customerId) {
    return mockResolve(orderStore.filter((o) => o.customerId === customerId));
  },

  async getOrderById(id) {
    return mockResolve(orderStore.find((o) => o.id === id) || null);
  },

  /** One checkout -> one customer-facing order, internally split by vendor. */
  async createOrder({ customerId, customerName, deliveryDate, cartItems }) {
    const subOrdersRaw = splitCartByVendor(cartItems);
    const subOrders = subOrdersRaw.map((so) => ({
      ...so,
      status: ORDER_STATUS.PENDING_PAYMENT,
      subtotal: so.items.reduce((sum, i) => sum + i.price * i.qty, 0),
    }));
    const total = subOrders.reduce((sum, s) => sum + s.subtotal, 0);
    const newOrder = {
      id: `o-${Date.now()}`,
      ticketNumber: generateTicketNumber(),
      customerId,
      customerName,
      deliveryDate,
      status: ORDER_STATUS.PENDING_PAYMENT,
      createdAt: new Date().toISOString(),
      subOrders,
      total,
      paymentProof: null,
    };
    orderStore = [newOrder, ...orderStore];
    return mockResolve(newOrder, { delay: 600 });
  },

  async attachPaymentProof(orderId, proofUrl) {
    orderStore = orderStore.map((o) =>
      o.id === orderId
        ? {
            ...o,
            paymentProof: proofUrl,
            status: ORDER_STATUS.PAYMENT_SUBMITTED,
            subOrders: o.subOrders.map((s) => ({ ...s, status: ORDER_STATUS.PAYMENT_SUBMITTED })),
          }
        : o
    );
    return mockResolve(orderStore.find((o) => o.id === orderId), { delay: 500 });
  },

  // --- Vendor-side ---
  async getOrdersForVendor(vendorId, { date } = {}) {
    const result = orderStore
      .filter((o) => o.subOrders.some((s) => s.vendorId === vendorId))
      .filter((o) => !date || o.deliveryDate === date)
      .map((o) => ({
        ...o,
        subOrder: o.subOrders.find((s) => s.vendorId === vendorId),
      }));
    return mockResolve(result);
  },

  async updateSubOrderStatus(orderId, vendorId, status) {
    orderStore = orderStore.map((o) => {
      if (o.id !== orderId) return o;
      const subOrders = o.subOrders.map((s) =>
        s.vendorId === vendorId ? { ...s, status } : s
      );
      // Vendors cannot reject a confirmed order — status transitions only move forward.
      const allSame = subOrders.every((s) => s.status === status);
      return { ...o, subOrders, status: allSame ? status : o.status };
    });
    return mockResolve({ success: true }, { delay: 250 });
  },

  // --- Admin-side ---
  async getAllOrders() {
    return mockResolve(orderStore);
  },

  async verifyPayment(orderId, approve = true) {
    orderStore = orderStore.map((o) =>
      o.id === orderId
        ? {
            ...o,
            status: approve ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.CANCELLED,
            subOrders: o.subOrders.map((s) => ({
              ...s,
              status: approve ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.CANCELLED,
            })),
          }
        : o
    );
    return mockResolve({ success: true }, { delay: 300 });
  },
};
