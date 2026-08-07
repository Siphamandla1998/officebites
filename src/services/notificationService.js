import { supabase } from "./api/supabaseClient";

const getUserId = async () => {
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

const mapNotification = (notification) => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  read: notification.read,
  dismissed: notification.dismissed,
  createdAt: notification.created_at,
});

export const notificationService = {
  async getNotifications() {
    const userId = await getUserId();

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

    return (data || []).map(mapNotification);
  },

  async addNotification({ type = "general", title, body }) {
    const userId = await getUserId();

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
      notification: mapNotification(data),
    };
  },

  async markAsRead(id) {
    const userId = await getUserId();

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
    const userId = await getUserId();

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
    const userId = await getUserId();

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

  async getVendorNotifications() {
    const userId = await getUserId();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("vendor_id, role")
      .eq("id", userId)
      .single();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (profile.role !== "vendor" || !profile.vendor_id) {
      return [];
    }

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

    return (data || []).map(mapNotification);
  },

  async addVendorNotification({ type = "general", title, body }) {
    const userId = await getUserId();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("vendor_id, role")
      .eq("id", userId)
      .single();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (profile.role !== "vendor" || !profile.vendor_id) {
      throw new Error("Current account is not linked to a vendor.");
    }

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
      notification: mapNotification(data),
    };
  },

  async markVendorNotificationRead(id) {
    const userId = await getUserId();

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

  async dismissVendorNotification(id) {
    const userId = await getUserId();

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

  async getVendorUnreadCount() {
    const userId = await getUserId();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("vendor_id, role")
      .eq("id", userId)
      .single();

    if (profileError) {
      throw new Error(profileError.message);
    }

    if (profile.role !== "vendor" || !profile.vendor_id) {
      return 0;
    }

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
};
```
