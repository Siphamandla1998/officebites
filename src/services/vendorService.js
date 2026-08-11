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
  // =========================================================
  // VENDOR DASHBOARD ANALYTICS
  // =========================================================

  async getDashboardStats(vendorId) {
    if (!vendorId) {
      return null;
    }

    const orders = await orderService.getOrdersForVendor(vendorId);
    const now = new Date();
    const todayKey = now.toDateString();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now);
    monthStart.setDate(now.getDate() - 29);
    monthStart.setHours(0, 0, 0, 0);

    const activeOrders = orders.filter((order) => order.subOrder?.status !== ORDER_STATUS.CANCELLED);
    const revenueFor = (list) => list
      .filter((order) => [
        ORDER_STATUS.CONFIRMED,
        ORDER_STATUS.ACCEPTED,
        ORDER_STATUS.PREPARING,
        ORDER_STATUS.READY,
        ORDER_STATUS.COLLECTED,
        ORDER_STATUS.COMPLETED,
      ].includes(order.subOrder?.status))
      .reduce((sum, order) => sum + Number(order.subOrder?.subtotal || 0), 0);

    const todaysOrders = activeOrders.filter((order) => new Date(order.createdAt).toDateString() === todayKey);
    const weeklyOrders = activeOrders.filter((order) => new Date(order.createdAt) >= weekStart);
    const monthlyOrders = activeOrders.filter((order) => new Date(order.createdAt) >= monthStart);
    const completed = activeOrders.filter((order) => order.subOrder?.status === ORDER_STATUS.COMPLETED);

    const revenueChart = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      const key = day.toDateString();
      return {
        day: day.toLocaleDateString(undefined, { weekday: "short" }),
        revenue: revenueFor(activeOrders.filter((order) => new Date(order.createdAt).toDateString() === key)),
      };
    });

    const mealCounts = new Map();
    for (const order of activeOrders) {
      for (const item of order.subOrder?.items || []) {
        const current = mealCounts.get(item.mealId) || { mealId: item.mealId, name: item.name, salesCount: 0, revenue: 0 };
        current.salesCount += Number(item.qty || 0);
        current.revenue += Number(item.price || 0) * Number(item.qty || 0);
        mealCounts.set(item.mealId, current);
      }
    }
    const rankedMeals = [...mealCounts.values()].sort((a, b) => b.salesCount - a.salesCount);
    const totalUnits = rankedMeals.reduce((sum, item) => sum + item.salesCount, 0);

    const categoryCounts = new Map();
    const mealIds = rankedMeals.map((item) => item.mealId).filter(Boolean);
    if (mealIds.length) {
      const { data: meals, error } = await supabase.from("meals").select("id, category").in("id", mealIds);
      if (error) throw new Error(error.message);
      const categories = new Map((meals || []).map((meal) => [meal.id, meal.category || "Meals"]));
      for (const item of rankedMeals) {
        const category = categories.get(item.mealId) || "Meals";
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + item.salesCount);
      }
    }
    const bestSellingCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const top = rankedMeals[0];

    return {
      todaysOrders: todaysOrders.length,
      pendingOrders: activeOrders.filter((o) => o.subOrder?.status === ORDER_STATUS.PAYMENT_SUBMITTED).length,
      confirmedOrders: activeOrders.filter((o) => o.subOrder?.status === ORDER_STATUS.CONFIRMED).length,
      preparingOrders: activeOrders.filter((o) => o.subOrder?.status === ORDER_STATUS.PREPARING).length,
      readyOrders: activeOrders.filter((o) => o.subOrder?.status === ORDER_STATUS.READY).length,
      deliveredOrders: completed.length,
      cancelledOrders: orders.filter((o) => o.subOrder?.status === ORDER_STATUS.CANCELLED).length,
      totalOrders: orders.length,
      todaysRevenue: revenueFor(todaysOrders),
      weeklyRevenue: revenueFor(weeklyOrders),
      monthlyRevenue: revenueFor(monthlyOrders),
      averageOrderValue: completed.length ? +(revenueFor(completed) / completed.length).toFixed(2) : 0,
      mostPopularMeal: top ? { name: top.name, salesCount: top.salesCount } : null,
      bestSellingCategory,
      revenueChart,
    };
  },

  async getPopularMealsForVendor(vendorId, period = "all") {
    if (!vendorId) return [];
    const orders = await orderService.getOrdersForVendor(vendorId);
    const now = new Date();
    const start = period === "today"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : period === "week"
        ? new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
        : period === "month"
          ? new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)
          : null;
    const rows = new Map();
    for (const order of orders) {
      if (order.subOrder?.status === ORDER_STATUS.CANCELLED) continue;
      if (start && new Date(order.createdAt) < start) continue;
      for (const item of order.subOrder?.items || []) {
        const row = rows.get(item.mealId) || { meal: { id: item.mealId, name: item.name, image: "/placeholder-food.png" }, salesCount: 0, revenue: 0 };
        row.salesCount += Number(item.qty || 0);
        row.revenue += Number(item.price || 0) * Number(item.qty || 0);
        rows.set(item.mealId, row);
      }
    }
    const result = [...rows.values()].sort((a, b) => b.salesCount - a.salesCount);
    const total = result.reduce((sum, row) => sum + row.salesCount, 0);
    const ids = result.map((row) => row.meal.id).filter(Boolean);
    if (ids.length) {
      const { data: meals, error } = await supabase.from("meals").select("id, name, image").in("id", ids);
      if (error) throw new Error(error.message);
      const byId = new Map((meals || []).map((meal) => [meal.id, meal]));
      result.forEach((row) => { row.meal = { ...row.meal, ...(byId.get(row.meal.id) || {}) }; });
    }
    return result.map((row) => ({ ...row, popularityPct: total ? +((row.salesCount / total) * 100).toFixed(1) : 0 }));
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

  async getVendorMenu(vendorId) {
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

    return (data || []).map(mapMeal);
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
