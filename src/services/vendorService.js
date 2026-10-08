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
import { financialService } from './financialService';
import { inPeriod, sastDateKey, calendarDate } from '../utils/reportingDates';
import { orderService } from "./orderService";
import { catalogueSearchFilter, deliveryWeekday } from "../utils/catalogueFilters";

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
  async getPopularMealsForVendor(vendorId, period = 'all') {
    const report = await financialService.report({ vendorId, period });
    const total = report.meals.reduce((sum, row) => sum + Number(row.units), 0);
    return report.meals.map(row => ({ meal: { id: row.meal_key, name: row.name, image: '/placeholder-food.svg' }, salesCount: Number(row.units), revenue: Number(row.revenue), popularityPct: total ? Math.round(Number(row.units) / total * 100) : 0 }));
  },
  async getVendorAnalytics(vendorId, period = 'month') {
    const report = await financialService.report({ vendorId, period });
    return { ...report.totals, orders: report.totals.suborders, grossRevenue: report.totals.gmv, platformCommission: report.totals.grossCommission, vendorNet: report.totals.vendorEarnings, periodFrom: report.from, periodTo: report.to };
  },
  async getDashboardStats(vendorId) {
    const [report, allOrders] = await Promise.all([financialService.report({ vendorId, period: 'all' }), orderService.getOrdersForVendor(vendorId)]);
    const orders = allOrders.filter(order => !order.isTest);
    const sum = period => report.rows.filter(row => inPeriod(row.financial_date + 'T12:00:00+02:00', period)).reduce((n, row) => n + Number(row.gross), 0);
    const month = report.rows.filter(row => inPeriod(row.financial_date + 'T12:00:00+02:00', 'month'));
    const unresolvedCommission = month.filter(row => row.commission == null).length;
    const monthlyCommission = unresolvedCommission ? null : month.reduce((n, row) => n + Number(row.commission), 0);
    const revenueChart = [];
    for(let i = 6; i >= 0; i--) {
      const day = new Date(sastDateKey() + 'T12:00:00Z'); day.setUTCDate(day.getUTCDate() - i);
      const key = day.toISOString().slice(0, 10);
      revenueChart.push({ date: key, day: calendarDate(key).toLocaleDateString('en-ZA', {weekday: 'short'}), revenue: report.rows.filter(row => row.financial_date === key).reduce((n,row) => n + Number(row.gross),0) });
    }
    const count = statuses => orders.filter(order => statuses.includes(order.subOrder?.status)).length;
    return { todaysOrders: orders.filter(order => sastDateKey(order.createdAt) === sastDateKey()).length,
      pendingOrders: count([ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PAYMENT_SUBMITTED]), confirmedOrders: count([ORDER_STATUS.CONFIRMED]),
      preparingOrders: count([ORDER_STATUS.ACCEPTED, ORDER_STATUS.PREPARING]), readyOrders: count([ORDER_STATUS.READY]),
      deliveredOrders: count([ORDER_STATUS.COLLECTED, ORDER_STATUS.COMPLETED]), cancelledOrders: count([ORDER_STATUS.CANCELLED]), totalOrders: orders.length,
      todaysRevenue: sum('today'), weeklyRevenue: sum('week'), monthlyRevenue: sum('month'), monthlyCommission,
      monthlyVendorEarnings: monthlyCommission == null ? null : sum('month') - monthlyCommission, unresolvedCommission,
      averageOrderValue: month.length ? sum('month') / month.length : 0,
      mostPopularMeal: report.meals[0] ? { name: report.meals[0].name } : null, bestSellingCategory: report.categories[0]?.category || null, revenueChart };
  },

  // =========================================================
  // CUSTOMER VENDOR FETCHING
  // =========================================================
  async getNearbyVendors(
    latitude,
    longitude,
    limit = 20
  ) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    const maxResults = Number(limit);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return [];
    }

    const { data, error } = await supabase.rpc(
      "get_nearby_vendors",
      {
        p_latitude: lat,
        p_longitude: lng,
        p_limit:
          Number.isFinite(maxResults) && maxResults > 0
            ? Math.floor(maxResults)
            : 20,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((row) => ({
      ...mapVendor(row),

      distanceKm:
        row.distance_km === null ||
        row.distance_km === undefined
          ? null
          : Number(row.distance_km),
    }));
  },
  async getVendors({
    category,
    building,
    search,
    status,
  } = {}) {
    let query = supabase
      .from("vendors")
      .select("*");

    if (status && status !== "all") {
      query = query.eq("status", status);
    } else if (status !== "all") {
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
      query = query.or(catalogueSearchFilter(["name", "category"], search));
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
        const weekday = deliveryWeekday(forDate);
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

    if (updates.email !== undefined) {
      patch.email = updates.email?.trim() || null;
    }

    if (updates.address !== undefined) {
      patch.address = updates.address?.trim() || null;
    }

    if (updates.operatingHours !== undefined) {
      patch.operating_hours = updates.operatingHours?.trim() || null;
    }

    if (updates.deliveryRadius !== undefined) {
      const radius = Number(updates.deliveryRadius);

      if (!Number.isFinite(radius) || radius <= 0) {
        throw new Error("Delivery radius must be greater than 0 km.");
      }

      patch.delivery_radius = radius;
    }

    if (updates.latitude !== undefined) {
      const latitude = Number(updates.latitude);

      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        throw new Error("Invalid business latitude.");
      }

      patch.latitude = latitude;
    }

    if (updates.longitude !== undefined) {
      const longitude = Number(updates.longitude);

      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        throw new Error("Invalid business longitude.");
      }

      patch.longitude = longitude;
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
