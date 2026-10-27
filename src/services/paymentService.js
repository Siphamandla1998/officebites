import { supabase } from "./api/supabaseClient";
import { calcCommission } from "../utils/orderRules";

export const paymentService = {
  async initiateOzowPayment(orderId, guestContact = null) {
    const { data, error } = await supabase.functions.invoke('ozow-initiate', {
      body: { orderId, ...(guestContact ? { guestContact } : {}) },
    });
    if (error || data?.error) throw new Error('Ozow initiation was not confirmed. Check your order and contact support before retrying.');
    const url = new URL(data?.redirectUrl || '');
    if (url.protocol !== 'https:' || url.username || url.password ||
        !(url.hostname === 'ozow.com' || url.hostname.endsWith('.ozow.com'))) throw new Error('Invalid Ozow checkout address.');
    return url.href;
  },
  async cancelUnpaidOrder(orderId, guestAccess = null) {
    const { data, error } = await supabase.rpc('cancel_unpaid_order', {
      p_order_id: orderId,
      p_ticket_number: guestAccess?.ticketNumber || null,
      p_guest_contact: guestAccess?.contact || null,
    });
    if (error) throw new Error(error.message || 'Cancellation failed. Refresh the order before retrying.');
    return data;
  },
  /**
   * Starts a PayFast payment using the server-side Edge Function.
   *
   * The browser never supplies the payment amount. The Edge Function
   * retrieves the authoritative order total from Supabase and signs the
   * PayFast request server-side.
   *
   * Guest orders also provide the original checkout contact so knowing an
   * order UUID alone is not enough to initiate payment.
   */
  async initiatePayfastPayment(orderId, guestContact = null) {
    const { data, error } = await supabase.functions.invoke(
      "payfast-initiate",
      {
        body: {
          orderId,
          ...(guestContact ? { guestContact } : {}),
        },
      }
    );

    if (error) {
      let message = error.message || "Couldn't start PayFast payment.";
      try {
        const body = await error.context?.json();
        if (body?.error) message = body.error;
      } catch { /* Keep the original error if no JSON body is available. */ }
      throw new Error(message);
    }

    if (data?.error) throw new Error(data.error);

    if (!data?.processUrl || !data?.fields) {
      throw new Error(
        "PayFast returned an invalid payment response."
      );
    }

    return data;
  },

  /**
   * PayFast requires a normal browser form POST rather than an XHR redirect.
   */
  redirectToPayfast({ processUrl, fields }) {
    if (!["https://www.payfast.co.za/eng/process", "https://sandbox.payfast.co.za/eng/process"].includes(processUrl)) {
      throw new Error("Payment service returned an invalid PayFast address.");
    }
    const form = document.createElement("form");

    form.method = "POST";
    form.action = processUrl;

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement("input");

      input.type = "hidden";
      input.name = name;
      input.value = String(value);

      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  },

  calculateCommission(amount, rate) {
    return calcCommission(amount, rate);
  },

  async getVendorPayouts(_vendorId) {
    return { comingSoon: true };
  },
};
