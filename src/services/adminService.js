import { supabase } from "./api/supabaseClient";
import { ROLES } from "../utils/constants";

const unwrapRpc = (data) => data || {};

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

  async suspendCustomer(id) {
    const { error } = await supabase
      .from("profiles")
      .update({ suspended: true })
      .eq("id", id);

    if (error) {
      throw { message: error.message };
    }

    return { success: true };
  },

  /**
   * Authoritative marketplace analytics.
   *
   * Values are calculated by PostgreSQL from actual orders,
   * vendor commission rates and PayFast processing data.
   * Never substitute mock/fallback financial figures here.
   */
  async getPlatformAnalytics(days = 28) {
    const { data, error } = await supabase.rpc(
      "get_admin_platform_analytics",
      { p_days: days }
    );

    if (error) {
      throw { message: error.message };
    }

    const result = unwrapRpc(data);

    return {
      customers: Number(result.customers || 0),
      activeVendors: Number(result.activeVendors || 0),
      pendingVendors: Number(result.pendingVendors || 0),
      ordersToday: Number(result.ordersToday || 0),
      paidOrders: Number(result.paidOrders || 0),
      gmv: Number(result.gmv || 0),
      averageOrderValue: Number(
        result.averageOrderValue || 0
      ),
      grossCommission: Number(
        result.grossCommission || 0
      ),
      processorFees: Number(
        result.processorFees || 0
      ),
      netMarketplaceRevenue: Number(
        result.netMarketplaceRevenue || 0
      ),
      weekly: (result.weekly || []).map((row) => ({
        ...row,
        gmv: Number(row.gmv || 0),
        grossCommission: Number(
          row.grossCommission || 0
        ),
      })),
      topVendors: (result.topVendors || []).map(
        (vendor) => ({
          ...vendor,
          orders: Number(vendor.orders || 0),
          gmv: Number(vendor.gmv || 0),
          grossCommission: Number(
            vendor.grossCommission || 0
          ),
        })
      ),
    };
  },

  async getCategoryDemand(days = 28) {
    const { data, error } = await supabase.rpc(
      "get_admin_category_demand",
      { p_days: days }
    );

    if (error) {
      throw { message: error.message };
    }

    return (data || []).map((row) => ({
      category: row.category || "Other",
      units: Number(row.units || 0),
      revenue: Number(row.revenue || 0),
    }));
  },

  // Compatibility while the rest of the admin UI is migrated.
  async getPlatformStats() {
    const analytics =
      await this.getPlatformAnalytics(30);

    return {
      totalCustomers: analytics.customers,
      totalVendors: analytics.activeVendors,
      pendingVendors: analytics.pendingVendors,
      ordersToday: analytics.ordersToday,
      gmvThisMonth: analytics.gmv,
      commissionThisMonth:
        analytics.grossCommission,
      processorFees:
        analytics.processorFees,
      netMarketplaceRevenue:
        analytics.netMarketplaceRevenue,
    };
  },

  async getRevenueReport(days = 28) {
    const analytics =
      await this.getPlatformAnalytics(days);

    return analytics.weekly.map((row) => ({
      week: row.week,
      gmv: row.gmv,
      commission: row.grossCommission,
    }));
  },
};