import { supabase } from "./api/supabaseClient";
import { orderService } from "./orderService";
import { vendorService } from "./vendorService";
import { calcCommission } from "../utils/orderRules";
import {
  ORDER_STATUS,
  VENDOR_STATUS,
  ROLES,
} from "../utils/constants";

export const adminService = {
  async getCustomers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", ROLES.CUSTOMER);

    if (error) {
      throw { message: error.message };
    }

    return (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      avatar: row.avatar_url,
      building: row.building,
      suspended: row.suspended || false,
    }));
  },

  // Suspension here means the customer is flagged in the
  // OfficeBites profile data.
  //
  // Actually disabling Supabase Auth access requires a
  // privileged server-side operation and must never expose
  // the service-role key in the browser.
  async suspendCustomer(id) {
    const { error } = await supabase
      .from("profiles")
      .update({
        suspended: true,
      })
      .eq("id", id);

    if (error) {
      throw { message: error.message };
    }

    return {
      success: true,
    };
  },

  /**
   * Live platform snapshot computed from the current
   * order, vendor and customer datasets.
   *
   * Payment-review counts are intentionally absent.
   * PayFast payments are confirmed automatically through
   * the server-side PayFast notification flow.
   */
  async getPlatformStats() {
    const [
      orders,
      approvedVendors,
      pendingVendors,
      customers,
    ] = await Promise.all([
      orderService.getAllOrders(),
      vendorService.getVendors({}),
      vendorService.getVendors({
        status: VENDOR_STATUS.PENDING,
      }),
      this.getCustomers(),
    ]);

    const today = new Date().toDateString();

    const ordersToday = orders.filter(
      (order) =>
        new Date(order.createdAt).toDateString() ===
        today
    ).length;

    const monthAgo =
      Date.now() - 30 * 24 * 60 * 60 * 1000;

    const gmvThisMonth = orders
      .filter(
        (order) =>
          order.status !== ORDER_STATUS.CANCELLED &&
          new Date(order.createdAt).getTime() >=
            monthAgo
      )
      .reduce(
        (sum, order) => sum + order.total,
        0
      );

    const {
      commission: commissionThisMonth,
    } = calcCommission(gmvThisMonth);

    return {
      totalCustomers: customers.length,
      totalVendors: approvedVendors.length,
      pendingVendors: pendingVendors.length,
      ordersToday,
      gmvThisMonth,
      commissionThisMonth,
    };
  },

  /**
   * Historical GMV/commission-by-week chart.
   *
   * No real weekly rollup exists yet, so return no data
   * rather than displaying fabricated financial trends.
   */
  async getRevenueReport() {
    return [];
  },
};