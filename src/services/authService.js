import { supabase } from "./api/supabaseClient";

// authService — thin wrapper around Supabase Auth + the profiles table.
// Every function still returns { user, token } shaped like before, or
// throws with a `.message`, so AuthContext and the login/register pages
// don't need to change shape.

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

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
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      throw {
        message: error.message,
        status: error.status,
      };
    }

    const user = await fetchProfile(data.user.id);

    return {
      user,
      token: data.session.access_token,
    };
  },

  async register({
    name,
    email,
    password,
    role,
    building,
    businessName,
    businessCategory,
  }) {
    const registrationRole = role || "customer";
    if (!["customer", "vendor"].includes(registrationRole)) {
      throw new Error("Only customer or vendor registration is allowed.");
    }
    if (registrationRole === "vendor" && (!businessName?.trim() || !businessCategory?.trim())) {
      throw new Error("Business name and category are required.");
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: registrationRole,
          building,
          business_name: businessName?.trim() || null,
          business_category:
            businessCategory?.trim() || null,
        },
      },
    });

    if (error) {
      throw {
        message: error.message,
        status: error.status,
      };
    }

    // Supabase may require email confirmation.
    // In that case the database trigger has already created
    // the profile and, for vendors, the pending storefront.
    if (!data.session) {
      return {
        user: {
          id: data.user.id,
          name,
          email,
          role: registrationRole,
          building,
          vendorId: null,
        },
        token: null,
        needsEmailConfirmation: true,
      };
    }

    // If email confirmation is disabled, the user already has
    // a session and we can retrieve the profile created by the
    // handle_new_user() database trigger.
    const user = await fetchProfile(data.user.id);

    return {
      user,
      token: data.session.access_token,
      needsEmailConfirmation: false,
    };
  },

  async becomeVendor({
    businessName,
    businessCategory,
    building,
  }) {
    const { data, error } = await supabase.rpc(
      "become_vendor",
      {
        p_business_name: businessName?.trim(),
        p_business_category: businessCategory?.trim(),
        p_building: building?.trim() || null,
      }
    );

    if (error) {
      throw {
        message: error.message,
        status: error.code,
      };
    }

    if (!data?.vendor_id) {
      throw {
        message:
          "Vendor application was submitted but no vendor account was returned.",
      };
    }

    return {
      vendorId: data.vendor_id,
      status: data.status,
      alreadyVendor: Boolean(data.already_vendor),
    };
  },

  async logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw {
        message: error.message,
      };
    }

    return {
      success: true,
    };
  },

  /**
   * Reads the current Supabase session (if any) and its profile.
   * Used when OfficeBites loads.
   */
  async getCurrentUser() {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      return null;
    }

    return fetchProfile(data.session.user.id);
  },

  /**
   * Lets AuthContext react to sign-in/sign-out events.
   */
  onAuthStateChange(callback) {
    const { data } =
      supabase.auth.onAuthStateChange((_event, session) =>
        callback(session)
      );

    return () => data.subscription.unsubscribe();
  },

  /**
   * Sends a password-reset email.
   */
  async requestPasswordReset(email) {
    const { error } =
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

    if (error) {
      throw {
        message: error.message,
        status: error.status,
      };
    }

    return {
      success: true,
    };
  },

  /**
   * Sets a new password for the current recovery session.
   */
  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw {
        message: error.message,
        status: error.status,
      };
    }

    return {
      success: true,
    };
  },
};
