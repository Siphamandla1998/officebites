import { supabase, uploadPrivate, getSignedUrl, BUCKETS } from "./api/supabaseClient";
import { TICKET_STATUS } from "../utils/constants";

// supportService — tickets, FAQs, guides, and feedback are now real Supabase
// tables (see supabase/migrations/0004_support.sql) instead of in-memory
// arrays, so they survive redeploys and are visible to admins. Live chat
// (getSupportConversation/sendSupportMessage/sendSupportAgentReply) stays a
// lightweight local simulation — there's no live agent backend yet.

export const FAQ_CATEGORIES = [
  "Orders",
  "Payments",
  "Account",
  "Vendor Support",
  "Technical Issues",
];

let ticketSeq = 0;

function generateTicketNumber() {
  ticketSeq += 1;
  return `SUP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}${ticketSeq}`;
}

function mapFAQ(row) {
  return {
    id: row.id,
    category: row.category,
    question: row.question,
    answer: row.answer,
  };
}

function mapGuide(row) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary || "",
    content: row.content || "",
  };
}

function mapMessage(row) {
  return {
    id: row.id,
    sender: row.sender_role, // "user" | "agent" — matches what SupportTickets.jsx renders
    text: row.text,
    time: row.created_at,
  };
}

function mapTicket(row) {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    meta: row.meta || {},
    attachmentPath: row.attachment_url || null,
    requester: {
      name: row.requester_name,
      email: row.requester_email,
    },
    messages: (row.support_ticket_messages || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(mapMessage),
  };
}

const TICKET_SELECT = `
  id, ticket_number, requester_id, requester_name, requester_email,
  subject, category, priority, status, meta, attachment_url, created_at,
  support_ticket_messages ( id, sender_role, text, created_at )
`;

async function getCurrentUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

async function uploadAttachment(file) {
  if (!file) return null;
  const userId = await getCurrentUserId();
  const path = `${userId || "guest"}/${Date.now()}-${file.name}`;
  return uploadPrivate(BUCKETS.SUPPORT_ATTACHMENTS, path, file);
}

export const supportService = {
  // --- FAQs ---
  async getFAQCategories() {
    return FAQ_CATEGORIES;
  },

  async searchFAQs({ query, category } = {}) {
    let request = supabase.from("faqs").select("*").order("sort_order", { ascending: true });

    if (category && category !== "all") {
      request = request.eq("category", category);
    }

    const { data, error } = await request;
    if (error) throw new Error(error.message);

    let result = (data || []).map(mapFAQ);

    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
      );
    }

    return result;
  },

  // --- Contact support / tickets ---
  async submitContactForm({ name, email, subject, category, message, attachment }) {
    const requesterId = await getCurrentUserId();
    const attachmentPath = await uploadAttachment(attachment);

    const { data: ticketRow, error } = await supabase
      .from("support_tickets")
      .insert({
        ticket_number: generateTicketNumber(),
        requester_id: requesterId,
        requester_name: name,
        requester_email: email,
        subject,
        category,
        priority: "medium",
        status: TICKET_STATUS.OPEN,
        attachment_url: attachmentPath,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { error: messageError } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticketRow.id,
      sender_id: requesterId,
      sender_role: "user",
      text: message,
    });

    if (messageError) throw new Error(messageError.message);

    return this.getTicketById(ticketRow.id);
  },

  async reportProblem({ type, description, priority, device, browser, os, screenshot }) {
    const requesterId = await getCurrentUserId();
    const attachmentPath = await uploadAttachment(screenshot);

    let requesterName = "Guest";
    let requesterEmail = "";

    if (requesterId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email")
        .eq("id", requesterId)
        .single();
      requesterName = profile?.name || requesterName;
      requesterEmail = profile?.email || requesterEmail;
    }

    const { data: ticketRow, error } = await supabase
      .from("support_tickets")
      .insert({
        ticket_number: generateTicketNumber(),
        requester_id: requesterId,
        requester_name: requesterName,
        requester_email: requesterEmail,
        subject: `${type} report`,
        category: "Technical Issues",
        priority: priority || "medium",
        status: TICKET_STATUS.OPEN,
        meta: { type, device, browser, os },
        attachment_url: attachmentPath,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { error: messageError } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticketRow.id,
      sender_id: requesterId,
      sender_role: "user",
      text: description,
    });

    if (messageError) throw new Error(messageError.message);

    return this.getTicketById(ticketRow.id);
  },

  /** Signed-in requester's own tickets. RLS already scopes this to the caller. */
  async getTickets() {
    const { data, error } = await supabase
      .from("support_tickets")
      .select(TICKET_SELECT)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []).map(mapTicket);
  },

  async getTicketById(id) {
    const { data, error } = await supabase
      .from("support_tickets")
      .select(TICKET_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? mapTicket(data) : null;
  },

  async replyToTicket(ticketId, text) {
    const requesterId = await getCurrentUserId();

    const { data: message, error } = await supabase
      .from("support_ticket_messages")
      .insert({
        ticket_id: ticketId,
        sender_id: requesterId,
        sender_role: "user",
        text,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    const { error: statusError } = await supabase
      .from("support_tickets")
      .update({ status: TICKET_STATUS.PENDING })
      .eq("id", ticketId);

    if (statusError) throw new Error(statusError.message);

    return mapMessage(message);
  },

  /** Admin-only (enforced by RLS): resolves a ticket's attachment to a temporary viewable URL. */
  async getAttachmentUrl(path) {
    if (!path) return null;
    return getSignedUrl(BUCKETS.SUPPORT_ATTACHMENTS, path, 3600);
  },

  // --- Guides ---
  async getGuides() {
    const { data, error } = await supabase.from("guides").select("*").order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).map(mapGuide);
  },

  async getGuideById(id) {
    const { data, error } = await supabase.from("guides").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapGuide(data) : null;
  },

  // --- Live chat (support widget) — local simulation, no live-agent backend yet ---
  async getSupportConversation() {
    if (!this._conversation) {
      this._conversation = {
        messages: [
          {
            id: 1,
            sender: "agent",
            text: "Hi! I'm Zanele from OfficeBites support. How can I help today?",
            time: new Date().toISOString(),
          },
        ],
      };
      this._messageSeq = 1;
      this._replyIndex = 0;
    }
    return this._conversation;
  },

  async sendSupportMessage(text) {
    await this.getSupportConversation();
    this._messageSeq += 1;
    const message = { id: this._messageSeq, sender: "user", text, time: new Date().toISOString() };
    this._conversation = { ...this._conversation, messages: [...this._conversation.messages, message] };
    return message;
  },

  async sendSupportAgentReply() {
    const replies = [
      "Thanks for reaching out! Let me take a look into that for you.",
      "Got it — could you share your order or ticket number so I can check?",
      "I've noted that down. Is there anything else I can help with?",
    ];
    await this.getSupportConversation();
    this._messageSeq += 1;
    const reply = {
      id: this._messageSeq,
      sender: "agent",
      text: replies[this._replyIndex % replies.length],
      time: new Date().toISOString(),
    };
    this._replyIndex += 1;
    this._conversation = { ...this._conversation, messages: [...this._conversation.messages, reply] };
    return reply;
  },

  // --- Feedback ---
  async submitFeedback({ rating, comment, recommend }) {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from("feedback")
      .insert({ user_id: userId, rating, comment, recommend })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return {
      id: data.id,
      rating: data.rating,
      comment: data.comment,
      recommend: data.recommend,
      createdAt: data.created_at,
    };
  },
};
