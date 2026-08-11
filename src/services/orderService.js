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
   * Used for guest order history.
   */
  async getOrdersByIds(ids = []) {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .in("id", ids);

    if (error) {
      throw { message: error.message };
    }

    return (data || []).map(mapOrder);
  },

  async getOrderById(id) {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw { message: error.message };
    }

    return mapOrder(data);
  },

  // ===============================
  // CREATE ORDER
  // ===============================

  /**
   * One checkout creates one customer-facing order,
   * internally split by vendor.
   */
  async createOrder({
    customerId,
    customerName,
    guestContact,
    deliveryDate,
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

    const { data: orderRow, error: orderError } =
      await supabase
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

    if (orderError) {
      throw { message: orderError.message };
    }

    const { data: suborderRows, error: suborderError } =
      await supabase
        .from("order_suborders")
        .insert(
          groups.map((group) => ({
            order_id: orderRow.id,
            vendor_id: group.vendorId,
            status: ORDER_STATUS.PENDING_PAYMENT,
            payment_status: PAYMENT_STATUS.UNPAID,
            subtotal: group.items.reduce(
              (sum, item) =>
                sum + item.price * item.qty,
              0
            ),
          }))
        )
        .select();

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

    return fetchFullOrder(orderRow.id);
  },

  // ===============================
  // PAYMENT
  // ===============================

  async attachPaymentProof(orderId, proofPath, ticketNumber = null) {
    if (!orderId || !proofPath) {
      throw { message: "Order ID and proof path are required." };
    }

    const { error } = await supabase.rpc("submit_payment_proof", {
      p_order_id: orderId,
      p_proof_path: proofPath,
      p_ticket_number: ticketNumber,
    });

    if (error) {
      throw { message: error.message };
    }

    const updated = await fetchFullOrder(orderId);

    // Notify the customer.
    if (updated.customerId) {
      await notificationService.addNotification({
        type: "payment_submitted",
        title: "Payment submitted",
        body: `Your proof of payment for ${updated.ticketNumber} was received and is being reviewed by OfficeBites.`,
      });
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
