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
  // Both come from joined tables — present when the query selected them
  // (see CONVERSATION_SELECT below), undefined otherwise. Falling back to
  // a neutral label in mapConversation rather than the page components
  // means every caller gets a real display name without duplicating the
  // "Guest" / "Vendor" fallback in five different UI files.
  customerName: conversation.profiles?.name || "Guest",
  vendorName: conversation.vendors?.name || "Vendor",
  createdAt: conversation.created_at,
  updatedAt: conversation.updated_at,
  messages: (conversation.messages || []).map(mapMessage),
});

// Used by getConversations/getConversation (customer + vendor side) so both
// participants' names resolve the same way getAllConversationsForAdmin()
// already did — this was previously missing here, which is the root cause
// of chat threads showing no name for the other participant even though
// both sides are logged in: mapConversation had nothing to read a name
// from, because these two queries never joined profiles/vendors at all.
const CONVERSATION_SELECT = `
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
`;

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
      .select(CONVERSATION_SELECT)
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
      .select(CONVERSATION_SELECT)
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
  // START VENDOR → CUSTOMER CONVERSATION
  // ==========================================

  /**
   * A vendor may only message a customer who has actually placed an order
   * involving them — never an arbitrary customer. That relationship check
   * is enforced at the database level (see the
   * conversations_insert_vendor_with_order policy, migration 0016): this
   * insert will itself be rejected by RLS if the customer has no order
   * with this vendor, not merely skipped client-side, so it's not
   * bypassable by calling the service function directly.
   */
  async startConversationAsVendor({ customerId }) {
    if (!customerId) {
      throw new Error("Customer ID is required.");
    }

    const user = await getCurrentUser();
    const vendorId = await getVendorIdForUser(user.id);

    if (!vendorId) {
      throw new Error("Current account is not linked to a vendor.");
    }

    const { data: existing, error: existingError } = await supabase
      .from("conversations")
      .select("*")
      .eq("customer_id", customerId)
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
        customer_id: customerId,
        vendor_id: vendorId,
      })
      .select("*")
      .single();

    if (error) {
      // RLS denial (no matching order) surfaces as a generic Postgres
      // permission error — translate it into something the vendor UI can
      // actually explain, rather than a raw "new row violates row-level
      // security policy" string.
      if (error.code === "42501" || /row-level security/i.test(error.message)) {
        throw new Error("You can only message a customer who has placed an order with you.");
      }
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
