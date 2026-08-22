import {
  supabase,
  uploadToBucket,
  BUCKETS,
} from "./api/supabaseClient";

import {
  mapVendor,
  mapMeal,
  mapReview,
} from "./api/mappers";

import { VENDOR_STATUS, ORDER_STATUS } from "../utils/constants";
import { orderService } from "./orderService";

const DEFAULT_MEAL_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80";

/**
 * Upload a meal image to Supabase Storage.
 */
const uploadMealImage = async (vendorId, file) => {
  if (!file) {
    return null;
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be smaller than 5MB.");
  }

  const safeName = file.name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.-]/g, "");

  const path = `${vendorId}/${Date.now()}-${safeName}`;

  return uploadToBucket(
    BUCKETS.MEAL_IMAGES,
    path,
    file
  );
};

/**
 * Upload a vendor logo/cover image to Supabase Storage.
 */
const uploadVendorImage = async (vendorId, file) => {
  if (!file) {
    return null;
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be smaller than 5MB.");
  }

  const safeName = file.name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.-]/g, "");

  const path = `${vendorId}/${Date.now()}-${safeName}`;

  return uploadToBucket(
    BUCKETS.VENDOR_IMAGES,
    path,
    file
  );
};

export const vendorService = {
  /**
   * Real per-meal sales ranking for the vendor, for VendorInsights.jsx.
   * period is one of "today" | "week" | "month" | "all". No fabricated
   * numbers — a meal with zero sales in the period is simply absent from
   * the result, and a vendor with no sales at all gets an empty array.
   */
  async getPopularMealsForVendor(vendorId, period = "all") {
    if (!vendorId) return [];

    const [orders, menu] = await Promise.all([
      orderService.getOrdersForVendor(vendorId),
      this.getVendorMenu(vendorId),
    ]);

    if (orders.length === 0) return [];

    const now = Date.now();
    const startOfDay = new Date().setHours(0, 0, 0, 0);
    const windowStart =
      period === "today"
        ? startOfDay
        : period === "week"
          ? now - 7 * 24 * 60 * 60 * 1000
          : period === "month"
            ? now - 30 * 24 * 60 * 60 * 1000
            : null; // "all" — no lower bound

    const REVENUE_STATUSES = new Set([
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.ACCEPTED,
      ORDER_STATUS.PREPARING,
      ORDER_STATUS.READY,
      ORDER_STATUS.COLLECTED,
      ORDER_STATUS.COMPLETED,
    ]);

    const salesByMealId = new Map(); // mealId -> { salesCount, revenue }

    for (const order of orders) {
      const sub = order.subOrder;
      if (!sub || !REVENUE_STATUSES.has(sub.status)) continue;

      const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : null;
      if (windowStart !== null && (createdAt === null || createdAt < windowStart)) continue;

      for (const item of sub.items) {
        const entry = salesByMealId.get(item.mealId) || { salesCount: 0, revenue: 0 };
        entry.salesCount += item.qty;
        entry.revenue += item.qty * item.price;
        salesByMealId.set(item.mealId, entry);
      }
    }

    const totalUnits = Array.from(salesByMealId.values()).reduce((sum, e) => sum + e.salesCount, 0);

    return menu
      .filter((meal) => salesByMealId.has(meal.id))
      .map((meal) => {
        const { salesCount, revenue } = salesByMealId.get(meal.id);
        return {
          meal,
          salesCount,
          revenue,
          popularityPct: totalUnits > 0 ? Math.round((salesCount / totalUnits) * 100) : 0,
        };
      })
      .sort((a, b) => b.salesCount - a.salesCount);
  },


  /**
   * Real vendor dashboard stats, computed from the vendor's own orders
   * (order_suborders — RLS-scoped to current_vendor_id(), plus the
   * orders_select_vendor fix that makes the parent order data visible at
   * all — see the vendor-order-visibility migration). No fabricated
   * numbers: a brand-new vendor with no orders gets all-zero/null values,
   * which is the honest state, not an error.
   */
  async getDashboardStats(vendorId) {
    const empty = {
      todaysOrders: 0,
      pendingOrders: 0,
      confirmedOrders: 0,
      preparingOrders: 0,
      readyOrders: 0,
      deliveredOrders: 0,
      cancelledOrders: 0,
      totalOrders: 0,
      todaysRevenue: 0,
      weeklyRevenue: 0,
      monthlyRevenue: 0,
      averageOrderValue: 0,
      mostPopularMeal: null,
      bestSellingCategory: null,
      revenueChart: [],
    };

    if (!vendorId) return empty;

    const [orders, menu] = await Promise.all([
      orderService.getOrdersForVendor(vendorId),
      this.getVendorMenu(vendorId),
    ]);

    if (orders.length === 0) return empty;

    const categoryByMealId = new Map(menu.map((m) => [m.id, m.category]));

    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today = startOfDay(new Date());
    const weekAgo = today - 6 * 24 * 60 * 60 * 1000; // last 7 days inclusive of today
    const monthAgo = today - 29 * 24 * 60 * 60 * 1000; // last 30 days inclusive of today

    // Only statuses where payment has actually been confirmed count as
    // revenue — pending_payment/payment_submitted are not yet real money,
    // cancelled never was.
    const REVENUE_STATUSES = new Set([
      ORDER_STATUS.CONFIRMED,
      ORDER_STATUS.ACCEPTED,
      ORDER_STATUS.PREPARING,
      ORDER_STATUS.READY,
      ORDER_STATUS.COLLECTED,
      ORDER_STATUS.COMPLETED,
    ]);

    let todaysOrders = 0;
    let pendingOrders = 0;
    let confirmedOrders = 0;
    let preparingOrders = 0;
    let readyOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;

    let todaysRevenue = 0;
    let weeklyRevenue = 0;
    let monthlyRevenue = 0;
    let monthlyRevenueOrderCount = 0;

    const revenueByDay = new Map(); // 'YYYY-MM-DD' -> number, seeded below
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today - i * 24 * 60 * 60 * 1000);
      revenueByDay.set(d.toISOString().slice(0, 10), 0);
    }

    const qtyByMealId = new Map();
    const qtyByCategory = new Map();

    for (const order of orders) {
      const sub = order.subOrder;
      if (!sub) continue;

      const createdAt = order.createdAt ? new Date(order.createdAt).getTime() : null;
      const dayStart = createdAt !== null ? startOfDay(new Date(createdAt)) : null;
      const isRevenue = REVENUE_STATUSES.has(sub.status);

      switch (sub.status) {
        case ORDER_STATUS.PENDING_PAYMENT:
        case ORDER_STATUS.PAYMENT_SUBMITTED:
          pendingOrders += 1;
          break;
        case ORDER_STATUS.CONFIRMED:
          confirmedOrders += 1;
          break;
        case ORDER_STATUS.ACCEPTED:
        case ORDER_STATUS.PREPARING:
          preparingOrders += 1;
          break;
        case ORDER_STATUS.READY:
          readyOrders += 1;
          break;
        case ORDER_STATUS.COLLECTED:
        case ORDER_STATUS.COMPLETED:
          deliveredOrders += 1;
          break;
        case ORDER_STATUS.CANCELLED:
          cancelledOrders += 1;
          break;
        default:
          break;
      }

      if (dayStart === today) todaysOrders += 1;

      if (isRevenue) {
        if (dayStart === today) todaysRevenue += sub.subtotal;
        if (dayStart !== null && dayStart >= weekAgo) weeklyRevenue += sub.subtotal;
        if (dayStart !== null && dayStart >= monthAgo) {
          monthlyRevenue += sub.subtotal;
          monthlyRevenueOrderCount += 1;
        }
        if (dayStart !== null && dayStart >= weekAgo) {
          const key = new Date(dayStart).toISOString().slice(0, 10);
          if (revenueByDay.has(key)) {
            revenueByDay.set(key, revenueByDay.get(key) + sub.subtotal);
          }
        }

        for (const item of sub.items) {
          qtyByMealId.set(item.mealId, (qtyByMealId.get(item.mealId) || 0) + item.qty);
          const category = categoryByMealId.get(item.mealId);
          if (category) {
            qtyByCategory.set(category, (qtyByCategory.get(category) || 0) + item.qty);
          }
        }
      }
    }

    let mostPopularMeal = null;
    let topQty = 0;
    for (const [mealId, qty] of qtyByMealId.entries()) {
      if (qty > topQty) {
        topQty = qty;
        const meal = menu.find((m) => m.id === mealId);
        mostPopularMeal = meal ? { name: meal.name } : null;
      }
    }

    let bestSellingCategory = null;
    let topCategoryQty = 0;
    for (const [category, qty] of qtyByCategory.entries()) {
      if (qty > topCategoryQty) {
        topCategoryQty = qty;
        bestSellingCategory = category;
      }
    }

    const revenueChart = Array.from(revenueByDay.entries()).map(([dateKey, revenue]) => ({
      day: new Date(dateKey).toLocaleDateString(undefined, { weekday: "short" }),
      revenue,
    }));

    return {
      todaysOrders,
      pendingOrders,
      confirmedOrders,
      preparingOrders,
      readyOrders,
      deliveredOrders,
      cancelledOrders,
      totalOrders: orders.length,
      todaysRevenue,
      weeklyRevenue,
      monthlyRevenue,
      averageOrderValue: monthlyRevenueOrderCount > 0 ? monthlyRevenue / monthlyRevenueOrderCount : 0,
      mostPopularMeal,
      bestSellingCategory,
      revenueChart,
    };
  },


  // =========================================================
  // CUSTOMER VENDOR FETCHING
  // =========================================================

  async getVendors({
    category,
    building,
    search,
    status,
  } = {}) {
    let query = supabase
      .from("vendors")
      .select("*");

    if (status) {
      query = query.eq("status", status);
    } else {
      query = query.eq(
        "status",
        VENDOR_STATUS.APPROVED
      );
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (building) {
      query = query.eq("building", building);
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,category.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(mapVendor);
  },

  async getFeaturedVendors() {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("featured", true)
      .eq(
        "status",
        VENDOR_STATUS.APPROVED
      );

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(mapVendor);
  },

  async getVendorById(id) {
    if (!id) {
      return null;
    }

    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapVendor(data) : null;
  },

  async getVendorMenu(vendorId, { forDate } = {}) {
    if (!vendorId) {
      return [];
    }

    const { data, error } = await supabase
      .from("meals")
      .select(`
        *,
        vendors!inner(
          name,
          status
        )
      `)
      .eq("vendor_id", vendorId)
      .eq(
        "vendors.status",
        VENDOR_STATUS.APPROVED
      )
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || [])
      .map(mapMeal)
      .filter((meal) => {
        if (!forDate || !meal.availableDays) return true;
        const weekday = new Date(forDate).getDay();
        return meal.availableDays.includes(weekday);
      });
  },

  async getVendorReviews(vendorId) {
    if (!vendorId) {
      return [];
    }

    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(mapReview);
  },

  // =========================================================
  // ADMIN VENDOR MANAGEMENT
  // =========================================================

  async approveVendor(vendorId) {
    const { error } = await supabase
      .from("vendors")
      .update({
        status: VENDOR_STATUS.APPROVED,
      })
      .eq("id", vendorId);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },

  async restoreVendor(vendorId) {
    const { error } = await supabase
      .from("vendors")
      .update({
        status: VENDOR_STATUS.APPROVED,
      })
      .eq("id", vendorId)
      .eq("status", VENDOR_STATUS.SUSPENDED);
  
    if (error) {
      throw new Error(error.message);
    }
  
    return {
      success: true,
    };
  },

  async rejectVendor(vendorId) {
    const { error } = await supabase
      .from("vendors")
      .update({
        status: VENDOR_STATUS.REJECTED,
      })
      .eq("id", vendorId);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },

  async approveVendor(vendorId) {
    const { error } = await supabase
      .from("vendors")
      .update({ status: VENDOR_STATUS.APPROVED })
      .eq("id", vendorId);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async rejectVendor(vendorId) {
    const { error } = await supabase
      .from("vendors")
      .update({ status: VENDOR_STATUS.REJECTED })
      .eq("id", vendorId);
    if (error) throw new Error(error.message);
    return { success: true };
  },

  async suspendVendor(vendorId) {
    const { error } = await supabase
      .from("vendors")
      .update({
        status: VENDOR_STATUS.SUSPENDED,
      })
      .eq("id", vendorId);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },

  // =========================================================
  // MEAL CRUD
  // =========================================================

  async addMeal(vendorId, meal) {
    if (!vendorId) {
      throw new Error("Vendor ID is required.");
    }

    if (!meal?.name?.trim()) {
      throw new Error("Meal name is required.");
    }

    if (
      meal.price === undefined ||
      meal.price === null ||
      meal.price === ""
    ) {
      throw new Error("Meal price is required.");
    }

    const price = Number(meal.price);

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Meal price must be greater than zero.");
    }

    let image = DEFAULT_MEAL_IMAGE;

    if (meal.imageFile) {
      image = await uploadMealImage(
        vendorId,
        meal.imageFile
      );
    }

    const { data, error } = await supabase
      .from("meals")
      .insert({
        vendor_id: vendorId,
        name: meal.name.trim(),
        description: meal.description?.trim() || "",
        price,
        category: meal.category || "Meals",
        image,
        preparation_time: Number(
          meal.preparationTime || 0
        ),
        available: meal.available ?? true,
        featured: meal.featured ?? false,
        tags: meal.tags || [],
        available_days:
          Array.isArray(meal.availableDays) && meal.availableDays.length < 7
            ? meal.availableDays
            : null, // all 7 days checked (or unset) = "every day"
      })
      .select(`
        *,
        vendors(name)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapMeal(data);
  },

  async updateMeal(mealId, updates = {}) {
    if (!mealId) {
      throw new Error("Meal ID is required.");
    }

    let image = updates.image;

    if (updates.imageFile) {
      if (!updates.vendorId) {
        throw new Error(
          "Vendor ID is required to upload an image."
        );
      }

      image = await uploadMealImage(
        updates.vendorId,
        updates.imageFile
      );
    }

    const patch = {};

    if (updates.name !== undefined) {
      patch.name = updates.name.trim();
    }

    if (updates.description !== undefined) {
      patch.description =
        updates.description?.trim() || "";
    }

    if (updates.price !== undefined) {
      const price = Number(updates.price);

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(
          "Meal price must be greater than zero."
        );
      }

      patch.price = price;
    }

    if (updates.category !== undefined) {
      patch.category = updates.category;
    }

    if (image) {
      patch.image = image;
    }

    if (
      updates.preparationTime !== undefined
    ) {
      patch.preparation_time = Number(
        updates.preparationTime
      );
    }

    if (updates.available !== undefined) {
      patch.available = updates.available;
    }

    if (updates.featured !== undefined) {
      patch.featured = updates.featured;
    }

    if (updates.tags !== undefined) {
      patch.tags = updates.tags;
    }

    if (updates.availableDays !== undefined) {
      patch.available_days =
        Array.isArray(updates.availableDays) && updates.availableDays.length < 7
          ? updates.availableDays
          : null;
    }

    const { data, error } = await supabase
      .from("meals")
      .update(patch)
      .eq("id", mealId)
      .select(`
        *,
        vendors(name)
      `)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapMeal(data);
  },

  async deleteMeal(mealId) {
    if (!mealId) {
      throw new Error("Meal ID is required.");
    }

    const { error } = await supabase
      .from("meals")
      .delete()
      .eq("id", mealId);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },

  async updateMealAvailability(
    mealId,
    available
  ) {
    if (!mealId) {
      throw new Error("Meal ID is required.");
    }

    const { error } = await supabase
      .from("meals")
      .update({
        available: Boolean(available),
      })
      .eq("id", mealId);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },

  async updateMealFeatured(
    mealId,
    featured
  ) {
    if (!mealId) {
      throw new Error("Meal ID is required.");
    }

    const { error } = await supabase
      .from("meals")
      .update({
        featured: Boolean(featured),
      })
      .eq("id", mealId);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },

  // =========================================================
  // VENDOR PROFILE
  // =========================================================

  async updateVendorProfile(
    vendorId,
    updates = {}
  ) {
    if (!vendorId) {
      throw new Error("Vendor ID is required.");
    }

    const patch = {};

    if (updates.name !== undefined) {
      patch.name = updates.name;
    }

    if (updates.tagline !== undefined) {
      patch.tagline = updates.tagline;
    }

    if (updates.building !== undefined) {
      patch.building = updates.building;
    }

    if (
      updates.contactNumber !== undefined
    ) {
      patch.contact_number =
        updates.contactNumber;
    }

    if (updates.logoFile) {
      patch.logo = await uploadVendorImage(
        vendorId,
        updates.logoFile
      );
    } else if (updates.logo !== undefined) {
      patch.logo = updates.logo;
    }

    if (updates.coverImageFile) {
      patch.cover_image = await uploadVendorImage(
        vendorId,
        updates.coverImageFile
      );
    } else if (updates.coverImage !== undefined) {
      patch.cover_image =
        updates.coverImage;
    }

    const { data, error } = await supabase
      .from("vendors")
      .update(patch)
      .eq("id", vendorId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapVendor(data);
  },
};
