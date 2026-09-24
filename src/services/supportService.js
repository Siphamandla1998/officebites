import {
  supabase,
  uploadPrivate,
  getSignedUrl,
  BUCKETS,
} from "./api/supabaseClient";

// -----------------------------------------------------------------------------
// OfficeBites Support
//
// Current model:
// - help_articles = self-service knowledge base
// - support_tickets = authenticated customer support requests
// - support_ticket_messages = customer/admin ticket conversation
// - admin replies/updates go through protected RPCs
// - attachments are private
//
// -----------------------------------------------------------------------------

export const FAQ_CATEGORIES = [
  "Orders",
  "Payments",
  "Account",
  "Vendor Support",
  "Technical Issues",
];

const CATEGORY_TO_DB = {
  Orders: "order",
  Payments: "payment",
  Account: "account",
  "Vendor Support": "vendor",
  "Technical Issues": "technical",
  Other: "other",
};

const DB_TO_CATEGORY = {
  order: "Orders",
  payment: "Payments",
  account: "Account",
  vendor: "Vendor Support",
  technical: "Technical Issues",
  other: "Other",
};

const PRIORITIES = new Set([
  "low",
  "normal",
  "high",
  "urgent",
]);

function normalizeCategory(category) {
  if (!category) return "other";

  if (CATEGORY_TO_DB[category]) {
    return CATEGORY_TO_DB[category];
  }

  const normalized = String(category)
    .trim()
    .toLowerCase();

  if (
    [
      "order",
      "payment",
      "account",
      "vendor",
      "technical",
      "other",
    ].includes(normalized)
  ) {
    return normalized;
  }

  return "other";
}

function normalizePriority(priority) {
  const normalized = String(
    priority || "normal"
  ).toLowerCase();

  return PRIORITIES.has(normalized)
    ? normalized
    : "normal";
}

function mapArticle(row) {
  if (!row) return null;

  return {
    id: row.id,

    title:
      row.title ||
      row.question ||
      "",

    question:
      row.question ||
      row.title ||
      "",

    summary:
      row.summary ||
      "",

    answer:
      row.answer ||
      row.content ||
      "",

    content:
      row.content ||
      row.answer ||
      "",

    category:
      DB_TO_CATEGORY[row.category] ||
      row.category ||
      "Other",

    slug:
      row.slug ||
      null,

    published:
      row.published ?? true,

    createdAt:
      row.created_at ||
      null,

    updatedAt:
      row.updated_at ||
      null,
  };
}

function mapMessage(row) {
  if (!row) return null;

  const isSupport =
    row.sender_role === "support";

  return {
    id: row.id,

    sender:
      isSupport
        ? "agent"
        : "user",

    senderRole:
      row.sender_role ||
      "customer",

    senderId:
      row.sender_id ||
      null,

    text:
      row.body ||
      "",

    internal:
      row.internal ?? false,

    time:
      row.created_at ||
      null,

    createdAt:
      row.created_at ||
      null,
  };
}

function mapTicket(row) {
  if (!row) return null;

  const messages = Array.isArray(
    row.support_ticket_messages
  )
    ? row.support_ticket_messages
        .slice()
        .sort(
          (a, b) =>
            new Date(a.created_at) -
            new Date(b.created_at)
        )
        .map(mapMessage)
    : [];

  return {
    id:
      row.id,

    ticketNumber:
      row.ticket_number ||
      "",

    subject:
      row.subject ||
      "",

    category:
      DB_TO_CATEGORY[row.category] ||
      row.category ||
      "Other",

    categoryKey:
      row.category ||
      "other",

    priority:
      row.priority ||
      "normal",

    status:
      row.status ||
      "open",

    orderId:
      row.order_id ||
      null,

    assignedTo:
      row.assigned_to ||
      null,

    meta:
      row.meta ||
      {},

    attachmentPath:
      row.attachment_url ||
      null,

    firstResponseAt:
      row.first_response_at ||
      null,

    resolvedAt:
      row.resolved_at ||
      null,

    createdAt:
      row.created_at ||
      null,

    updatedAt:
      row.updated_at ||
      null,

    requester: {
      id:
        row.requester_id ||
        null,

      name:
        row.requester_name ||
        "Customer",

      email:
        row.requester_email ||
        "",

      contact:
        row.requester_contact ||
        "",
    },

    messages,
  };
}

const TICKET_SELECT = `
  id,
  ticket_number,
  requester_id,
  requester_name,
  requester_email,
  requester_contact,
  subject,
  category,
  priority,
  status,
  order_id,
  assigned_to,
  meta,
  attachment_url,
  first_response_at,
  resolved_at,
  created_at,
  updated_at,
  support_ticket_messages (
    id,
    ticket_id,
    sender_id,
    sender_role,
    body,
    internal,
    created_at
  )
`;

async function getCurrentUser() {
  const {
    data,
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  return data?.user || null;
}

async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error(
      "Please sign in before contacting OfficeBites support."
    );
  }

  return user;
}

async function getRequesterDetails(user) {
  let profile = null;

  const {
    data,
    error,
  } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!error) {
    profile = data;
  }

  return {
    name:
      profile?.name ||
      user.user_metadata?.name ||
      user.user_metadata?.full_name ||
      "Customer",

    email:
      profile?.email ||
      user.email ||
      "",
  };
}

function safeFileName(name = "attachment") {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-120);
}

async function uploadAttachment(
  file,
  userId
) {
  if (!file) return null;

  if (!userId) {
    throw new Error(
      "You must be signed in to upload a support attachment."
    );
  }

  const fileName =
    safeFileName(file.name);

  const path =
    `${userId}/${crypto.randomUUID()}-${fileName}`;

  return uploadPrivate(
    BUCKETS.SUPPORT_ATTACHMENTS,
    path,
    file
  );
}

async function createTicket({
  name,
  email,
  contact,
  subject,
  category,
  message,
  priority = "normal",
  orderId = null,
  meta = {},
  attachment = null,
}) {
  const user =
    await requireCurrentUser();

  const requester =
    await getRequesterDetails(user);

  const attachmentPath =
    await uploadAttachment(
      attachment,
      user.id
    );

  const cleanMessage =
    String(message || "").trim();

  if (!cleanMessage) {
    throw new Error(
      "Please describe how OfficeBites can help."
    );
  }

  const cleanSubject =
    String(subject || "").trim();

  if (!cleanSubject) {
    throw new Error(
      "Please provide a subject."
    );
  }

  // The database trigger controls:
  // - requester_id
  // - ticket_number
  // - initial status
  // - initial priority
  // - assignment
  // - response timestamps
  //
  // We still send requester_id because the RLS INSERT policy
  // requires it to match auth.uid(). The trigger then
  // independently normalizes it server-side.
  const {
    data: ticketRow,
    error: ticketError,
  } = await supabase
    .from("support_tickets")
    .insert({
      requester_id:
        user.id,

      requester_name:
        String(
          name ||
          requester.name ||
          "Customer"
        ).trim(),

      requester_email:
        String(
          email ||
          requester.email ||
          ""
        ).trim() || null,

      requester_contact:
        String(contact || "").trim() ||
        null,

      subject:
        cleanSubject,

      category:
        normalizeCategory(category),

      priority:
        normalizePriority(priority),

      order_id:
        orderId ||
        null,

      meta:
        meta &&
        typeof meta === "object"
          ? meta
          : {},

      attachment_url:
        attachmentPath,
    })
    .select("id, ticket_number")
    .single();

  if (ticketError) {
    throw new Error(
      ticketError.message
    );
  }

  const {
    error: messageError,
  } = await supabase
    .from(
      "support_ticket_messages"
    )
    .insert({
      ticket_id:
        ticketRow.id,

      sender_id:
        user.id,

      sender_role:
        "customer",

      body:
        cleanMessage,

      internal:
        false,
    });

  if (messageError) {
    throw new Error(
      messageError.message
    );
  }

  return supportService.getTicketById(
    ticketRow.id
  );
}

export const supportService = {
  // ---------------------------------------------------------------------------
  // Knowledge base
  // ---------------------------------------------------------------------------

  async getFAQCategories() {
    return FAQ_CATEGORIES;
  },

  async searchFAQs({
    query,
    category,
  } = {}) {
    let request = supabase
      .from("help_articles")
      .select("*");

    const dbCategory =
      category &&
      category !== "all"
        ? normalizeCategory(category)
        : null;

    if (dbCategory) {
      request =
        request.eq(
          "category",
          dbCategory
        );
    }

    const {
      data,
      error,
    } = await request;

    if (error) {
      throw new Error(
        error.message
      );
    }

    let articles =
      (data || []).map(
        mapArticle
      );

    if (query) {
      const q =
        String(query)
          .trim()
          .toLowerCase();

      if (q) {
        articles =
          articles.filter(
            (article) =>
              article.title
                .toLowerCase()
                .includes(q) ||
              article.summary
                .toLowerCase()
                .includes(q) ||
              article.content
                .toLowerCase()
                .includes(q)
          );
      }
    }

    return articles;
  },

  async getGuides() {
    const {
      data,
      error,
    } = await supabase
      .from("help_articles")
      .select("*");

    if (error) {
      throw new Error(
        error.message
      );
    }

    return (data || []).map(
      mapArticle
    );
  },

  async getGuideById(id) {
    const {
      data,
      error,
    } = await supabase
      .from("help_articles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    return data
      ? mapArticle(data)
      : null;
  },

  // ---------------------------------------------------------------------------
  // Customer support tickets
  // ---------------------------------------------------------------------------

  async submitContactForm({
    name,
    email,
    contact,
    subject,
    category,
    message,
    attachment,
    orderId = null,
  }) {
    return createTicket({
      name,
      email,
      contact,
      subject,
      category,
      message,
      orderId,
      attachment,
      priority:
        "normal",
    });
  },

  async reportProblem({
    type,
    description,
    priority,
    device,
    browser,
    os,
    screenshot,
    orderId = null,
  }) {
    const user =
      await requireCurrentUser();

    const requester =
      await getRequesterDetails(user);

    return createTicket({
      name:
        requester.name,

      email:
        requester.email,

      subject:
        `${type || "Technical issue"} report`,

      category:
        "technical",

      message:
        description,

      priority:
        normalizePriority(
          priority
        ),

      orderId,

      attachment:
        screenshot,

      meta: {
        type:
          type || null,

        device:
          device || null,

        browser:
          browser || null,

        os:
          os || null,
      },
    });
  },

  /**
   * Returns the signed-in customer's tickets.
   * RLS scopes ordinary customers to their own records.
   * Admins can see the wider support queue.
   */
  async getTickets() {
    await requireCurrentUser();

    const {
      data,
      error,
    } = await supabase
      .from("support_tickets")
      .select(TICKET_SELECT)
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (error) {
      throw new Error(
        error.message
      );
    }

    return (data || []).map(
      mapTicket
    );
  },

  async getTicketById(id) {
    if (!id) return null;

    await requireCurrentUser();

    const {
      data,
      error,
    } = await supabase
      .from("support_tickets")
      .select(TICKET_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message
      );
    }

    return data
      ? mapTicket(data)
      : null;
  },

  async replyToTicket(
    ticketId,
    text
  ) {
    const user =
      await requireCurrentUser();

    const body =
      String(text || "").trim();

    if (!body) {
      throw new Error(
        "Please enter a message."
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        "support_ticket_messages"
      )
      .insert({
        ticket_id:
          ticketId,

        sender_id:
          user.id,

        sender_role:
          "customer",

        body,

        internal:
          false,
      })
      .select(
        `
          id,
          ticket_id,
          sender_id,
          sender_role,
          body,
          internal,
          created_at
        `
      )
      .single();

    if (error) {
      throw new Error(
        error.message
      );
    }

    // Customers do NOT directly update ticket status.
    // Ticket lifecycle remains controlled by support/admin.
    return mapMessage(data);
  },

  // ---------------------------------------------------------------------------
  // Admin support operations
  // ---------------------------------------------------------------------------

  async adminReplyToTicket(
    ticketId,
    text,
    {
      internal = false,
    } = {}
  ) {
    const body =
      String(text || "").trim();

    if (!body) {
      throw new Error(
        "Please enter a message."
      );
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "admin_reply_support_ticket",
      {
        p_ticket_id:
          ticketId,

        p_body:
          body,

        p_internal:
          Boolean(internal),
      }
    );

    if (error) {
      throw new Error(
        error.message
      );
    }

    return data;
  },

  async adminUpdateTicket(
    ticketId,
    {
      status = null,
      priority = null,
      assignedTo = null,
    } = {}
  ) {
    const {
      data,
      error,
    } = await supabase.rpc(
      "admin_update_support_ticket",
      {
        p_ticket_id:
          ticketId,

        p_status:
          status,

        p_priority:
          priority,

        p_assigned_to:
          assignedTo,
      }
    );

    if (error) {
      throw new Error(
        error.message
      );
    }

    return data;
  },

  // ---------------------------------------------------------------------------
  // Private support attachments
  // ---------------------------------------------------------------------------

  async getAttachmentUrl(path) {
    if (!path) return null;

    await requireCurrentUser();

    return getSignedUrl(
      BUCKETS.SUPPORT_ATTACHMENTS,
      path,
      3600
    );
  },

  // ---------------------------------------------------------------------------
  // Feedback
  // ---------------------------------------------------------------------------

  async submitFeedback({
    rating,
    comment,
    recommend,
  }) {
    const user =
      await getCurrentUser();

    const {
      data,
      error,
    } = await supabase
      .from("feedback")
      .insert({
        user_id:
          user?.id || null,

        rating,
        comment,
        recommend,
      })
      .select()
      .single();

    if (error) {
      throw new Error(
        error.message
      );
    }

    return {
      id:
        data.id,

      rating:
        data.rating,

      comment:
        data.comment,

      recommend:
        data.recommend,

      createdAt:
        data.created_at,
    };
  },
};