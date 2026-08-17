import { supabase, uploadPrivate, getSignedUrl, BUCKETS } from "./api/supabaseClient";
import { calcCommission } from "../utils/orderRules";

// OfficeBites bank details are static configuration, not user data — kept
// as a plain constant rather than a table. Move to an admin-editable
// `platform_settings` table later if this needs to change without a deploy.
//
// ⚠️ UNVERIFIED — flagged explicitly per your Phase 6 instruction. These
// values have not been confirmed as real. Do not treat this as a working
// bank account and do not remove this warning until you've confirmed the
// details are correct — customers would be told to EFT real money to
// whatever is here.
const BANK_DETAILS = {
  accountName: "OfficeBites (Pty) Ltd",
  bank: "FNB Business",
  accountNumber: "6298 1147 502",
  branchCode: "250655",
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

  // Payout ledger stays mock for now — the vendor dashboard/finances view
  // is being revisited separately, so this intentionally isn't wired to a
  // real table yet. Convert alongside the rest of the vendor dashboard.
  async getVendorPayouts(_vendorId) {
    return [
      { id: "p-1", date: "2026-07-11", gross: 890, commission: 89, net: 801, status: "paid" },
      { id: "p-2", date: "2026-07-14", gross: 1340, commission: 134, net: 1206, status: "paid" },
      { id: "p-3", date: "2026-07-17", gross: 1680, commission: 168, net: 1512, status: "pending" },
    ];
  },
};
