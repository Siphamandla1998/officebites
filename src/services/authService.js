import { mockResolve } from "./api/mockAdapter";
import { users } from "../mock/users";
import { ROLES } from "../utils/constants";

// authService — swap function bodies for axiosClient calls to `/auth/*`
// once a real backend exists. Signatures are designed to stay stable.

export const authService = {
  async login({ email, role }) {
    const match =
      users.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) ||
      users.find((u) => u.role === role) ||
      users[0];
    const token = `mock-token-${match.id}`;
    localStorage.setItem("ob_token", token);
    return mockResolve({ user: match, token });
  },

  async register({ name, email, role = ROLES.CUSTOMER }) {
    const newUser = {
      id: `u-${Date.now()}`,
      name,
      email,
      role,
      avatar: `https://i.pravatar.cc/150?u=${encodeURIComponent(email)}`,
    };
    const token = `mock-token-${newUser.id}`;
    localStorage.setItem("ob_token", token);
    return mockResolve({ user: newUser, token });
  },

  async logout() {
    localStorage.removeItem("ob_token");
    localStorage.removeItem("ob_user");
    return mockResolve({ success: true }, { delay: 150 });
  },

  async getCurrentUser() {
    const raw = localStorage.getItem("ob_user");
    return mockResolve(raw ? JSON.parse(raw) : null, { delay: 150 });
  },
};
