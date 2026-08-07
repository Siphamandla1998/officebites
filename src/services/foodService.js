import { supabase } from "./api/supabaseClient";
import { mapMeal } from "./api/mappers";


// Categories are a small, slow-changing taxonomy (6 fixed rows) — kept as a
// local constant rather than a table. Move to a `categories` table only if
// you need admins to add/reorder them without a deploy.

export const foodService = {
  async getCategories() {
    return categories;
  },

  async getMeals({ vendorId, category, search } = {}) {
    let query = supabase.from("meals").select("*, vendors(name)");
    if (vendorId) query = query.eq("vendor_id", vendorId);
    if (category) query = query.eq("category", category);
    if (search) {
      const q = `%${search}%`;
      // Matches name, description, or category — vendor name is matched
      // client-side below since PostgREST can't `or` across a joined table.
      query = query.or(`name.ilike.${q},description.ilike.${q},category.ilike.${q}`);
    }
    const { data, error } = await query;
    if (error) throw { message: error.message };
    let meals = (data || []).map(mapMeal);
    if (search) {
      const q = search.toLowerCase();
      const alreadyMatched = new Set(meals.map((m) => m.id));
      const { data: allForVendorSearch } = await supabase.from("meals").select("*, vendors(name)");
      (allForVendorSearch || [])
        .map(mapMeal)
        .filter((m) => m.vendorName.toLowerCase().includes(q) && !alreadyMatched.has(m.id))
        .forEach((m) => meals.push(m));
    }
    return meals;
  },

  async getMealById(id) {
    const { data, error } = await supabase.from("meals").select("*, vendors(name)").eq("id", id).maybeSingle();
    if (error) throw { message: error.message };
    return mapMeal(data);
  },

  async getPopularMeals(limit = 6) {
    const { data, error } = await supabase
      .from("meals")
      .select("*, vendors(name)")
      .order("rating", { ascending: false })
      .limit(limit);
    if (error) throw { message: error.message };
    return (data || []).map(mapMeal);
  },
};
