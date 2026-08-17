import { supabase } from "./api/supabaseClient";
import { mapOrder, ORDER_SELECT } from "./api/mappers";
import {
  splitCartByVendor,
  generateTicketNumber,
} from "../utils/orderRules";
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  VENDOR_ORDER_FLOW,
} from "../utils/constants";
import { notificationService } from "./notificationService";

/**
 * True if `from` -> `to` is the single next step
 * in the vendor order pipeline.
 */
function isValidTransition(from, to) {
  const fromIndex = VENDOR_ORDER_FLOW.indexOf(from);
  const toIndex = VENDOR_ORDER_FLOW.indexOf(to);

  if (fromIndex === -1 || toIndex === -1) {
    return false;
  }

  return toIndex === fromIndex + 1;
}

async function fetchFullOrder(orderId) {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .single();

  if (error) {
    throw { message: error.message };
  }

  return mapOrder(data);
}

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

/**
 * Get vendor owner profile(s) for the vendors attached to an order.
 */
async function getVendorOwnerIds(vendorIds = []) {
  if (!vendorIds.length) {
    return [];
  }

  const uniqueVendorIds = [...new Set(vendorIds)];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, vendor_id, role")
    .in("vendor_id", uniqueVendorIds)
    .eq("role", "vendor");

  if (error) {
    throw { message: error.message };
  }

  return data || [];
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
   * Used for guest order history. Guest orders are no longer readable
   * through the base table (see the guest-order-security migration), so
   * this goes through the batch RPC instead — it can only ever return rows
   * matching ids the caller already supplied, never a full table scan.
   */
  async getOrdersByIds(ids = []) {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await supabase.rpc("get_guest_orders_json", { p_ids: ids });

    if (error) {
      throw { message: error.message };
    }

    return (data || []).map(mapOrder);
  },

  /**
   * A signed-in customer/vendor/admin still reads `orders` directly (RLS
   * scopes them to their own rows). A guest order is no longer visible
   * through the base table at all, so if there's no signed-in user — or the
   * direct read comes back empty — fall back to the id-scoped guest RPC.
   * Either path can only ever return the ONE order matching `id`.
   */
  /**
   * Cross-device guest order tracking — ticket code + the contact the guest
   * originally gave at checkout, the "order code + mobile number" second
   * factor. Requires both to match; there's no way to enumerate orders
   * through this, only to confirm one you already believe is yours.
   */
  async trackGuestOrder(ticketNumber, contact) {
    const { data, error } = await supabase.rpc("get_guest_order_by_ticket_json", {
      p_ticket_number: ticketNumber,
      p_contact: contact,
    });

    if (error) {
      throw { message: error.message };
    }

    return data ? mapOrder(data) : null;
  },

  async getOrderById(id) {
    const { data: authData } = await supabase.auth.getUser();

    if (authData?.user) {
      const { data, error } = await supabase
        .from("orders")
        .select(ORDER_SELECT)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw { message: error.message };
      }

      if (data) return mapOrder(data);
    }

    const { data: guestData, error: guestError } = await supabase.rpc("get_guest_order_json", {
      p_order_id: id,
    });

    if (guestError) {
      throw { message: guestError.message };
    }

    return mapOrder(guestData);
  },

  // ===============================
  // CREATE ORDER
  // ===============================

  /**
   * One checkout creates one customer-facing order,
   * internally split by vendor.
   *
   * The order's id and ticket_number are generated here (client-side, with a
   * CSPRNG for the ticket) rather than read back via `.select()` after
   * insert: guest orders are no longer selectable through the base `orders`
   * table policy at all (see the guest-order-security migration), so an
   * `.insert().select()` would return nothing for a guest. Since we already
   * know every value we're inserting, there's nothing to read back.
   */
  async createOrder({
    customerId,
    customerName,
    guestContact,
    deliveryDate,
    deliveryLocation,
    cartItems,
  }) {
    const groups = splitCartByVendor(cartItems);

    const total = groups.reduce(
      (sum, group) =>
        sum +
        group.items.reduce(
          (subtotal, item) =>
            subtotal + item.price * item.qty,
          0
        ),
      0
    );

    const orderId = crypto.randomUUID();
    const ticketNumber = generateTicketNumber();

    const { error: orderError } = await supabase
      .from("orders")
      .insert({
        id: orderId,
        ticket_number: ticketNumber,
        customer_id: customerId || null,
        guest_name: customerId ? null : customerName,
        guest_contact: customerId ? null : guestContact,
        delivery_date: deliveryDate,
        delivery_location: deliveryLocation || null,
        status: ORDER_STATUS.PENDING_PAYMENT,
        total,
      });

    if (orderError) {
      throw { message: orderError.message };
    }

    const orderRow = { id: orderId };

    const suborderRows = groups.map((group) => ({
      id: crypto.randomUUID(),
      order_id: orderRow.id,
      vendor_id: group.vendorId,
      status: ORDER_STATUS.PENDING_PAYMENT,
      payment_status: PAYMENT_STATUS.UNPAID,
      subtotal: group.items.reduce(
        (sum, item) =>
          sum + item.price * item.qty,
        0
      ),
    }));

    const { error: suborderError } = await supabase
      .from("order_suborders")
      .insert(suborderRows);

    if (suborderError) {
      throw { message: suborderError.message };
    }

    const itemRows = groups.flatMap((group) => {
      const suborder = suborderRows.find(
        (row) => row.vendor_id === group.vendorId
      );

      return group.items.map((item) => ({
        suborder_id: suborder.id,
        meal_id: item.mealId,
        meal_name: item.name,
        qty: item.qty,
        price: item.price,
      }));
    });

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemRows);

    if (itemsError) {
      throw { message: itemsError.message };
    }

    return this.getOrderById(orderId);
  },

  // ===============================
  // PAYMENT
  // ===============================

  /**
   * This previously did two raw `.update()` calls against `orders` and
   * `order_suborders`. Both tables only ever had an admin-only UPDATE
   * policy, so — for every guest and every logged-in customer — those
   * updates silently affected 0 rows (Postgres RLS drops non-matching rows
   * rather than erroring), while the calling code saw no error and told the
   * customer their payment was submitted. The order was never actually
   * marked payment_submitted, so it never reached the admin verification
   * queue. Fixed by routing through submit_payment_proof(), a narrow
   * SECURITY DEFINER function that verifies the caller owns this specific
   * order before making the same two updates itself.
   */
  async attachPaymentProof(orderId, proofPath) {
    const { data, error } = await supabase.rpc("submit_payment_proof", {
      p_order_id: orderId,
      p_proof_path: proofPath,
    });

    if (error) {
      throw { message: error.message };
    }

    const updated = mapOrder(data);

    // Notify the customer.
    await notificationService.addNotification({
      type: "payment_submitted",
      title: "Payment submitted",
      body: `Your proof of payment for ${updated.ticketNumber} was received and is being reviewed by OfficeBites.`,
    });

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
      query = query.eq("delivery_date", date);
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
   * Moves a sub-order exactly one step forward:
   *
   * Confirmed -> Accepted -> Preparing ->
   * Ready -> Collected -> Completed
   */
  async updateSubOrderStatus(
    orderId,
    vendorId,
    nextStatus
  ) {
    const {
      data: current,
      error: fetchError,
    } = await supabase
      .from("order_suborders")
      .select("status")
      .eq("order_id", orderId)
      .eq("vendor_id", vendorId)
      .single();

    if (fetchError) {
      throw {
        message: "Order not found",
        status: 404,
      };
    }

    if (
      !isValidTransition(
        current.status,
        nextStatus
      )
    ) {
      throw {
        message: `Can't move from "${current.status}" to "${nextStatus}" — only the next step in the pipeline is allowed.`,
        status: 400,
      };
    }

    const { error } = await supabase
      .from("order_suborders")
      .update({
        status: nextStatus,
      })
      .eq("order_id", orderId)
      .eq("vendor_id", vendorId);

    if (error) {
      throw { message: error.message };
    }

    const {
      data: allSubs,
      error: allSubsError,
    } = await supabase
      .from("order_suborders")
      .select("status")
      .eq("order_id", orderId);

    if (allSubsError) {
      throw { message: allSubsError.message };
    }

    if (
      allSubs?.length &&
      allSubs.every(
        (subOrder) =>
          subOrder.status === nextStatus
      )
    ) {
      const { error: parentError } =
        await supabase
          .from("orders")
          .update({
            status: nextStatus,
          })
          .eq("id", orderId);

      if (parentError) {
        throw {
          message: parentError.message,
        };
      }
    }

    return {
      success: true,
    };
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

  // ===============================
  // VERIFY PAYMENT
  // ===============================

  async verifyPayment(orderId, approve = true) {
    const newStatus = approve
      ? ORDER_STATUS.CONFIRMED
      : ORDER_STATUS.CANCELLED;

    const { error } = await supabase
      .from("orders")
      .update({
        status: newStatus,
      })
      .eq("id", orderId);

    if (error) {
      throw { message: error.message };
    }

    const { error: subError } =
      await supabase
        .from("order_suborders")
        .update({
          status: newStatus,
          payment_status: approve
            ? PAYMENT_STATUS.PAID
            : PAYMENT_STATUS.UNPAID,
        })
        .eq("order_id", orderId);

    if (subError) {
      throw { message: subError.message };
    }

    const updated = await fetchFullOrder(
      orderId
    );

    // ---------------------------------
    // CUSTOMER NOTIFICATION
    // ---------------------------------

    if (updated.customerId) {
      await createNotificationForUser({
        userId: updated.customerId,
        type: approve
          ? "payment_verified"
          : "payment_rejected",
        title: approve
          ? "Payment verified"
          : "Payment rejected",
        body: approve
          ? `Your payment for ${updated.ticketNumber} has been verified — your order is confirmed.`
          : `We couldn't verify the payment for ${updated.ticketNumber}. Please contact support or upload valid proof.`,
      });
    }

    // ---------------------------------
    // VENDOR NOTIFICATIONS
    // ---------------------------------

    if (approve) {
      const vendorIds =
        updated.subOrders
          ?.map(
            (subOrder) =>
              subOrder.vendorId
          )
          .filter(Boolean) || [];

      const vendorProfiles =
        await getVendorOwnerIds(
          vendorIds
        );

      for (const vendorProfile of vendorProfiles) {
        await createNotificationForUser({
          userId: vendorProfile.id,
          type: "new_order",
          title: "New order received",
          body: `Order ${updated.ticketNumber} has been confirmed and is ready for you to prepare.`,
        });
      }
    }

    return {
      success: true,
    };
  },
};
