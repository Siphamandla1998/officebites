import { supabase, uploadToBucket, BUCKETS } from "./api/supabaseClient";
import { mapVendor, mapMeal, mapReview } from "./api/mappers";
import { orderService } from "./orderService";
import { VENDOR_STATUS, ORDER_STATUS } from "../utils/constants";

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysAgo = (n) => {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - n);
  return d;
};

export const vendorService = {
  async getVendors({ category, building, search, status } = {}) {
    let query = supabase.from("vendors").select("*");
    query = status ? query.eq("status", status) : query.eq("status", VENDOR_STATUS.APPROVED);
    if (category) query = query.eq("category", category);
    if (building) query = query.eq("building", building);
    if (search) query = query.or(`name.ilike.%${search}%,category.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw { message: error.message };
    return (data || []).map(mapVendor);
  },

  async getFeaturedVendors() {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("featured", true)
      .eq("status", VENDOR_STATUS.APPROVED);
    if (error) throw { message: error.message };
    return (data || []).map(mapVendor);
  },

  async getVendorById(id) {
    const { data, error } = await supabase.from("vendors").select("*").eq("id", id).maybeSingle();
    if (error) throw { message: error.message };
    return mapVendor(data);
  },

  async getVendorMenu(id) {
    const { data, error } = await supabase.from("meals").select("*, vendors(name)").eq("vendor_id", id);
    if (error) throw { message: error.message };
    return (data || []).map(mapMeal);
  },

  async getVendorReviews(id) {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("vendor_id", id)
      .order("created_at", { ascending: false });
    if (error) throw { message: error.message };
    return (data || []).map(mapReview);
  },

  // --- Admin actions ---
  async approveVendor(id) {
    const { error } = await supabase.from("vendors").update({ status: VENDOR_STATUS.APPROVED }).eq("id", id);
    if (error) throw { message: error.message };
    return { success: true };
  },

  async rejectVendor(id) {
    const { error } = await supabase.from("vendors").update({ status: VENDOR_STATUS.REJECTED }).eq("id", id);
    if (error) throw { message: error.message };
    return { success: true };
  },

  async suspendVendor(id) {
    const { error } = await supabase.from("vendors").update({ status: VENDOR_STATUS.SUSPENDED }).eq("id", id);
    if (error) throw { message: error.message };
    return { success: true };
  },

  // --- Vendor menu management (full CRUD) ---
  // `meal.imageFile`, if present, is uploaded to the public meal-images
  // bucket first and its URL used instead of whatever's in `meal.image`.
  async addMeal(vendorId, meal) {
    const image = meal.imageFile
      ? await uploadToBucket(BUCKETS.MEAL_IMAGES, `${vendorId}/${Date.now()}-${meal.imageFile.name}`, meal.imageFile)
      : meal.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80";

    const { data, error } = await supabase
      .from("meals")
      .insert({
        vendor_id: vendorId,
        name: meal.name,
        description: meal.description,
        price: meal.price,
        category: meal.category,
        image,
        preparation_time: meal.preparationTime,
        available: meal.available ?? true,
        featured: meal.featured ?? false,
        tags: meal.tags || [],
      })
      .select("*, vendors(name)")
      .single();
    if (error) throw { message: error.message };
    return mapMeal(data);
  },

  async updateMeal(mealId, updates) {
    const image = updates.imageFile
      ? await uploadToBucket(BUCKETS.MEAL_IMAGES, `${updates.vendorId || "meal"}/${Date.now()}-${updates.imageFile.name}`, updates.imageFile)
      : updates.image;

    const patch = {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.price !== undefined && { price: updates.price }),
      ...(updates.category !== undefined && { category: updates.category }),
      ...(image !== undefined && { image }),
      ...(updates.preparationTime !== undefined && { preparation_time: updates.preparationTime }),
      ...(updates.available !== undefined && { available: updates.available }),
      ...(updates.featured !== undefined && { featured: updates.featured }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
    };
    const { data, error } = await supabase
      .from("meals")
      .update(patch)
      .eq("id", mealId)
      .select("*, vendors(name)")
      .single();
    if (error) throw { message: error.message };
    return mapMeal(data);
  },

  async deleteMeal(mealId) {
    const { error } = await supabase.from("meals").delete().eq("id", mealId);
    if (error) throw { message: error.message };
    return { success: true };
  },

  async updateMealAvailability(mealId, available) {
    const { error } = await supabase.from("meals").update({ available }).eq("id", mealId);
    if (error) throw { message: error.message };
    return { success: true };
  },

  async updateMealFeatured(mealId, featured) {
    const { error } = await supabase.from("meals").update({ featured }).eq("id", mealId);
    if (error) throw { message: error.message };
    return { success: true };
  },

  // --- Vendor profile / settings ---
  async updateVendorProfile(vendorId, updates) {
    const patch = {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.tagline !== undefined && { tagline: updates.tagline }),
      ...(updates.building !== undefined && { building: updates.building }),
      ...(updates.contactNumber !== undefined && { contact_number: updates.contactNumber }),
      ...(updates.email !== undefined && { email: updates.email }),
      ...(updates.address !== undefined && { address: updates.address }),
      ...(updates.deliveryRadius !== undefined && { delivery_radius: updates.deliveryRadius }),
      ...(updates.operatingHours !== undefined && { operating_hours: updates.operatingHours }),
      ...(updates.logo !== undefined && { logo: updates.logo }),
      ...(updates.coverImage !== undefined && { cover_image: updates.coverImage }),
    };
    const { data, error } = await supabase.from("vendors").update(patch).eq("id", vendorId).select().single();
    if (error) throw { message: error.message };
    return mapVendor(data);
  },

  // --- Dashboard analytics (computed live from the current order dataset) ---
  // Pure JS aggregation over orderService/menu results — unchanged in shape
  // from before, just fed by live Supabase data now instead of mock arrays.
  async getDashboardStats(vendorId) {
    const orders = await orderService.getOrdersForVendor(vendorId);
    const menu = await this.getVendorMenu(vendorId);
    const today = startOfDay(new Date()).getTime();
    const weekAgo = daysAgo(7).getTime();
    const monthAgo = daysAgo(30).getTime();

    const revenueSince = (cutoff) =>
      orders
        .filter((o) => new Date(o.createdAt).getTime() >= cutoff)
        .filter((o) => o.subOrder.status !== ORDER_STATUS.CANCELLED)
        .reduce((sum, o) => sum + o.subOrder.subtotal, 0);

    const countByStatus = (status) => orders.filter((o) => o.subOrder.status === status).length;
    const todaysOrders = orders.filter(
      (o) => startOfDay(new Date(o.createdAt)).getTime() === today
    );

    const completedOrders = orders.filter((o) => o.subOrder.status === ORDER_STATUS.COMPLETED);
    const validOrders = orders.filter((o) => o.subOrder.status !== ORDER_STATUS.CANCELLED);
    const totalRevenue = validOrders.reduce((sum, o) => sum + o.subOrder.subtotal, 0);
    const averageOrderValue = validOrders.length ? totalRevenue / validOrders.length : 0;

    const itemTally = {};
    validOrders.forEach((o) => {
      o.subOrder.items.forEach((item) => {
        itemTally[item.mealId] = (itemTally[item.mealId] || 0) + item.qty;
      });
    });
    const topMealId = Object.entries(itemTally).sort((a, b) => b[1] - a[1])[0]?.[0];
    const mostPopularMeal = menu.find((m) => m.id === topMealId) || null;

    const categoryTally = {};
    validOrders.forEach((o) => {
      o.subOrder.items.forEach((item) => {
        const meal = menu.find((m) => m.id === item.mealId);
        if (!meal) return;
        categoryTally[meal.category] = (categoryTally[meal.category] || 0) + item.qty;
      });
    });
    const bestSellingCategory = Object.entries(categoryTally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      todaysOrders: todaysOrders.length,
      pendingOrders: countByStatus(ORDER_STATUS.PAYMENT_SUBMITTED) + countByStatus(ORDER_STATUS.CONFIRMED),
      confirmedOrders: countByStatus(ORDER_STATUS.CONFIRMED),
      preparingOrders: countByStatus(ORDER_STATUS.PREPARING),
      readyOrders: countByStatus(ORDER_STATUS.READY),
      deliveredOrders: countByStatus(ORDER_STATUS.COMPLETED),
      cancelledOrders: countByStatus(ORDER_STATUS.CANCELLED),
      todaysRevenue: revenueSince(today),
      weeklyRevenue: revenueSince(weekAgo),
      monthlyRevenue: revenueSince(monthAgo),
      totalOrders: orders.length,
      averageOrderValue,
      mostPopularMeal,
      bestSellingCategory,
      completedCount: completedOrders.length,
    };
  },

  /** Ranks this vendor's meals by units sold within a period (today/week/month/all). */
  async getPopularMealsForVendor(vendorId, period = "all") {
    const orders = await orderService.getOrdersForVendor(vendorId);
    const menu = await this.getVendorMenu(vendorId);
    const cutoff =
      period === "today" ? startOfDay(new Date()).getTime()
      : period === "week" ? daysAgo(7).getTime()
      : period === "month" ? daysAgo(30).getTime()
      : 0;

    const relevant = orders
      .filter((o) => o.subOrder.status !== ORDER_STATUS.CANCELLED)
      .filter((o) => new Date(o.createdAt).getTime() >= cutoff);

    const tally = {};
    let totalUnits = 0;
    relevant.forEach((o) => {
      o.subOrder.items.forEach((item) => {
        if (!tally[item.mealId]) tally[item.mealId] = { qty: 0, revenue: 0 };
        tally[item.mealId].qty += item.qty;
        tally[item.mealId].revenue += item.qty * item.price;
        totalUnits += item.qty;
      });
    });

    return menu
      .map((meal) => ({
        meal,
        salesCount: tally[meal.id]?.qty || 0,
        revenue: tally[meal.id]?.revenue || 0,
        popularityPct: totalUnits ? Math.round(((tally[meal.id]?.qty || 0) / totalUnits) * 100) : 0,
      }))
      .sort((a, b) => b.salesCount - a.salesCount);
  },
};
