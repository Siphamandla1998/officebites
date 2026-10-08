import { supabase } from "./api/supabaseClient";
import { ROLES } from "../utils/constants";

import { financialService } from './financialService';

export const adminService = {
  async getCustomers() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", ROLES.CUSTOMER);

    if (error) {
      throw { message: error.message };
    }

    return (data || []).filter(row => !row.deleted_at).map((row) => ({
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

  async getPlatformAnalytics(period = 'month') {
    const report = await financialService.report({ period });
    return { ...report, ...report.totals };
  },
  async getCategoryDemand(period = 'month') { return (await financialService.report({period})).categories; },
  async getPlatformStats() {
    const a = await this.getPlatformAnalytics('month');
    return {totalCustomers:a.customers,totalVendors:a.activeVendors,pendingVendors:a.pendingVendors,ordersToday:a.ordersToday,gmvThisMonth:a.gmv,commissionThisMonth:a.grossCommission,processorFees:a.processorFees,netMarketplaceRevenue:a.netMarketplaceRevenue,unresolvedCommission:a.unresolvedCommission};
  },
  async getRevenueReport() { return (await this.getPlatformAnalytics('month')).weekly; },
};
