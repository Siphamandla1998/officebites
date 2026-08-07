```javascript
import { supabase } from "./api/supabaseClient";

const getCurrentUserId = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("You must be signed in.");
  }

  return user.id;
};

const getCurrentProfile = async () => {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

export const notificationService = {
  // ============================================================
  // CUSTOMER NOTIFICATIONS
  // ============================================================

  async getNotifications() {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .eq("dismissed", false)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      read: notification.read,
      dismissed: notification.dismissed,
      createdAt: notification.created_at,
    }));
  },

  async addNotification({ type = "general", title, body }) {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        type,
        title,
        body,
        read: false,
        dismissed: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      notification: {
        id: data.id,
        type: data.type,
        title: data.title,
        body: data.body,
        read: data.read,
        dismissed: data.dismissed,
        createdAt: data.created_at,
      },
    };
  },

  async markAsRead(id) {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from("notifications")
      .update({
        read: true,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },

  async dismiss(id) {
    const userId = await getCurrentUserId();

    const { error } = await supabase
      .from("notifications")
      .update({
        dismissed: true,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },

  async getUnreadCount() {
    const userId = await getCurrentUserId();

    const { count, error } = await supabase
      .from("notifications")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", userId)
      .eq("read", false)
      .eq("dismissed", false);

    if (error) {
      throw new Error(error.message);
    }

    return count || 0;
  },

  // ============================================================
  // VENDOR NOTIFICATIONS
  // ============================================================

  async getVendorNotifications() {
    const profile = await getCurrentProfile();

    if (!profile.vendor_id) {
      return [];
    }

    /*
     * Vendor notifications are stored against the vendor user's
     * profile ID, not the vendor table ID.
     *
     * This keeps notifications tied to the authenticated account.
     */

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", profile.id)
      .eq("dismissed", false)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      read: notification.read,
      dismissed: notification.dismissed,
      createdAt: notification.created_at,
    }));
  },

  async addVendorNotification({ type = "general", title, body }) {
    const profile = await getCurrentProfile();

    if (!profile.vendor_id) {
      throw new Error("The current account is not linked to a vendor.");
    }

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: profile.id,
        type,
        title,
        body,
        read: false,
        dismissed: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      notification: {
        id: data.id,
        type: data.type,
        title: data.title,
        body: data.body,
        read: data.read,
        dismissed: data.dismissed,
        createdAt: data.created_at,
      },
    };
  },

  async markVendorNotificationRead(id) {
    const profile = await getCurrentProfile();

    if (!profile.vendor_id) {
      throw new Error("The current account is not linked to a vendor.");
    }

    const { error } = await supabase
      .from("notifications")
      .update({
        read: true,
      })
      .eq("id", id)
      .eq("user_id", profile.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },

  async dismissVendorNotification(id) {
    const profile = await getCurrentProfile();

    if (!profile.vendor_id) {
      throw new Error("The current account is not linked to a vendor.");
    }

    const { error } = await supabase
      .from("notifications")
      .update({
        dismissed: true,
      })
      .eq("id", id)
      .eq("user_id", profile.id);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },

  async getVendorUnreadCount() {
    const profile = await getCurrentProfile();

    if (!profile.vendor_id) {
      return 0;
    }

    const { count, error } = await supabase
      .from("notifications")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", profile.id)
      .eq("read", false)
      .eq("dismissed", false);

    if (error) {
      throw new Error(error.message);
    }

    return count || 0;
  },
};
```
