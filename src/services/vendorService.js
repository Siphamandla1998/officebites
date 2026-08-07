import { supabase, uploadToBucket, BUCKETS } from "./api/supabaseClient";
import { mapVendor, mapMeal, mapReview } from "./api/mappers";
import { orderService } from "./orderService";
import {
  VENDOR_STATUS,
  ORDER_STATUS,
} from "../utils/constants";


const startOfDay = (d) =>
  new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );


const daysAgo = (n) => {

  const d = startOfDay(new Date());

  d.setDate(
    d.getDate() - n
  );

  return d;

};



export const vendorService = {


  async getVendors({
    category,
    building,
    search,
    status,
  } = {}) {


    let query = supabase
      .from("vendors")
      .select("*");



    query = status
      ? query.eq("status", status)
      : query.eq(
          "status",
          VENDOR_STATUS.APPROVED
        );



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
      throw {
        message:error.message,
      };
    }



    return (
      data || []
    ).map(mapVendor);


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

      throw {
        message:error.message,
      };

    }



    return (
      data || []
    ).map(mapVendor);

  },




  async getVendorById(id) {


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

      throw {
        message:error.message,
      };

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
      .select("*, vendors(name)")
      .eq(
        "vendor_id",
        id
      );



    if (error) {

      throw {
        message:error.message,
      };

    }



    return (
      data || []
    ).map(mapMeal);

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

      throw {
        message:error.message,
      };

    }



    return (
      data || []
    ).map(mapReview);

  },





  // ===========================
  // ADMIN ACTIONS
  // ===========================


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


    if(error)
      throw {
        message:error.message,
      };


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


    if(error)
      throw {
        message:error.message,
      };


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


    if(error)
      throw {
        message:error.message,
      };


    return {
      success:true,
    };

  },



  // ===========================
  // MENU CRUD
  // ===========================


  async addMeal(vendorId, meal) {


    let image = null;



    if (meal.imageFile) {

      image =
        await uploadToBucket(
          BUCKETS.MEAL_IMAGES,
          `${vendorId}/${Date.now()}-${meal.imageFile.name}`,
          meal.imageFile
        );

    }



    const {
      data,
      error,
    } = await supabase
      .from("meals")
      .insert({

        vendor_id:
          vendorId,

        name:
          meal.name,

        description:
          meal.description,

        price:
          meal.price,

        category:
          meal.category,

        image,

        preparation_time:
          meal.preparationTime,

        available:
          meal.available ?? true,

        featured:
          meal.featured ?? false,

        tags:
          meal.tags || [],

      })
      .select("*, vendors(name)")
      .single();



    if(error)
      throw {
        message:error.message,
      };



    return mapMeal(data);

  },
