import { ROLES } from "../utils/constants";

// Passwords are irrelevant in the mock layer — any password authenticates.
export const users = [
  {
    id: "u-1",
    name: "Lindiwe Zulu",
    email: "customer@officebites.co.za",
    role: ROLES.CUSTOMER,
    avatar: "https://i.pravatar.cc/150?img=47",
    building: "Alice Lane Office Tower",
    favouriteMealIds: ["m-1", "m-19"],
  },
  {
    id: "u-2",
    name: "Sne Mokoena",
    email: "vendor@officebites.co.za",
    role: ROLES.VENDOR,
    avatar: "https://i.pravatar.cc/150?img=12",
    vendorId: "v-1",
  },
  {
    id: "u-3",
    name: "OfficeBites Admin",
    email: "admin@officebites.co.za",
    role: ROLES.ADMIN,
    avatar: "https://i.pravatar.cc/150?img=33",
  },
];
