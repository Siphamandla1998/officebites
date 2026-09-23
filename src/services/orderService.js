import { supabase } from "./api/supabaseClient";
import { mapOrder, ORDER_SELECT } from "./api/mappers";
import { ORDER_STATUS } from "../utils/constants";
import { getGuestOrderAccess } from "../utils/guest";

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
   * Guest order history.
   *
   * Guest orders are not retrieved by UUID alone.
   * Each saved order must have its ticket number and original
   * checkout contact, which are verified by the database RPC.
   */
  async getGuestOrdersHistory(guestOrders = []) {
    if (!Array.isArray(guestOrders) || guestOrders.length === 0) {
      return [];
    }

    const results = await Promise.all(
      guestOrders.map(async (guestOrder) => {
        const ticketNumber = guestOrder?.ticketNumber;
        const contact = guestOrder?.contact;

        if (!ticketNumber || !contact) {
          return null;
        }

        try {
          return await orderService.trackGuestOrder(
            ticketNumber,
            contact
          );
        } catch (error) {
          console.error(
            "getGuestOrdersHistory: couldn't retrieve guest order",
            error
          );
          return null;
        }
      })
    );

    return results.filter(Boolean);
  },

  /**
   * Cross-device guest order tracking.
   *
   * Requires:
   *   1. Ticket number
   *   2. Original guest phone number
   *
   * Both are checked server-side by the SECURITY DEFINER RPC.
   */
  async trackGuestOrder(ticketNumber, contact) {
    const cleanTicketNumber = ticketNumber?.trim();
    const cleanContact = contact?.trim();

    if (!cleanTicketNumber || !cleanContact) {
      return null;
    }

    const { data, error } = await supabase.rpc(
      "get_guest_order_by_ticket_json",
      {
        p_ticket_number: cleanTicketNumber,
        p_contact: cleanContact,
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
   * Guest orders are only retrieved when this device has
   * the order ticket number and original checkout contact.
   */
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

      if (data) {
        return mapOrder(data);
      }
    }

    const guestAccess = getGuestOrderAccess(id);

    if (!guestAccess?.ticketNumber || !guestAccess?.contact) {
      return null;
    }

    const order = await orderService.trackGuestOrder(
      guestAccess.ticketNumber,
      guestAccess.contact
    );

    // The saved local order ID and the order returned by the
    // secure ticket/contact lookup must refer to the same order.
    if (!order || order.id !== id) {
      return null;
    }

    return order;
  },

  // ===============================
  // CREATE ORDER
  // ===============================

  /**
   * Creates an order through the database SECURITY DEFINER RPC.
   *
   * Do not create orders using separate browser-side inserts into:
   *   orders
   *   order_suborders
   *   order_items
   *
   * create_order_from_cart() is the secure checkout boundary.
   * Pricing and availability are verified server-side.
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

    const rpcItems = cartItems.map((item) => ({
      mealId: item.mealId,
      qty: item.qty,
    }));

    const { data, error } = await supabase.rpc(
      "create_order_from_cart",
      {
        p_customer_id: customerId || null,
        p_guest_name: customerId ? null : customerName,
        p_guest_contact: customerId ? null : guestContact,
        p_guest_email: customerId ? null : guestEmail || null,
        p_delivery_date: deliveryDate,
        p_delivery_location: deliveryLocation || null,
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

    return mapOrder(data);
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

  /**
   * PayFast-confirmed orders.
   *
   * Payment confirmation itself never happens in the browser.
   * The PayFast ITN -> Edge Function -> database confirmation
   * pipeline is responsible for changing the order status.
   */
  async getRecentPayments(limit = 10) {
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("payment_method", "payfast")
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
};