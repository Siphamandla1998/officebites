import { supabase } from "./api/supabaseClient";
import { mapMeal } from "./api/mappers";


// Fixed menu categories
// Move to Supabase later when admin management is required.
export const CATEGORIES = [
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


const getNearbyVendorRows = async (
  latitude,
  longitude,
  limit = 100
) => {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  const { data, error } = await supabase.rpc(
    "get_nearby_vendors",
    {
      p_latitude: lat,
      p_longitude: lng,
      p_limit: limit,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
};


const filterMealsForDate = (meals, forDate) => {
  if (!forDate) {
    return meals;
  }

  const weekday = new Date(forDate).getDay();

  return meals.filter((meal) => {
    if (!meal.availableDays) {
      return true;
    }

    return meal.availableDays.includes(weekday);
  });
};


export const foodService = {

  async getCategories() {
    return CATEGORIES;
  },


  async getMeals({
    vendorId,
    category,
    search,
    forDate,
    latitude,
    longitude,
  } = {}) {

    let nearbyRows = null;

    if (
      Number.isFinite(Number(latitude)) &&
      Number.isFinite(Number(longitude))
    ) {
      nearbyRows = await getNearbyVendorRows(
        latitude,
        longitude
      );

      // Location was intentionally supplied but no configured
      // vendor can serve this customer.
      if (nearbyRows.length === 0) {
        return [];
      }
    }


    let query = supabase
      .from("meals")
      .select(`
        *,
        vendors!inner(
          name,
          status
        )
      `)
      .eq("available", true)
      .eq("vendors.status", "approved");


    if (nearbyRows) {
      const nearbyVendorIds = nearbyRows.map(
        (row) => row.id
      );

      query = query.in(
        "vendor_id",
        nearbyVendorIds
      );
    }


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


    const { data, error } = await query;


    if (error) {
      throw new Error(error.message);
    }


    const meals = filterMealsForDate(
      (data || []).map(mapMeal),
      forDate
    );


    // Keep meals ordered according to vendor proximity.
    if (nearbyRows) {
      const distanceByVendor = new Map(
        nearbyRows.map((row) => [
          row.id,
          Number(row.distance_km),
        ])
      );

      return meals
        .map((meal) => ({
          ...meal,
          distanceKm:
            distanceByVendor.get(meal.vendorId) ?? null,
        }))
        .sort((a, b) => {
          return (
            (a.distanceKm ?? Infinity) -
            (b.distanceKm ?? Infinity)
          );
        });
    }


    return meals;
  },


  async getMealById(id) {

    const { data, error } = await supabase
      .from("meals")
      .select(`
        *,
        vendors(
          name,
          status
        )
      `)
      .eq("id", id)
      .maybeSingle();


    if (error) {
      throw new Error(error.message);
    }


    if (!data) {
      throw new Error("Meal not found");
    }


    return mapMeal(data);
  },


  async getPopularMeals(
    limit = 6,
    {
      forDate,
      latitude,
      longitude,
    } = {}
  ) {

    // When location exists, use the same location-aware
    // catalogue instead of recommending food the customer
    // cannot actually order.
    if (
      Number.isFinite(Number(latitude)) &&
      Number.isFinite(Number(longitude))
    ) {
      const nearbyMeals = await this.getMeals({
        forDate,
        latitude,
        longitude,
      });

      return nearbyMeals.slice(0, limit);
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
      .eq("vendors.status", "approved")
      .eq("available", true)
      .limit(forDate ? limit * 3 : limit);


    if (error) {
      throw new Error(error.message);
    }


    return filterMealsForDate(
      (data || []).map(mapMeal),
      forDate
    ).slice(0, limit);
  },

};