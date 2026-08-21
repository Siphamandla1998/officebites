import { supabase } from "./api/supabaseClient";

const mapMessage = (message) => ({
  id: message.id,
  conversationId: message.conversation_id,
  senderId: message.sender_id,
  text: message.text,
  read: message.read,
  time: message.created_at,
});

const mapConversation = (conversation) => ({
  id: conversation.id,
  customerId: conversation.customer_id,
  vendorId: conversation.vendor_id,
  createdAt: conversation.created_at,
  updatedAt: conversation.updated_at,
  messages: (conversation.messages || []).map(mapMessage),
});

const getCurrentUser = async () => {
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

  return user;
};

const getVendorIdForUser = async (userId) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("vendor_id, role")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data?.vendor_id || null;
};

export const chatService = {
  // ==========================================
  // CUSTOMER / VENDOR CONVERSATIONS
  // ==========================================

  /**
   * Admin-only: every conversation in the system, with participant names
   * for display. RLS's is_admin() clause on `conversations` is what
   * actually authorizes this — a non-admin calling this just gets an empty
   * result, not an error, since RLS silently filters rows they can't see.
   */
  async getAllConversationsForAdmin() {
    const { data, error } = await supabase
      .from("conversations")
      .select(`
        id,
        customer_id,
        vendor_id,
        created_at,
        updated_at,
        profiles ( name ),
        vendors ( name ),
        messages (
          id,
          conversation_id,
          sender_id,
          text,
          read,
          created_at
        )
      `)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map((row) => ({
      ...mapConversation(row),
      customerName: row.profiles?.name || "Guest",
      vendorName: row.vendors?.name || "Unknown vendor",
    }));
  },

  /**
   * Admin-only deletion — for data retention (e.g. erasing conversations
   * older than a few days). Cascades to delete every message in the thread.
   */
  async deleteConversation(id) {
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) {
      throw new Error(error.message);
    }
  },

  async getConversations() {
    const user = await getCurrentUser();

    const vendorId = await getVendorIdForUser(user.id);

    let query = supabase
      .from("conversations")
      .select(`
        id,
        customer_id,
        vendor_id,
        created_at,
        updated_at,
        messages (
          id,
          conversation_id,
          sender_id,
          text,
          read,
          created_at
        )
      `)
      .order("updated_at", {
        ascending: false,
      });

    if (vendorId) {
      query = query.eq("vendor_id", vendorId);
    } else {
      query = query.eq("customer_id", user.id);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).map(mapConversation);
  },

  async getConversation(id) {
    if (!id) {
      throw new Error("Conversation ID is required.");
    }

    const user = await getCurrentUser();

    const vendorId = await getVendorIdForUser(user.id);

    let query = supabase
      .from("conversations")
      .select(`
        id,
        customer_id,
        vendor_id,
        created_at,
        updated_at,
        messages (
          id,
          conversation_id,
          sender_id,
          text,
          read,
          created_at
        )
      `)
      .eq("id", id);

    if (vendorId) {
      query = query.eq("vendor_id", vendorId);
    } else {
      query = query.eq("customer_id", user.id);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return data ? mapConversation(data) : null;
  },

  // ==========================================
  // START CUSTOMER → VENDOR CONVERSATION
  // ==========================================

  async startConversation({ vendorId }) {
    if (!vendorId) {
      throw new Error("Vendor ID is required.");
    }

    const user = await getCurrentUser();

    const { data: existing, error: existingError } = await supabase
      .from("conversations")
      .select("*")
      .eq("customer_id", user.id)
      .eq("vendor_id", vendorId)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing) {
      return mapConversation(existing);
    }

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        customer_id: user.id,
        vendor_id: vendorId,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapConversation(data);
  },

  // ==========================================
  // SEND MESSAGE
  // ==========================================

  async sendMessage(conversationId, text) {
    if (!conversationId) {
      throw new Error("Conversation ID is required.");
    }

    if (!text?.trim()) {
      throw new Error("Message cannot be empty.");
    }

    const user = await getCurrentUser();

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        text: text.trim(),
        read: false,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapMessage(data);
  },

  // ==========================================
  // MARK CONVERSATION READ
  // ==========================================

  async markConversationRead(conversationId) {
    if (!conversationId) return;

    const user = await getCurrentUser();

    const { error } = await supabase
      .from("messages")
      .update({
        read: true,
      })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .eq("read", false);

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
    };
  },

  // ==========================================
  // UNREAD COUNT
  // ==========================================

  async getUnreadCount() {
    const user = await getCurrentUser();

    const vendorId = await getVendorIdForUser(user.id);

    let conversationQuery = supabase
      .from("conversations")
      .select("id");

    if (vendorId) {
      conversationQuery = conversationQuery.eq(
        "vendor_id",
        vendorId
      );
    } else {
      conversationQuery = conversationQuery.eq(
        "customer_id",
        user.id
      );
    }

    const {
      data: conversations,
      error: conversationError,
    } = await conversationQuery;

    if (conversationError) {
      throw new Error(conversationError.message);
    }

    if (!conversations?.length) {
      return 0;
    }

    const ids = conversations.map((conversation) => conversation.id);

    const { count, error } = await supabase
      .from("messages")
      .select("id", {
        count: "exact",
        head: true,
      })
      .in("conversation_id", ids)
      .neq("sender_id", user.id)
      .eq("read", false);

    if (error) {
      throw new Error(error.message);
    }

    return count || 0;
  },

  // ==========================================
  // QUICK REPLIES
  // ==========================================

  getQuickReplies() {
    return [
      "Thanks, that answers it!",
      "I still need help with this.",
      "Can you check my order status?",
    ];
  },
};
