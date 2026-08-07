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


  return await uploadToBucket(
    BUCKETS.MEAL_IMAGES,
    `${vendorId}/${Date.now()}-${safeName}`,
    file
  );

};



export const vendorService = {



  // ==================================
  // CUSTOMER VENDOR LIST
  // ==================================


  async getVendors({
    category,
    building,
    search,
    status,
  } = {}) {


    let query = supabase
      .from("vendors")
      .select("*");



    // Admin can request any status
    // Customers only see approved vendors
    if(status){

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



    if(category){

      query = query.eq(
        "category",
        category
      );

    }



    if(building){

      query = query.eq(
        "building",
        building
      );

    }



    if(search){

      query = query.or(
        `name.ilike.%${search}%,category.ilike.%${search}%`
      );

    }



    const {
      data,
      error
    } = await query;



    if(error){

      throw new Error(error.message);

    }



    return (data || []).map(mapVendor);

  },





  async getFeaturedVendors(){


    const {
      data,
      error
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



    if(error){

      throw new Error(error.message);

    }



    return (data || []).map(mapVendor);

  },





  async getVendorById(id){


    const {
      data,
      error
    } = await supabase
      .from("vendors")
      .select("*")
      .eq(
        "id",
        id
      )
      .maybeSingle();



    if(error){

      throw new Error(error.message);

    }



    return mapVendor(data);

  },





  async getVendorMenu(id){


    if(!id) return [];



    const {
      data,
      error
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



    if(error){

      throw new Error(error.message);

    }



    return (data || []).map(mapMeal);

  },





  async getVendorReviews(id){


    const {
      data,
      error
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
          ascending:false
        }
      );



    if(error){

      throw new Error(error.message);

    }



    return (data || []).map(mapReview);

  },





  // ==================================
  // ADMIN VENDOR ACTIONS
  // ==================================


  async approveVendor(id){


    const {
      error
    } = await supabase
      .from("vendors")
      .update({
        status: VENDOR_STATUS.APPROVED
      })
      .eq(
        "id",
        id
      );



    if(error){

      throw new Error(error.message);

    }



    return {
      success:true
    };

  },





  async rejectVendor(id){


    const {
      error
    } = await supabase
      .from("vendors")
      .update({
        status: VENDOR_STATUS.REJECTED
      })
      .eq(
        "id",
        id
      );



    if(error){

      throw new Error(error.message);

    }



    return {
      success:true
    };

  },





  async suspendVendor(id){


    const {
      error
    } = await supabase
      .from("vendors")
      .update({
        status: VENDOR_STATUS.SUSPENDED
      })
      .eq(
        "id",
        id
      );



    if(error){

      throw new Error(error.message);

    }

  // ==================================
  // MEAL CRUD
  // ==================================


  async addMeal(vendorId, meal){


    let image = DEFAULT_MEAL_IMAGE;



    if(meal.imageFile){

      image = await uploadMealImage(
        vendorId,
        meal.imageFile
      );

    }



    const {
      data,
      error
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
          meal.tags || []

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





  async updateMeal(mealId, updates){


    let image =
      updates.image;



    if(updates.imageFile){


      image = await uploadMealImage(
        updates.vendorId || "unknown",
        updates.imageFile
      );


    }



    const patch = {};



    if(updates.name !== undefined)
      patch.name = updates.name;



    if(updates.description !== undefined)
      patch.description = updates.description;



    if(updates.price !== undefined)
      patch.price = Number(updates.price);



    if(updates.category !== undefined)
      patch.category = updates.category;



    if(image)
      patch.image = image;



    if(updates.preparationTime !== undefined)
      patch.preparation_time =
        Number(updates.preparationTime);



    if(updates.available !== undefined)
      patch.available =
        updates.available;



    if(updates.featured !== undefined)
      patch.featured =
        updates.featured;



    if(updates.tags !== undefined)
      patch.tags =
        updates.tags;



    const {
      data,
      error
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





  async deleteMeal(mealId){


    const {
      error
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
      success:true
    };

  },





  async updateMealAvailability(
    mealId,
    available
  ){


    const {
      error
    } = await supabase
      .from("meals")
      .update({
        available
      })
      .eq(
        "id",
        mealId
      );



    if(error){

      throw new Error(error.message);

    }



    return {
      success:true
    };

  },





  async updateMealFeatured(
    mealId,
    featured
  ){


    const {
      error
    } = await supabase
      .from("meals")
      .update({
        featured
      })
      .eq(
        "id",
        mealId
      );



    if(error){

      throw new Error(error.message);

    }



    return {
      success:true
    };

  },

    return {
      success:true
    };

  },
    // ==================================
  // VENDOR PROFILE
  // ==================================


  async updateVendorProfile(vendorId, updates){


    const patch = {};



    if(updates.name !== undefined){

      patch.name = updates.name;

    }



    if(updates.tagline !== undefined){

      patch.tagline = updates.tagline;

    }



    if(updates.building !== undefined){

      patch.building = updates.building;

    }



    if(updates.contactNumber !== undefined){

      patch.contact_number =
        updates.contactNumber;

    }



    if(updates.logo !== undefined){

      patch.logo =
        updates.logo;

    }



    if(updates.coverImage !== undefined){

      patch.cover_image =
        updates.coverImage;

    }



    const {
      data,
      error
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
