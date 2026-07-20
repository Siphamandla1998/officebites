import { mockResolve } from "./api/mockAdapter";
import { calcCommission } from "../utils/orderRules";

export const paymentService = {
  /** Simulates uploading proof-of-payment; returns an object URL in the mock layer. */
  async uploadProof(file) {
    const url = URL.createObjectURL(file);
    return mockResolve({ url, uploadedAt: new Date().toISOString() }, { delay: 700 });
  },

  async getBankDetails() {
    return mockResolve({
      accountName: "OfficeBites (Pty) Ltd",
      bank: "FNB Business",
      accountNumber: "6298 1147 502",
      branchCode: "250655",
      reference: "Use your ticket number as reference",
    });
  },

  calculateCommission(amount) {
    return calcCommission(amount);
  },

  async getVendorPayouts(vendorId) {
    // Mock payout ledger for the vendor revenue dashboard.
    return mockResolve([
      { id: "p-1", date: "2026-07-11", gross: 890, commission: 89, net: 801, status: "paid" },
      { id: "p-2", date: "2026-07-14", gross: 1340, commission: 134, net: 1206, status: "paid" },
      { id: "p-3", date: "2026-07-17", gross: 1680, commission: 168, net: 1512, status: "pending" },
    ]);
  },
};
