import { mockResolve } from "./api/mockAdapter";
import { vendors } from "../mock/vendors";
import { meals } from "../mock/meals";
import { reviews } from "../mock/reviews";
import { VENDOR_STATUS } from "../utils/constants";

let vendorStore = [...vendors];

export const vendorService = {
  async getVendors({ category, building, search, status } = {}) {
    let result = [...vendorStore];
    if (status) result = result.filter((v) => v.status === status);
    else result = result.filter((v) => v.status === VENDOR_STATUS.APPROVED);
    if (category) result = result.filter((v) => v.category === category);
    if (building) result = result.filter((v) => v.building === building);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (v) => v.name.toLowerCase().includes(q) || v.category.toLowerCase().includes(q)
      );
    }
    return mockResolve(result);
  },

  async getFeaturedVendors() {
    return mockResolve(vendorStore.filter((v) => v.featured && v.status === VENDOR_STATUS.APPROVED));
  },

  async getVendorById(id) {
    const vendor = vendorStore.find((v) => v.id === id);
    return mockResolve(vendor || null);
  },

  async getVendorMenu(id) {
    return mockResolve(meals.filter((m) => m.vendorId === id));
  },

  async getVendorReviews(id) {
    return mockResolve(reviews.filter((r) => r.vendorId === id));
  },

  // --- Admin actions ---
  async approveVendor(id) {
    vendorStore = vendorStore.map((v) =>
      v.id === id ? { ...v, status: VENDOR_STATUS.APPROVED } : v
    );
    return mockResolve({ success: true }, { delay: 300 });
  },

  async rejectVendor(id) {
    vendorStore = vendorStore.map((v) =>
      v.id === id ? { ...v, status: VENDOR_STATUS.REJECTED } : v
    );
    return mockResolve({ success: true }, { delay: 300 });
  },

  async suspendVendor(id) {
    vendorStore = vendorStore.map((v) =>
      v.id === id ? { ...v, status: VENDOR_STATUS.SUSPENDED } : v
    );
    return mockResolve({ success: true }, { delay: 300 });
  },

  // --- Vendor menu management ---
  async updateMealAvailability(mealId, available) {
    const meal = meals.find((m) => m.id === mealId);
    if (meal) meal.available = available;
    return mockResolve({ success: true }, { delay: 200 });
  },
};
