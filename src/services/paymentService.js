import { uploadPrivate, getSignedUrl, BUCKETS } from "./api/supabaseClient";
import { calcCommission } from "../utils/orderRules";

// OfficeBites bank details are static configuration, not user data — kept
// as a plain constant rather than a table. Move to an admin-editable
// `platform_settings` table later if this needs to change without a deploy.
const BANK_DETAILS = {
  accountName: "OfficeBites (Pty) Ltd",
  bank: "FNB Business",
  accountNumber: "6298 1147 502",
  branchCode: "250655",
  reference: "Use your ticket number as reference",
};

export const paymentService = {
  /**
   * Uploads proof of payment to the private payment-proofs bucket, namespaced
   * by order id. Returns the storage PATH (not a URL) — the bucket is
   * private since payment screenshots often contain banking details, so
   * viewing it later always goes through getProofUrl() for a fresh signed URL.
   */
  async uploadProof(file, orderId) {
    if (!file || !orderId) throw new Error("Payment proof and order ID are required.");
    if (!file.type?.startsWith("image/")) throw new Error("Payment proof must be an image.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Payment proof must be smaller than 5MB.");
    const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9.-]/g, "");
    const path = `${orderId}/${Date.now()}-${safeName}`;
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
