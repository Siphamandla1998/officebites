import { mockResolve } from "./api/mockAdapter";
import { orders } from "../mock/orders";
import { splitCartByVendor, generateTicketNumber } from "../utils/orderRules";
import { ORDER_STATUS, PAYMENT_STATUS, VENDOR_ORDER_FLOW } from "../utils/constants";

let orderStore = [...orders];

/** True if `from` -> `to` is the single next step in the vendor pipeline. */
function isValidTransition(from, to) {
  const fromIndex = VENDOR_ORDER_FLOW.indexOf(from);
  const toIndex = VENDOR_ORDER_FLOW.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex === fromIndex + 1;
}

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
      paymentStatus: PAYMENT_STATUS.UNPAID,
      subtotal: so.items.reduce((sum, i) => sum + i.price * i.qty, 0),
      collectionTime: "",
      notes: "",
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
            subOrders: o.subOrders.map((s) => ({
              ...s,
              status: ORDER_STATUS.PAYMENT_SUBMITTED,
              paymentStatus: PAYMENT_STATUS.VERIFYING,
            })),
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

  /**
   * Moves a sub-order exactly one step forward in the vendor pipeline
   * (Confirmed -> Accepted -> Preparing -> Ready -> Collected -> Completed).
   * Rejects any transition that isn't the immediate next step — a confirmed
   * order can never be rejected/cancelled by a vendor, and steps can't be
   * skipped or reversed.
   */
  async updateSubOrderStatus(orderId, vendorId, nextStatus) {
    const order = orderStore.find((o) => o.id === orderId);
    const subOrder = order?.subOrders.find((s) => s.vendorId === vendorId);
    if (!subOrder) {
      return Promise.reject({ message: "Order not found", status: 404 });
    }
    if (!isValidTransition(subOrder.status, nextStatus)) {
      return Promise.reject({
        message: `Can't move from "${subOrder.status}" to "${nextStatus}" — only the next step in the pipeline is allowed.`,
        status: 400,
      });
    }

    orderStore = orderStore.map((o) => {
      if (o.id !== orderId) return o;
      const subOrders = o.subOrders.map((s) =>
        s.vendorId === vendorId ? { ...s, status: nextStatus } : s
      );
      // The parent order only reflects the sub-order status once every
      // vendor on a multi-vendor order has reached the same step.
      const allSame = subOrders.every((s) => s.status === nextStatus);
      return { ...o, subOrders, status: allSame ? nextStatus : o.status };
    });
    return mockResolve({ success: true }, { delay: 250 });
  },

  async updateSubOrderNotes(orderId, vendorId, notes) {
    orderStore = orderStore.map((o) =>
      o.id === orderId
        ? {
            ...o,
            subOrders: o.subOrders.map((s) => (s.vendorId === vendorId ? { ...s, notes } : s)),
          }
        : o
    );
    return mockResolve({ success: true }, { delay: 200 });
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
              paymentStatus: approve ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.UNPAID,
            })),
          }
        : o
    );
    return mockResolve({ success: true }, { delay: 300 });
  },
};
