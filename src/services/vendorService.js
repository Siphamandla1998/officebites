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

import { VENDOR_STATUS } from "../utils/constants";

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
