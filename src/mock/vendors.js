import { VENDOR_STATUS } from "../utils/constants";

export const vendors = [
  {
    id: "v-1",
    name: "Sne's Kitchen",
    tagline: "Fresh, affordable homemade meals prepared daily.",
    category: "Meals",
    rating: 4.8,
    reviewCount: 214,
    prepTimeMins: 25,
    coverImage:
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&q=80",
    logo: "https://images.unsplash.com/photo-1607013407627-6ba31a1a1f96?w=200&q=80",
    building: "Alice Lane Office Tower",
    status: VENDOR_STATUS.APPROVED,
    featured: true,
    subscriptionTier: "professional",
    joinedAt: "2025-11-02",
  },
  {
    id: "v-2",
    name: "Sabe's Fast Bite",
    tagline: "Fast food, kotas, shawarmas and platters made fresh.",
    category: "Kotas",
    rating: 4.7,
    reviewCount: 189,
    prepTimeMins: 20,
    coverImage:
      "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&q=80",
    logo: "https://images.unsplash.com/photo-1600891964092-4316c288032e?w=200&q=80",
    building: "Alice Lane Office Tower",
    status: VENDOR_STATUS.APPROVED,
    featured: true,
    subscriptionTier: "basic",
    joinedAt: "2025-11-10",
  },
];
