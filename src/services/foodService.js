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
      .select("*, vendors(name)");



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
      throw {
        message: error.message,
      };
    }



    let meals = (data || []).map(mapMeal);



    // Include vendor name search
    if (search) {

      const searchText =
        search.toLowerCase();



      const existingIds =
        new Set(
          meals.map(
            (meal) => meal.id
          )
        );



      const {
        data: vendorMeals,
      } = await supabase
        .from("meals")
        .select("*, vendors(name)");



      (vendorMeals || [])
        .map(mapMeal)
        .filter(
          (meal) =>
            meal.vendorName
              ?.toLowerCase()
              .includes(searchText)
            &&
            !existingIds.has(meal.id)
        )
        .forEach(
          (meal) => meals.push(meal)
        );

    }



    return meals;

  },



  async getMealById(id) {


    const {
      data,
      error,
    } = await supabase
      .from("meals")
      .select("*, vendors(name)")
      .eq("id", id)
      .maybeSingle();



    if (error) {
      throw {
        message:error.message,
      };
    }



    if (!data) {
      throw {
        message:"Meal not found",
      };
    }



    return mapMeal(data);

  },



  async getPopularMeals(limit = 6) {


    const {
      data,
      error,
    } = await supabase
      .from("meals")
      .select("*, vendors(name)")
      .eq(
        "available",
        true
      )
      .order(
        "rating",
        {
          ascending:false,
        }
      )
      .limit(limit);



    if(error){
      throw {
        message:error.message,
      };
    }



    return (
      data || []
    ).map(mapMeal);

  },


};
