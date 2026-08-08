import { supabase } from "./api/supabaseClient";

/**
 * Get the currently authenticated user.
 */
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

/**
 * Convert a database message into the format
 * currently expected by the frontend.
 */
const mapMessage = (message, currentUserId, participantIds = {}) => {
  const sender =
    message.sender_id === currentUserId
      ? "customer"
      : "vendor";

  return {
    id: message.id,
    sender,
    senderId: message.sender_id,
    text: message.text,
    time: message.created_at,
    read: message.read,
  };
};

/**
 * Convert a database conversation into
 * the format expected by the current UI.
 */
const mapConversation = (
  conversation,
  currentUserId,
  vendorName = "Vendor"
) => {
  const messages = (conversation.messages || []).map((message) =>
    mapMessage(
      message,
      currentUserId,
      {
        customerId: conversation.customer_id,
        vendorId: conversation.vendor_id,
      }
    )
  );

  return {
    id: conversation.id,

    customerId: conversation.customer_id,

    vendorId: conversation.vendor_id,

    vendorName:
      conversation.vendor?.name ||
      vendorName ||
      "Vendor",

    messages,

    createdAt: conversation.created_at,

    updatedAt: conversation.updated_at,
  };
};

export const chatService = {
  /**
   * Get all conversations belonging to the
   * currently authenticated customer/vendor.
   */
  async getConversations(userId) {
    if (!userId) {
      throw new Error("User ID is required.");
    }

    const { data, error } = await supabase
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
      .or(
        `customer_id.eq.${userId},vendor_id.eq.${userId}`
      )
      .order("updated_at", {
        ascending: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    const conversations = data || [];

    if (conversations.length === 0) {
      return [];
    }

    /**
     * Get vendor IDs so we can display
     * the actual vendor names.
     */
    const vendorIds = [
      ...new Set(
        conversations
          .map((conversation) => conversation.vendor_id)
          .filter(Boolean)
      ),
    ];

    let vendors = [];

    if (vendorIds.length > 0) {
      const {
        data: vendorData,
        error: vendorError,
      } = await supabase
        .from("vendors")
        .select("id, name")
        .in("id", vendorIds);

      if (vendorError) {
        throw new Error(vendorError.message);
      }

      vendors = vendorData || [];
    }

    return conversations.map((conversation) => {
      const vendor = vendors.find(
        (item) => item.id === conversation.vendor_id
      );

      return mapConversation(
        {
          ...conversation,
          vendor,
        },
        userId
      );
    });
  },

  /**
   * Get one conversation and all of its messages.
   */
  async getConversation(id) {
    if (!id) {
      return null;
    }

    const user = await getCurrentUser();

    const { data, error } = await supabase
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
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    /**
     * RLS should already prevent unauthorized access,
     * but keep this defensive check as well.
     */
    if (
      data.customer_id !== user.id &&
      data.vendor_id !== user.id
    ) {
      throw new Error(
        "You do not have access to this conversation."
      );
    }

    const {
      data: vendor,
      error: vendorError,
    } = await supabase
      .from("vendors")
      .select("id, name")
      .eq("id", data.vendor_id)
      .maybeSingle();

    if (vendorError) {
      throw new Error(vendorError.message);
    }

    return mapConversation(
      {
        ...data,
        vendor,
      },
      user.id
    );
  },

  /**
   * Send a real message through Supabase.
   *
   * The sender is always taken from the authenticated
   * Supabase user rather than trusting the frontend.
   */
  async sendMessage(conversationId, { text }) {
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
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    /**
     * Keep conversation ordering current.
     */
    await supabase
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    return mapMessage(data, user.id);
  },

  /**
   * Mark all messages sent by the other participant
   * as read.
   */
  async markConversationRead(conversationId) {
    if (!conversationId) {
      throw new Error("Conversation ID is required.");
    }

    const user = await getCurrentUser();

    /**
     * First confirm that the user participates
     * in this conversation.
     */
    const { data: conversation, error: conversationError } =
      await supabase
        .from("conversations")
        .select("id, customer_id, vendor_id")
        .eq("id", conversationId)
        .maybeSingle();

    if (conversationError) {
      throw new Error(conversationError.message);
    }

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    if (
      conversation.customer_id !== user.id &&
      conversation.vendor_id !== user.id
    ) {
      throw new Error(
        "You do not have access to this conversation."
      );
    }

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

  /**
   * Find an existing customer/vendor conversation
   * or create one if it doesn't exist.
   */
  async startConversation({
    vendorId,
    vendorName,
    customerId,
  }) {
    if (!vendorId) {
      throw new Error("Vendor ID is required.");
    }

    const user = await getCurrentUser();

    const actualCustomerId =
      customerId || user.id;

    if (actualCustomerId !== user.id) {
      throw new Error(
        "You can only start a conversation for yourself."
      );
    }

    /**
     * Check for an existing conversation.
     */
    const { data: existing, error: existingError } =
      await supabase
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
        .eq("customer_id", actualCustomerId)
        .eq("vendor_id", vendorId)
        .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing) {
      return mapConversation(
        {
          ...existing,
          vendor: {
            id: vendorId,
            name: vendorName || "Vendor",
          },
        },
        user.id
      );
    }

    /**
     * Create a new conversation.
     */
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        customer_id: actualCustomerId,
        vendor_id: vendorId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      customerId: data.customer_id,
      vendorId: data.vendor_id,
      vendorName: vendorName || "Vendor",
      messages: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  /**
   * Get unread messages for a user.
   */
  async getUnreadCount(userId) {
    if (!userId) {
      return 0;
    }

    const { data: conversations, error } =
      await supabase
        .from("conversations")
        .select("id")
        .or(
          `customer_id.eq.${userId},vendor_id.eq.${userId}`
        );

    if (error) {
      throw new Error(error.message);
    }

    if (!conversations?.length) {
      return 0;
    }

    const conversationIds =
      conversations.map((conversation) => conversation.id);

    const { count, error: countError } =
      await supabase
        .from("messages")
        .select("id", {
          count: "exact",
          head: true,
        })
        .in(
          "conversation_id",
          conversationIds
        )
        .neq("sender_id", userId)
        .eq("read", false);

    if (countError) {
      throw new Error(countError.message);
    }

    return count || 0;
  },

  /**
   * Subscribe to new messages in a conversation.
   *
   * The Messages page can use this later for
   * real-time chat without polling.
   */
  subscribeToConversation(
    conversationId,
    callback
  ) {
    if (!conversationId || !callback) {
      return () => {};
    }

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const user = await getCurrentUser();

          callback(
            mapMessage(
              payload.new,
              user.id
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Support chat is intentionally disabled for now.
   *
   * We don't have a support conversation schema yet,
   * so we must not keep fake support messages.
   */
  async getSupportConversation() {
    return null;
  },

  getQuickReplies() {
    return [
      "Thanks, that answers it!",
      "I still need help with this.",
      "Can you check my ticket status?",
    ];
  },

  async sendSupportMessage() {
    throw new Error(
      "OfficeBites support messaging is not available yet."
    );
  },

  async sendSupportAgentReply() {
    throw new Error(
      "OfficeBites support messaging is not available yet."
    );
  },
};
