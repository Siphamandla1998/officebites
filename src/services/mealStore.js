import { meals as seedMeals } from "../mock/meals";

// Single in-memory source of truth for meals, shared between vendorService
// (writes: add/edit/delete/availability) and foodService (reads: browsing,
// search, popular meals) so a vendor's menu edits are immediately visible
// to customers without a page reload. Swap for real API calls later —
// nothing that imports these functions needs to change.
let mealStore = [...seedMeals];

export function getMeals() {
  return mealStore;
}

export function setMeals(updater) {
  mealStore = typeof updater === "function" ? updater(mealStore) : updater;
  return mealStore;
}
