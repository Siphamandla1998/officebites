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

  async getRevenueReport() {
    const orders = await orderService.getAllOrders();
    const now = new Date();
    const weeks = Array.from({ length: 4 }, (_, index) => {
      const end = new Date(now);
      end.setDate(now.getDate() - index * 7);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const matching = orders.filter((order) => {
        const created = new Date(order.createdAt);
        return created >= start && created <= end && order.status !== ORDER_STATUS.CANCELLED;
      });
      const gmv = matching.reduce((sum, order) => sum + Number(order.total || 0), 0);
      return {
        week: `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}–${end.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
        gmv,
        commission: calcCommission(gmv).commission,
      };
    });
    return weeks.reverse();
  },
};
