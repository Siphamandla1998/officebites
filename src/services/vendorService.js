import { mockResolve } from "./api/mockAdapter";
import { vendors } from "../mock/vendors";
import { getMeals, setMeals } from "./mealStore";
import { reviews } from "../mock/reviews";
import { orderService } from "./orderService";
import { VENDOR_STATUS, ORDER_STATUS } from "../utils/constants";

let vendorStore = [...vendors];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysAgo = (n) => {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
};

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
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q) ||
          getMeals().some((m) => m.vendorId === v.id && m.name.toLowerCase().includes(q))
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
    return mockResolve(getMeals().filter((m) => m.vendorId === id));
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

  // --- Vendor menu management (full CRUD) ---
  async addMeal(vendorId, meal) {
    const newMeal = {
      id: `m-${Date.now()}`,
      vendorId,
      vendorName: vendorStore.find((v) => v.id === vendorId)?.name || "",
      available: true,
      featured: false,
      rating: 0,
      reviewCount: 0,
      tags: [],
      ...meal,
    };
    setMeals((prev) => [newMeal, ...prev]);
    return mockResolve(newMeal, { delay: 350 });
  },

  async updateMeal(mealId, updates) {
    setMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, ...updates } : m)));
    return mockResolve(getMeals().find((m) => m.id === mealId), { delay: 300 });
  },

  async deleteMeal(mealId) {
    setMeals((prev) => prev.filter((m) => m.id !== mealId));
    return mockResolve({ success: true }, { delay: 250 });
  },

  async updateMealAvailability(mealId, available) {
    setMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, available } : m)));
    return mockResolve({ success: true }, { delay: 200 });
  },

  async updateMealFeatured(mealId, featured) {
    setMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, featured } : m)));
    return mockResolve({ success: true }, { delay: 200 });
  },

  // --- Vendor profile / settings ---
  async updateVendorProfile(vendorId, updates) {
    vendorStore = vendorStore.map((v) => (v.id === vendorId ? { ...v, ...updates } : v));
    return mockResolve(vendorStore.find((v) => v.id === vendorId), { delay: 400 });
  },

  // --- Dashboard analytics (computed live from the current order dataset) ---
  async getDashboardStats(vendorId) {
    const orders = await orderService.getOrdersForVendor(vendorId);
    const menu = getMeals().filter((m) => m.vendorId === vendorId);
    const today = startOfDay(new Date()).getTime();
    const weekAgo = daysAgo(7).getTime();
    const monthAgo = daysAgo(30).getTime();

    const revenueSince = (cutoff) =>
      orders
        .filter((o) => new Date(o.createdAt).getTime() >= cutoff)
        .filter((o) => o.subOrder.status !== ORDER_STATUS.CANCELLED)
        .reduce((sum, o) => sum + o.subOrder.subtotal, 0);

    const countByStatus = (status) => orders.filter((o) => o.subOrder.status === status).length;
    const todaysOrders = orders.filter(
      (o) => startOfDay(new Date(o.createdAt)).getTime() === today
    );

    const completedOrders = orders.filter((o) => o.subOrder.status === ORDER_STATUS.COMPLETED);
    const validOrders = orders.filter((o) => o.subOrder.status !== ORDER_STATUS.CANCELLED);
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.subOrder.subtotal, 0);
    const averageOrderValue = validOrders.length ? totalRevenue / validOrders.length : 0;

    // Tally item quantities sold across all non-cancelled sub-orders.
    const itemTally = {};
    validOrders.forEach((o) => {
      o.subOrder.items.forEach((item) => {
        itemTally[item.mealId] = (itemTally[item.mealId] || 0) + item.qty;
      });
    });
    const topMealId = Object.entries(itemTally).sort((a, b) => b[1] - a[1])[0]?.[0];
    const mostPopularMeal = menu.find((m) => m.id === topMealId) || null;

    const categoryTally = {};
    validOrders.forEach((o) => {
      o.subOrder.items.forEach((item) => {
        const meal = menu.find((m) => m.id === item.mealId);
        if (!meal) return;
        categoryTally[meal.category] = (categoryTally[meal.category] || 0) + item.qty;
      });
    });
    const bestSellingCategory = Object.entries(categoryTally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return mockResolve({
      todaysOrders: todaysOrders.length,
      pendingOrders: countByStatus(ORDER_STATUS.PAYMENT_SUBMITTED) + countByStatus(ORDER_STATUS.CONFIRMED),
      confirmedOrders: countByStatus(ORDER_STATUS.CONFIRMED),
      preparingOrders: countByStatus(ORDER_STATUS.PREPARING),
      readyOrders: countByStatus(ORDER_STATUS.READY),
      deliveredOrders: countByStatus(ORDER_STATUS.COMPLETED),
      cancelledOrders: countByStatus(ORDER_STATUS.CANCELLED),
      todaysRevenue: revenueSince(today),
      weeklyRevenue: revenueSince(weekAgo),
      monthlyRevenue: revenueSince(monthAgo),
      totalOrders: orders.length,
      averageOrderValue,
      mostPopularMeal,
      bestSellingCategory,
      completedCount: completedOrders.length,
    });
  },

  /** Ranks this vendor's meals by units sold within a period (today/week/month/all). */
  async getPopularMealsForVendor(vendorId, period = "all") {
    const orders = await orderService.getOrdersForVendor(vendorId);
    const menu = getMeals().filter((m) => m.vendorId === vendorId);
    const cutoff =
      period === "today" ? startOfDay(new Date()).getTime()
      : period === "week" ? daysAgo(7).getTime()
      : period === "month" ? daysAgo(30).getTime()
      : 0;

    const relevant = orders
      .filter((o) => o.subOrder.status !== ORDER_STATUS.CANCELLED)
      .filter((o) => new Date(o.createdAt).getTime() >= cutoff);

    const tally = {};
    let totalUnits = 0;
    relevant.forEach((o) => {
      o.subOrder.items.forEach((item) => {
        if (!tally[item.mealId]) tally[item.mealId] = { qty: 0, revenue: 0 };
        tally[item.mealId].qty += item.qty;
        tally[item.mealId].revenue += item.qty * item.price;
        totalUnits += item.qty;
      });
    });

    const ranked = menu
      .map((meal) => ({
        meal,
        salesCount: tally[meal.id]?.qty || 0,
        revenue: tally[meal.id]?.revenue || 0,
        popularityPct: totalUnits ? Math.round(((tally[meal.id]?.qty || 0) / totalUnits) * 100) : 0,
      }))
      .sort((a, b) => b.salesCount - a.salesCount);

    return mockResolve(ranked);
  },
};
