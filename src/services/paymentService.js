import { supabase } from "./api/supabaseClient";
import { calcCommission } from "../utils/orderRules";

export const paymentService = {
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
      throw new Error(
        error.message || "Couldn't start PayFast payment."
      );
    }

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

  calculateCommission(amount) {
    return calcCommission(amount);
  },

  async getVendorPayouts(_vendorId) {
    return { comingSoon: true };
  },
};