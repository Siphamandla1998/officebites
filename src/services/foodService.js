import { mockResolve } from "./api/mockAdapter";
import { meals } from "../mock/meals";
import { categories } from "../mock/categories";

export const foodService = {
  async getCategories() {
    return mockResolve(categories);
  },

  async getMeals({ vendorId, category, search } = {}) {
    let result = [...meals];
    if (vendorId) result = result.filter((m) => m.vendorId === vendorId);
    if (category) result = result.filter((m) => m.category === category);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.vendorName.toLowerCase().includes(q)
      );
    }
    return mockResolve(result);
  },

  async getMealById(id) {
    const meal = meals.find((m) => m.id === id);
    if (!meal) return mockResolve(null, { delay: 200 });
    return mockResolve(meal);
  },

  async getPopularMeals(limit = 6) {
    const sorted = [...meals].sort((a, b) => b.rating - a.rating).slice(0, limit);
    return mockResolve(sorted);
  },
};
