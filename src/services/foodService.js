import { supabase } from "./api/supabaseClient";
import { mapMeal } from "./api/mappers";


// Fixed menu categories
// Move to Supabase later when admin management is required.
const categories = [
  {
    id: "meals",
    name: "Meals",
    emoji: "🍱",
    color: "#F5E6D3",
  },
  {
    id: "drinks",
    name: "Drinks",
    emoji: "🥤",
    color: "#E8DCC8",
  },
  {
    id: "snacks",
    name: "Snacks",
    emoji: "🍪",
    color: "#EFE3D5",
  },
  {
    id: "desserts",
    name: "Desserts",
    emoji: "🍰",
    color: "#F3D8D8",
  },
];


export const foodService = {


  async getCategories() {
    return categories;
  },



  async getMeals({
    vendorId,
    category,
    search,
  } = {}) {


    let query = supabase
      .from("meals")
      .select(`
        *,
        vendors(
          name,
          status
        )
      `)
      .eq(
        "available",
        true
      )
      .eq(
        "vendors.status",
        "approved"
      );



    if (vendorId) {
      query = query.eq(
        "vendor_id",
        vendorId
      );
    }



    if (category) {
      query = query.eq(
        "category",
        category
      );
    }



    if (search) {

      const q = `%${search}%`;

      query = query.or(
        `name.ilike.${q},description.ilike.${q},category.ilike.${q}`
      );

    }



    const {
      data,
      error,
    } = await query;



    if (error) {
      throw new Error(error.message);
    }



    return (
      data || []
    ).map(mapMeal);

  },



  async getMealById(id) {


    const {
      data,
      error,
    } = await supabase
      .from("meals")
      .select(`
        *,
        vendors(
          name,
          status
        )
      `)
      .eq(
        "id",
        id
      )
      .maybeSingle();



    if (error) {
      throw new Error(error.message);
    }



    if (!data) {
      throw new Error(
        "Meal not found"
      );
    }



    return mapMeal(data);

  },



  async getPopularMeals(limit = 6) {


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
        "vendors.status",
        "approved"
      )
      .eq(
        "available",
        true
      )
      .limit(limit);



    if (error) {
      throw new Error(error.message);
    }



    return (
      data || []
    ).map(mapMeal);

  },


};
