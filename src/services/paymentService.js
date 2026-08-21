import { supabase, uploadPrivate, getSignedUrl, BUCKETS } from "./api/supabaseClient";
import { calcCommission } from "../utils/orderRules";

// OfficeBites bank details are static configuration, not user data — kept
// as a plain constant rather than a table. Move to an admin-editable
// `platform_settings` table later if this needs to change without a deploy.
//
const BANK_DETAILS = {
  accountName: "OfficeBites (Pty) Ltd",
  bank: "Capitec Bank",
  accountNumber: "1807398836",
  branchCode: "410010",
  reference: "Use your ticket number as reference",
};

export const paymentService = {
  /**
   * Calls the payfast-initiate Edge Function, which authenticates the
   * request, re-derives the order's authoritative total server-side, and
   * returns a server-signed field set. The browser never computes or
   * transmits an amount — it only ever POSTs exactly what this returns.
   */
  async initiatePayfastPayment(orderId) {
    const { data, error } = await supabase.functions.invoke("payfast-initiate", {
      body: { orderId },
    });

    if (error) {
      throw new Error(error.message || "Couldn't start PayFast payment.");
    }

    return data; // { processUrl, fields }
  },

  /**
   * Builds and submits a real (non-fetch) HTML form POST to PayFast — this
   * has to be an actual browser navigation, not an XHR/fetch redirect,
   * since PayFast's checkout page isn't meant to be embedded/proxied.
   */
  redirectToPayfast({ processUrl, fields }) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = processUrl;

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  },
  /**
   * Uploads proof of payment to the private payment-proofs bucket, namespaced
   * by order id. Returns the storage PATH (not a URL) — the bucket is
   * private since payment screenshots often contain banking details, so
   * viewing it later always goes through getProofUrl() for a fresh signed URL.
   */
  async uploadProof(file, orderId) {
    const path = `${orderId}/${Date.now()}-${file.name}`;
    const storedPath = await uploadPrivate(BUCKETS.PAYMENT_PROOFS, path, file);
    return { path: storedPath, uploadedAt: new Date().toISOString() };
  },

  /** Resolves a stored proof-of-payment path to a temporary viewable URL (1 hour). Only admins can successfully call this — enforced by storage RLS. */
  async getProofUrl(path) {
    return getSignedUrl(BUCKETS.PAYMENT_PROOFS, path, 3600);
  },

  async getBankDetails() {
    return BANK_DETAILS;
  },

  calculateCommission(amount) {
    return calcCommission(amount);
  },

  // Payouts require production PayFast to be live (deferred pending
  // domain/CIPC/business registration — see project notes). Rather than
  // fabricate figures, this returns an explicit "not available yet" marker
  // the UI shows as a real empty state. Wire this to a genuine payout
  // ledger once PayFast payments are actually flowing.
  async getVendorPayouts(_vendorId) {
    return { comingSoon: true };
  },
};
