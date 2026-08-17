import { supabase } from "./api/supabaseClient";
import { orderService } from "./orderService";
import { vendorService } from "./vendorService";
import { calcCommission } from "../utils/orderRules";
import { ORDER_STATUS, VENDOR_STATUS, ROLES } from "../utils/constants";

export const adminService = {
  async getCustomers() {
    const { data, error } = await supabase.from("profiles").select("*").eq("role", ROLES.CUSTOMER);
    if (error) throw { message: error.message };
    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar_url,
      building: row.building,
      suspended: row.suspended || false,
    }));
  },

  // Suspension here means "flagged in our system" — actually blocking sign-in
  // requires the Supabase service-role key (admin.updateUserById), which must
  // run server-side (an Edge Function), never in this client-side bundle.
  // This just marks the profile row for now; wire the Edge Function before
  // relying on this to actually lock an account out.
  async suspendCustomer(id) {
    const { error } = await supabase.from("profiles").update({ suspended: true }).eq("id", id);
    if (error) throw { message: error.message };
    return { success: true };
  },

  /** Live platform snapshot, computed from the current order/vendor dataset rather than fixed numbers. */
  async getPlatformStats() {
    const [orders, approvedVendors, pendingVendors, customers] = await Promise.all([
      orderService.getAllOrders(),
      vendorService.getVendors({}),
      vendorService.getVendors({ status: VENDOR_STATUS.PENDING }),
      this.getCustomers(),
    ]);

    const today = new Date().toDateString();
    const ordersToday = orders.filter((o) => new Date(o.createdAt).toDateString() === today).length;

    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const gmvThisMonth = orders
      .filter((o) => o.status !== ORDER_STATUS.CANCELLED && new Date(o.createdAt).getTime() >= monthAgo)
      .reduce((sum, o) => sum + o.total, 0);
    const { commission: commissionThisMonth } = calcCommission(gmvThisMonth);

    return {
      totalCustomers: customers.length,
      totalVendors: approvedVendors.length,
      pendingVendors: pendingVendors.length,
      ordersToday,
      gmvThisMonth,
      commissionThisMonth,
    };
  },

  // Historical GMV/commission-by-week chart — stays mock data until there's
  // enough real order history to make a real trend query meaningful. Swap
  // for a Postgres view (e.g. a weekly rollup) once you have live data.
  async getRevenueReport() {
    return platformRevenue30d;
  },
};
