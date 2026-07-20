import { mockResolve } from "./api/mockAdapter";
import { users } from "../mock/users";
import { platformRevenue30d, platformStats } from "../mock/analytics";
import { ROLES } from "../utils/constants";

let userStore = [...users];

export const adminService = {
  async getCustomers() {
    return mockResolve(userStore.filter((u) => u.role === ROLES.CUSTOMER));
  },

  async suspendCustomer(id) {
    userStore = userStore.map((u) => (u.id === id ? { ...u, suspended: true } : u));
    return mockResolve({ success: true }, { delay: 250 });
  },

  async getPlatformStats() {
    return mockResolve(platformStats);
  },

  async getRevenueReport() {
    return mockResolve(platformRevenue30d);
  },
};
