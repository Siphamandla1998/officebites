import { supabase } from "./api/supabaseClient";
import { mapOrder, ORDER_SELECT } from "./api/mappers";
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
} from "../utils/constants";

/**
 * Create a notification directly for a specific user.
 *
 * This is important for admin actions such as payment verification:
 * the admin is the current signed-in user, but the notification
 * needs to go to the customer or vendor involved in the order.
 */
async function createNotificationForUser({
  userId,
  type = "general",
  title,
  body,
}) {
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type,
      title,
      body,
      read: false,
      dismissed: false,
    })
    .select()
    .single();

  if (error) {
    throw { message: error.message };
  }

  return data;
}

export const orderService = {
  // ===============================
  // CUSTOMER ORDERS
  // ===============================

  async getOrdersByCustomer(customerId) {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("customer_id", customerId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw { message: error.message };
    }

    return (data || []).map(mapOrder);
  },

  /**
   * Used for guest order history.
   *
   * Guest orders are not readable through the base orders table.
   * This uses the restricted guest-order RPC and only returns
   * the order ids explicitly supplied by the caller.
   */
  async getOrdersByIds(ids = []) {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await supabase.rpc(
      "get_guest_orders_json",
      {
        p_ids: ids,
      }
    );

    if (error) {
      throw { message: error.message };
    }

    return (data || []).map(mapOrder);
  },

  /**
   * Cross-device guest order tracking.
   *
   * Requires:
   *   1. Ticket number
   *   2. Original guest contact/mobile number
   *
   * Both are checked server-side by the SECURITY DEFINER RPC.
   */
  async trackGuestOrder(ticketNumber, contact) {
    const { data, error } = await supabase.rpc(
      "get_guest_order_by_ticket_json",
      {
        p_ticket_number: ticketNumber,
        p_contact: contact,
      }
    );

    if (error) {
      throw { message: error.message };
    }

    return data ? mapOrder(data) : null;
  },

  /**
   * Get a single order.
   *
   * Authenticated users first use the normal orders table,
   * protected by RLS.
   *
   * Guest orders use the dedicated guest-order RPC because
   * guest orders are intentionally not directly selectable
   * through the base orders table.
   */
  async getOrderById(id) {
    const { data: authData } =
      await supabase.auth.getUser();

    if (authData?.user) {
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw { message: error.message };
      }

      if (data) {
        return mapOrder(data);
      }
    }

    const {
      data: guestData,
      error: guestError,
    } = await supabase.rpc(
      "get_guest_order_json",
      {
        p_order_id: id,
      }
    );

    if (guestError) {
      throw { message: guestError.message };
    }

    return guestData ? mapOrder(guestData) : null;
  },

  // ===============================
  // CREATE ORDER
  // ===============================

  /**
   * Creates an order through the database SECURITY DEFINER RPC.
   *
   * IMPORTANT:
   *
   * Do NOT create orders using separate browser-side inserts into:
   *
   *   orders
   *   order_suborders
   *   order_items
   *
   * The database function create_order_from_cart() is the secure
   * checkout boundary.
   *
   * It:
   *
   * 1. Verifies the authenticated customer identity.
   * 2. Determines whether the checkout is authenticated or guest.
   * 3. Validates guest information.
   * 4. Validates the cart.
   * 5. Re-reads meal prices from the meals table.
   * 6. Verifies meals are available.
   * 7. Verifies vendors are approved.
   * 8. Calculates the order total server-side.
   * 9. Creates the order.
   * 10. Splits it into vendor suborders.
   * 11. Creates order items using database prices.
   * 12. Runs as one PostgreSQL transaction.
   * 13. Returns the completed order as JSON.
   *
   * This prevents a guest from changing item prices in DevTools
   * before checkout and prevents partially-created orders.
   */
  async createOrder({
    customerId,
    customerName,
    guestContact,
    guestEmail,
    deliveryDate,
    deliveryLocation,
    cartItems,
  }) {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      throw {
        message: "Your cart is empty",
      };
    }

    /**
     * Only send the information the database function needs
     * to identify the meals and quantities.
     *
     * DO NOT send client-side prices to the database function
     * as authoritative pricing.
     *
     * The RPC looks up the real price from meals.price.
     */
    const rpcItems = cartItems.map((item) => ({
      mealId: item.mealId,
      qty: item.qty,
    }));

    const { data, error } = await supabase.rpc(
      "create_order_from_cart",
      {
        p_customer_id: customerId || null,
        p_guest_name: customerId
          ? null
          : customerName,
        p_guest_contact: customerId
          ? null
          : guestContact,
        p_guest_email: customerId
          ? null
          : guestEmail || null,
        p_delivery_date: deliveryDate,
        p_delivery_location:
          deliveryLocation || null,
        p_items: rpcItems,
      }
    );

    if (error) {
      throw {
        message: error.message,
      };
    }

    if (!data) {
      throw {
        message:
          "Order creation succeeded but no order was returned.",
      };
    }

    /**
     * create_order_from_cart() returns order_to_json(...)
     * as JSONB, so there is no need for another .select()
     * against the orders table.
     *
     * This is particularly important for guest orders because
     * guest orders are intentionally protected from direct
     * base-table reads.
     */
    return mapOrder(data);
  },

  // ===============================
  // PAYMENT
  // ===============================

  /**
   * Submit payment proof through the secure database RPC.
   *
   * The RPC verifies that the caller is allowed to submit
   * proof for this specific order before updating payment state.
   */
  async attachPaymentProof(orderId, proofPath) {
    const { data, error } = await supabase.rpc(
      "submit_payment_proof",
      {
        p_order_id: orderId,
        p_proof_path: proofPath,
      }
    );

    if (error) {
      throw { message: error.message };
    }

    const updated = mapOrder(data);

    /**
     * Guest orders have no customer_id, so there is no
     * customer account to notify.
     *
     * Authenticated customer orders do have a customer_id,
     * so notify that specific user.
     *
     * Notification failure must not make a successful
     * payment-proof submission appear to have failed.
     */
    if (updated.customerId) {
      try {
        await createNotificationForUser({
          userId: updated.customerId,
          type: "payment_submitted",
          title: "Payment submitted",
          body: `Your proof of payment for ${updated.ticketNumber} was received and is being reviewed by OfficeBites.`,
        });
      } catch (notifyError) {
        console.error(
          "attachPaymentProof: notification failed",
          notifyError
        );
      }
    }

    return updated;
  },

  // ===============================
  // VENDOR ORDERS
  // ===============================

  async getOrdersForVendor(vendorId, { date } = {}) {
    let query = supabase
      .from("orders")
      .select(ORDER_SELECT);

    if (date) {
      query = query.eq(
        "delivery_date",
        date
      );
    }

    const { data, error } = await query;

    if (error) {
      throw { message: error.message };
    }

    return (data || [])
      .map(mapOrder)
      .filter((order) =>
        order.subOrders.some(
          (subOrder) =>
            subOrder.vendorId === vendorId
        )
      )
      .map((order) => ({
        ...order,
        subOrder: order.subOrders.find(
          (subOrder) =>
            subOrder.vendorId === vendorId
        ),
      }));
  },

  /**
   * Moves a sub-order exactly one step forward.
   *
   * The database RPC remains the source of truth for:
   *   - vendor ownership
   *   - valid status transitions
   *   - notifications
   */
  async updateSubOrderStatus(
    orderId,
    vendorId,
    nextStatus
  ) {
    if (!vendorId) {
      throw {
        message: "Missing vendor context",
        status: 400,
      };
    }

    const { data, error } = await supabase.rpc(
      "update_suborder_status_and_notify",
      {
        p_order_id: orderId,
        p_next_status: nextStatus,
      }
    );

    if (error) {
      throw {
        message: error.message,
        status: 400,
      };
    }

    return data;
  },

  async updateSubOrderNotes(
    orderId,
    vendorId,
    notes
  ) {
    const { error } = await supabase
      .from("order_suborders")
      .update({
        notes,
      })
      .eq("order_id", orderId)
      .eq("vendor_id", vendorId);

    if (error) {
      throw { message: error.message };
    }

    return {
      success: true,
    };
  },

  // ===============================
  // ADMIN ORDERS
  // ===============================

  async getAllOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw { message: error.message };
    }

    return (data || []).map(mapOrder);
  },

  async getOrdersPendingPaymentReview() {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq(
        "status",
        ORDER_STATUS.PAYMENT_SUBMITTED
      )
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      throw { message: error.message };
    }

    return (data || []).map(mapOrder);
  },

  /**
   * Orders that have actually had payment confirmed.
   */
  async getRecentPayments(limit = 10) {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .in("status", [
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.ACCEPTED,
        ORDER_STATUS.PREPARING,
        ORDER_STATUS.READY,
        ORDER_STATUS.COLLECTED,
        ORDER_STATUS.COMPLETED,
      ])
      .order("created_at", {
        ascending: false,
      })
      .limit(limit);

    if (error) {
      throw { message: error.message };
    }

    return (data || []).map(mapOrder);
  },

  // ===============================
  // VERIFY PAYMENT
  // ===============================

  /**
   * Approve or reject a submitted payment through the secure
   * database RPC.
   *
   * admin_verify_payment():
   *   - Confirms the caller is an admin.
   *   - Locks the order row (FOR UPDATE) to prevent a race between
   *     two admins approving/rejecting the same order at once.
   *   - Rejects the call outright if the order isn't currently
   *     awaiting payment review (payment_submitted/pending_payment),
   *     so an already-confirmed or already-cancelled order can't be
   *     silently re-processed.
   *   - Updates orders + order_suborders and sends every customer
   *     and vendor notification, all inside one transaction.
   *
   * Do NOT replace this with separate .update() calls from the
   * browser — that reintroduces exactly the double-approval and
   * partial-write risks this RPC exists to close.
   */
  async verifyPayment(orderId, approve = true) {
    const { data, error } = await supabase.rpc(
      "admin_verify_payment",
      {
        p_order_id: orderId,
        p_approve: approve,
      }
    );

    if (error) {
      throw { message: error.message, status: error.code };
    }

    return {
      success: true,
      notifyErrors: Array.isArray(data?.notify_errors)
        ? data.notify_errors
        : undefined,
    };
  },
};
