import { supabase } from "./api/supabaseClient";
import { mapOrder, ORDER_SELECT } from "./api/mappers";
import {
  splitCartByVendor,
  generateTicketNumber,
} from "../utils/orderRules";
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
} from "../utils/constants";

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
    guestEmail,
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
        guest_email: customerId ? null : guestEmail || null,
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
        (sum, item) => sum + item.price * item.qty,
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

    // Notify the customer, if this order actually has one. Guest orders
    // have no customer_id and nobody to notify — this used to go through
    // notificationService.addNotification(), which resolves the *current
    // signed-in user* via auth.getUser() and throws "You must be signed
    // in" for guests. That meant every guest's proof upload succeeded in
    // the database (the RPC above) but then surfaced as a failed upload in
    // the UI, because this notification step rejected right after. Route
    // it through the same admin-safe direct insert createNotificationForUser
    // uses instead, targeted at the order's own customer_id, and don't let
    // a notification failure mask an otherwise-successful upload.
    if (updated.customerId) {
      try {
        await createNotificationForUser({
          userId: updated.customerId,
          type: "payment_submitted",
          title: "Payment submitted",
          body: `Your proof of payment for ${updated.ticketNumber} was received and is being reviewed by OfficeBites.`,
        });
      } catch (notifyError) {
        console.error("attachPaymentProof: notification failed", notifyError);
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
   *
   * Routed through update_suborder_status_and_notify() (see migration
   * 0015) rather than raw .update() calls. Two reasons: (1) that RPC is
   * also what notifies the customer of the change, and a vendor's own
   * client can't legally insert that notification directly — vendor is
   * neither the customer nor an admin under notifications RLS, so a plain
   * client-side insert would 403 the same way the admin-payment
   * notification bug did; (2) it re-checks transition validity and
   * ownership server-side rather than trusting the client's own fetch.
   * VendorOrders.jsx keeps its own local nextStatusFor() helper (driven by
   * VENDOR_ORDER_FLOW) purely to decide which button/label to show before
   * the round trip — the DB trigger and this RPC remain the source of
   * truth for whether a transition is actually allowed.
   */
  async updateSubOrderStatus(
    orderId,
    vendorId,
    nextStatus
  ) {
    if (!vendorId) {
      throw { message: "Missing vendor context", status: 400 };
    }

    // vendorId itself isn't passed to the RPC — it derives the caller's
    // vendor from current_vendor_id() server-side, which is the only copy
    // that can't be spoofed by a compromised/stale client. It's still
    // required here as a cheap client-side guard against calling this
    // without a vendor session at all.
    const { data, error } = await supabase.rpc(
      "update_suborder_status_and_notify",
      {
        p_order_id: orderId,
        p_next_status: nextStatus,
      }
    );

    if (error) {
      throw { message: error.message, status: 400 };
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

  // Orders that have actually had payment confirmed — i.e. moved past
  // pending_payment/payment_submitted into confirmed or any status beyond
  // it (accepted/preparing/ready/collected/completed). Cancelled orders
  // are excluded even if they reached confirmed at some point, since a
  // cancellation after confirmation usually means a refund/dispute, not a
  // standing successful payment. Used for the admin dashboard's "payments
  // made" widget — separate from getOrdersPendingPaymentReview(), which is
  // specifically the manual-EFT review queue.
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
      .order("created_at", { ascending: false })
      .limit(limit);

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
    // CUSTOMER + VENDOR NOTIFICATIONS
    // ---------------------------------
    //
    // The order/payment status update above is the operation that actually
    // matters and has already committed by this point. Notifications are a
    // side effect of that, not a precondition for it — if a notification
    // insert fails (RLS misconfiguration, a bad user_id, network blip), the
    // admin should still see "payment approved" rather than an error that
    // implies the approval itself failed. Each notification is attempted
    // independently and failures are logged, never thrown.
    const notifyErrors = [];

    if (updated.customerId) {
      try {
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
      } catch (err) {
        console.error("verifyPayment: customer notification failed", err);
        notifyErrors.push(err);
      }
    }

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
        try {
          await createNotificationForUser({
            userId: vendorProfile.id,
            type: "new_order",
            title: "New order received",
            body: `Order ${updated.ticketNumber} has been confirmed and is ready for you to prepare.`,
          });
        } catch (err) {
          console.error("verifyPayment: vendor notification failed", err);
          notifyErrors.push(err);
        }
      }
    }

    return {
      success: true,
      notifyErrors: notifyErrors.length ? notifyErrors.map((e) => e.message) : undefined,
    };
  },
};
