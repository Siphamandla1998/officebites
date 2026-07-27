import { supabase } from "./api/supabaseClient";
import { mapOrder, ORDER_SELECT } from "./api/mappers";
import { splitCartByVendor, generateTicketNumber } from "../utils/orderRules";
import { ORDER_STATUS, PAYMENT_STATUS, VENDOR_ORDER_FLOW } from "../utils/constants";
import { notificationService } from "./notificationService";

/** True if `from` -> `to` is the single next step in the vendor pipeline (also enforced by a DB trigger). */
function isValidTransition(from, to) {
  const fromIndex = VENDOR_ORDER_FLOW.indexOf(from);
  const toIndex = VENDOR_ORDER_FLOW.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex === fromIndex + 1;
}

async function fetchFullOrder(orderId) {
  const { data, error } = await supabase.from("orders").select(ORDER_SELECT).eq("id", orderId).single();
  if (error) throw { message: error.message };
  return mapOrder(data);
}

export const orderService = {
  async getOrdersByCustomer(customerId) {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw { message: error.message };
    return (data || []).map(mapOrder);
  },

  /** Used for guest order history, where we track order ids locally instead of a customerId. */
  async getOrdersByIds(ids = []) {
    if (ids.length === 0) return [];
    const { data, error } = await supabase.from("orders").select(ORDER_SELECT).in("id", ids);
    if (error) throw { message: error.message };
    return (data || []).map(mapOrder);
  },

  async getOrderById(id) {
    const { data, error } = await supabase.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
    if (error) throw { message: error.message };
    return mapOrder(data);
  },

  /** One checkout -> one customer-facing order, internally split by vendor. Works with or without an account. */
  async createOrder({ customerId, customerName, guestContact, deliveryDate, cartItems }) {
    const groups = splitCartByVendor(cartItems);
    const total = groups.reduce(
      (sum, g) => sum + g.items.reduce((s, i) => s + i.price * i.qty, 0),
      0
    );

    const { data: orderRow, error: orderError } = await supabase
      .from("orders")
      .insert({
        ticket_number: generateTicketNumber(),
        customer_id: customerId || null,
        guest_name: customerId ? null : customerName,
        guest_contact: customerId ? null : guestContact,
        delivery_date: deliveryDate,
        status: ORDER_STATUS.PENDING_PAYMENT,
        total,
      })
      .select()
      .single();
    if (orderError) throw { message: orderError.message };

    const { data: suborderRows, error: suborderError } = await supabase
      .from("order_suborders")
      .insert(
        groups.map((g) => ({
          order_id: orderRow.id,
          vendor_id: g.vendorId,
          status: ORDER_STATUS.PENDING_PAYMENT,
          payment_status: PAYMENT_STATUS.UNPAID,
          subtotal: g.items.reduce((s, i) => s + i.price * i.qty, 0),
        }))
      )
      .select();
    if (suborderError) throw { message: suborderError.message };

    const itemRows = groups.flatMap((g) => {
      const suborder = suborderRows.find((so) => so.vendor_id === g.vendorId);
      return g.items.map((item) => ({
        suborder_id: suborder.id,
        meal_id: item.mealId,
        meal_name: item.name,
        qty: item.qty,
        price: item.price,
      }));
    });
    const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
    if (itemsError) throw { message: itemsError.message };

    return fetchFullOrder(orderRow.id);
  },

  async attachPaymentProof(orderId, proofPath) {
    const { error } = await supabase
      .from("orders")
      .update({ payment_proof_url: proofPath, status: ORDER_STATUS.PAYMENT_SUBMITTED })
      .eq("id", orderId);
    if (error) throw { message: error.message };

    const { error: subError } = await supabase
      .from("order_suborders")
      .update({ status: ORDER_STATUS.PAYMENT_SUBMITTED, payment_status: PAYMENT_STATUS.VERIFYING })
      .eq("order_id", orderId);
    if (subError) throw { message: subError.message };

    const updated = await fetchFullOrder(orderId);
    await notificationService.addNotification({
      title: "Payment submitted",
      body: `Your proof of payment for ${updated.ticketNumber} was received and is being reviewed by OfficeBites.`,
    });
    return updated;
  },

  // --- Vendor-side ---
  async getOrdersForVendor(vendorId, { date } = {}) {
    // Fetches broadly and filters client-side rather than trying to filter
    // on the embedded order_suborders table in the query itself — PostgREST's
    // embedded-resource filtering behavior depends on exact client/server
    // versions, and getting it subtly wrong would silently return the wrong
    // orders. Revisit with a dedicated `vendor_orders` view/RPC once this is
    // confirmed working end-to-end, if the extra fetched rows become a
    // real cost at your order volume.
    let query = supabase.from("orders").select(ORDER_SELECT);
    if (date) query = query.eq("delivery_date", date);
    const { data, error } = await query;
    if (error) throw { message: error.message };

    return (data || [])
      .map(mapOrder)
      .filter((o) => o.subOrders.some((s) => s.vendorId === vendorId))
      .map((o) => ({ ...o, subOrder: o.subOrders.find((s) => s.vendorId === vendorId) }));
  },

  /**
   * Moves a sub-order exactly one step forward in the vendor pipeline
   * (Confirmed -> Accepted -> Preparing -> Ready -> Collected -> Completed).
   * The database trigger rejects anything else too, but checking here first
   * gives a friendlier error message without a round-trip failure.
   */
  async updateSubOrderStatus(orderId, vendorId, nextStatus) {
    const { data: current, error: fetchError } = await supabase
      .from("order_suborders")
      .select("status")
      .eq("order_id", orderId)
      .eq("vendor_id", vendorId)
      .single();
    if (fetchError) throw { message: "Order not found", status: 404 };
    if (!isValidTransition(current.status, nextStatus)) {
      throw {
        message: `Can't move from "${current.status}" to "${nextStatus}" — only the next step in the pipeline is allowed.`,
        status: 400,
      };
    }

    const { error } = await supabase
      .from("order_suborders")
      .update({ status: nextStatus })
      .eq("order_id", orderId)
      .eq("vendor_id", vendorId);
    if (error) throw { message: error.message };

    // The parent order only reflects the sub-order status once every vendor
    // on a multi-vendor order has reached the same step.
    const { data: allSubs } = await supabase.from("order_suborders").select("status").eq("order_id", orderId);
    if (allSubs?.every((s) => s.status === nextStatus)) {
      await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
    }
    return { success: true };
  },

  async updateSubOrderNotes(orderId, vendorId, notes) {
    const { error } = await supabase
      .from("order_suborders")
      .update({ notes })
      .eq("order_id", orderId)
      .eq("vendor_id", vendorId);
    if (error) throw { message: error.message };
    return { success: true };
  },

  // --- Admin-side ---
  async getAllOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw { message: error.message };
    return (data || []).map(mapOrder);
  },

  /** Orders awaiting a human decision on their uploaded proof of payment. */
  async getOrdersPendingPaymentReview() {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("status", ORDER_STATUS.PAYMENT_SUBMITTED)
      .order("created_at", { ascending: true });
    if (error) throw { message: error.message };
    return (data || []).map(mapOrder);
  },

  async verifyPayment(orderId, approve = true) {
    const newStatus = approve ? ORDER_STATUS.CONFIRMED : ORDER_STATUS.CANCELLED;
    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", orderId);
    if (error) throw { message: error.message };

    const { error: subError } = await supabase
      .from("order_suborders")
      .update({
        status: newStatus,
        payment_status: approve ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.UNPAID,
      })
      .eq("order_id", orderId);
    if (subError) throw { message: subError.message };

    const updated = await fetchFullOrder(orderId);
    await notificationService.addNotification({
      title: approve ? "Payment verified" : "Payment rejected",
      body: approve
        ? `Your payment for ${updated.ticketNumber} has been verified — the order is confirmed.`
        : `We couldn't verify the payment for ${updated.ticketNumber}. Please contact support or re-upload proof.`,
    });
    if (approve) {
      await notificationService.addVendorNotification({
        type: "new_order",
        title: "New order confirmed",
        body: `Order ${updated.ticketNumber} was just confirmed and is ready to prepare.`,
      });
    }
    return { success: true };
  },
};
