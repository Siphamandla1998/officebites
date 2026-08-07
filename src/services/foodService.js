import { supabase } from "./api/supabaseClient";
import { mapMeal } from "./api/mappers";


// Fixed menu categories
// Keep local until admin management is required.
const categories = [
  { name: "Meals" },
  { name: "Drinks" },
  { name: "Snacks" },
  { name: "Desserts" },
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




    // Search vendor names client-side
    // because PostgREST cannot filter joined tables
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
          (meal) =>
            meals.push(meal)
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
        message: error.message,
      };

    }



    if (!data) {

      throw {
        message: "Meal not found",
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
      .order(
        "rating",
        {
          ascending: false,
        }
      )
      .limit(limit);



    if (error) {

      throw {
        message: error.message,
      };

    }



    return (
      data || []
    ).map(mapMeal);


  },


};
