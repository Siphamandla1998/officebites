import { supabase, uploadToBucket, BUCKETS } from "./api/supabaseClient";
import { mapVendor, mapMeal, mapReview } from "./api/mappers";
import { VENDOR_STATUS } from "../utils/constants";

const DEFAULT_MEAL_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80";


const uploadMealImage = async (vendorId, file) => {
  if (!file) return null;

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be smaller than 5MB");
  }

  const safeName = file.name
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.-]/g, "");

  return uploadToBucket(
    BUCKETS.MEAL_IMAGES,
    `${vendorId}/${Date.now()}-${safeName}`,
    file
  );
};


export const vendorService = {


  // ===============================
  // CUSTOMER VENDOR FETCHING
  // ===============================


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
      query = query.eq(
        "status",
        status
      );
    } else {
      query = query.eq(
        "status",
        VENDOR_STATUS.APPROVED
      );
    }


    if (category) {
      query = query.eq(
        "category",
        category
      );
    }


    if (building) {
      query = query.eq(
        "building",
        building
      );
    }


    if (search) {
      query = query.or(
        `name.ilike.%${search}%,category.ilike.%${search}%`
      );
    }


    const {
      data,
      error,
    } = await query;


    if (error) {
      throw new Error(error.message);
    }


    return (data || []).map(mapVendor);
  },



  async getFeaturedVendors() {

    const {
      data,
      error,
    } = await supabase
      .from("vendors")
      .select("*")
      .eq(
        "featured",
        true
      )
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

    if (!id) return null;


    const {
      data,
      error,
    } = await supabase
      .from("vendors")
      .select("*")
      .eq(
        "id",
        id
      )
      .maybeSingle();


    if (error) {
      throw new Error(error.message);
    }


    return mapVendor(data);
  },



  async getVendorMenu(id) {

    if (!id) return [];


    const {
      data,
      error,
    } = await supabase
      .from("meals")
      .select(`
        *,
        vendors!inner(
          name,
          status
        )
      `)
      .eq(
        "vendor_id",
        id
      )
      .eq(
        "vendors.status",
        VENDOR_STATUS.APPROVED
      );


    if (error) {
      throw new Error(error.message);
    }


    return (data || []).map(mapMeal);
  },



  async getVendorReviews(id) {

    const {
      data,
      error,
    } = await supabase
      .from("reviews")
      .select("*")
      .eq(
        "vendor_id",
        id
      )
      .order(
        "created_at",
        {
          ascending:false,
        }
      );


    if (error) {
      throw new Error(error.message);
    }


    return (data || []).map(mapReview);
  },



  // ===============================
  // ADMIN VENDOR MANAGEMENT
  // ===============================


  async approveVendor(id) {

    const {
      error,
    } = await supabase
      .from("vendors")
      .update({
        status:
          VENDOR_STATUS.APPROVED,
      })
      .eq(
        "id",
        id
      );


    if(error){
      throw new Error(error.message);
    }


    return {
      success:true,
    };
  },



  async rejectVendor(id) {

    const {
      error,
    } = await supabase
      .from("vendors")
      .update({
        status:
          VENDOR_STATUS.REJECTED,
      })
      .eq(
        "id",
        id
      );


    if(error){
      throw new Error(error.message);
    }


    return {
      success:true,
    };
  },



  async suspendVendor(id) {

    const {
      error,
    } = await supabase
      .from("vendors")
      .update({
        status:
          VENDOR_STATUS.SUSPENDED,
      })
      .eq(
        "id",
        id
      );


    if(error){
      throw new Error(error.message);
    }


    return {
      success:true,
    };
  },

    // ===============================
  // MEAL CRUD
  // ===============================


  async addMeal(vendorId, meal) {

    let image = DEFAULT_MEAL_IMAGE;


    if (meal.imageFile) {
      image = await uploadMealImage(
        vendorId,
        meal.imageFile
      );
    }


    const {
      data,
      error,
    } = await supabase
      .from("meals")
      .insert({

        vendor_id: vendorId,

        name: meal.name,

        description:
          meal.description || "",

        price:
          Number(meal.price),

        category:
          meal.category,

        image,

        preparation_time:
          Number(meal.preparationTime || 0),

        available:
          meal.available ?? true,

        featured:
          meal.featured ?? false,

        tags:
          meal.tags || [],

      })
      .select(`
        *,
        vendors(name)
      `)
      .single();


    if(error){
      throw new Error(error.message);
    }


    return mapMeal(data);
  },



  async updateMeal(mealId, updates) {

    let image = updates.image;


    if(updates.imageFile){

      image = await uploadMealImage(
        updates.vendorId || "meal",
        updates.imageFile
      );

    }


    const patch = {


      ...(updates.name !== undefined && {
        name:
          updates.name
      }),


      ...(updates.description !== undefined && {
        description:
          updates.description
      }),


      ...(updates.price !== undefined && {
        price:
          Number(updates.price)
      }),


      ...(updates.category !== undefined && {
        category:
          updates.category
      }),


      ...(image && {
        image
      }),


      ...(updates.preparationTime !== undefined && {
        preparation_time:
          Number(updates.preparationTime)
      }),


      ...(updates.available !== undefined && {
        available:
          updates.available
      }),


      ...(updates.featured !== undefined && {
        featured:
          updates.featured
      }),


      ...(updates.tags !== undefined && {
        tags:
          updates.tags
      }),

    };


    const {
      data,
      error,
    } = await supabase
      .from("meals")
      .update(patch)
      .eq(
        "id",
        mealId
      )
      .select(`
        *,
        vendors(name)
      `)
      .single();


    if(error){
      throw new Error(error.message);
    }


    return mapMeal(data);

  },



  async deleteMeal(mealId) {

    const {
      error,
    } = await supabase
      .from("meals")
      .delete()
      .eq(
        "id",
        mealId
      );


    if(error){
      throw new Error(error.message);
    }


    return {
      success:true,
    };

  },



  async updateMealAvailability(
    mealId,
    available
  ){

    const {
      error,
    } = await supabase
      .from("meals")
      .update({
        available,
      })
      .eq(
        "id",
        mealId
      );


    if(error){
      throw new Error(error.message);
    }


    return {
      success:true,
    };

  },



  async updateMealFeatured(
    mealId,
    featured
  ){

    const {
      error,
    } = await supabase
      .from("meals")
      .update({
        featured,
      })
      .eq(
        "id",
        mealId
      );


    if(error){
      throw new Error(error.message);
    }


    return {
      success:true,
    };

  },



  // ===============================
  // VENDOR PROFILE
  // ===============================


  async updateVendorProfile(
    vendorId,
    updates
  ){

    const patch = {


      ...(updates.name !== undefined && {
        name:
          updates.name
      }),


      ...(updates.tagline !== undefined && {
        tagline:
          updates.tagline
      }),


      ...(updates.building !== undefined && {
        building:
          updates.building
      }),


      ...(updates.contactNumber !== undefined && {
        contact_number:
          updates.contactNumber
      }),


      ...(updates.logo !== undefined && {
        logo:
          updates.logo
      }),


      ...(updates.coverImage !== undefined && {
        cover_image:
          updates.coverImage
      }),


    };


    const {
      data,
      error,
    } = await supabase
      .from("vendors")
      .update(patch)
      .eq(
        "id",
        vendorId
      )
      .select()
      .single();


    if(error){
      throw new Error(error.message);
    }


    return mapVendor(data);

  },


};
