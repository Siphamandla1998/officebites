import { supabase } from "./api/supabaseClient";

// authService — thin wrapper around Supabase Auth + the profiles table.
// Every function still returns { user, token } shaped like before, or
// throws with a `.message`, so AuthContext and the login/register pages
// didn't need to change shape, only what they send in.

async function fetchProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    avatar: data.avatar_url,
    building: data.building,
    vendorId: data.vendor_id,
  };
}

export const authService = {
  async login({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw { message: error.message, status: error.status };
    const user = await fetchProfile(data.user.id);
    return { user, token: data.session.access_token };
  },

  async register({ name, email, password, role, building }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role, building } }, // read by the handle_new_user() DB trigger
    });
    if (error) throw { message: error.message, status: error.status };

    // Email confirmation may be required depending on your Supabase auth
    // settings — if so, data.session is null here and the profile row
    // already exists (trigger ran on signup) but can't sign in yet.
    if (!data.session) {
      return {
        user: { id: data.user.id, name, email, role: role || "customer", building },
        token: null,
        needsEmailConfirmation: true,
      };
    }
    const user = await fetchProfile(data.user.id);
    return { user, token: data.session.access_token };
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw { message: error.message };
    return { success: true };
  },

  /** Reads the current Supabase session (if any) and its profile — used on app load. */
  async getCurrentUser() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    return fetchProfile(data.session.user.id);
  },

  /** Lets AuthContext react to sign-in/sign-out from anywhere (e.g. a magic-link tab, or token expiry). */
  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  },
};
