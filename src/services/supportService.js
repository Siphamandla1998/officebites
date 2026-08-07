import { TICKET_STATUS } from "../utils/constants";

let ticketStore = [];
let feedbackStore = [];
let ticketSeq = 0;

const FAQ_CATEGORIES = [
  "Orders",
  "Payments",
  "Account",
  "Vendor Support",
  "Technical Issues",
];

const faqs = [];

const guides = [];

function generateTicketNumber() {
  ticketSeq += 1;

  return `SUP-${new Date().getFullYear()}-${String(
    100000 + ticketSeq
  ).padStart(6, "0")}`;
}

export const supportService = {
  // --- FAQs ---
  async getFAQCategories() {
    return FAQ_CATEGORIES;
  },

  async searchFAQs({ query, category } = {}) {
    let result = [...faqs];

    if (category && category !== "all") {
      result = result.filter((f) => f.category === category);
    }

    if (query) {
      const q = query.toLowerCase();

      result = result.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q)
      );
    }

    return result;
  },

  // --- Contact support / tickets ---
  async submitContactForm({
    name,
    email,
    subject,
    category,
    message,
  }) {
    const ticket = {
      id: `t-${Date.now()}`,
      ticketNumber: generateTicketNumber(),
      subject,
      category,
      priority: "medium",
      status: TICKET_STATUS.OPEN,
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: 1,
          sender: "user",
          text: message,
          time: new Date().toISOString(),
        },
      ],
      requester: {
        name,
        email,
      },
    };

    ticketStore = [ticket, ...ticketStore];

    return ticket;
  },


  async reportProblem({
    type,
    description,
    priority,
    device,
    browser,
    os,
  }) {
    const ticket = {
      id: `t-${Date.now()}`,
      ticketNumber: generateTicketNumber(),
      subject: `${type} report`,
      category: "Technical Issues",
      priority: priority || "medium",
      status: TICKET_STATUS.OPEN,
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: 1,
          sender: "user",
          text: description,
          time: new Date().toISOString(),
        },
      ],
      meta: {
        type,
        device,
        browser,
        os,
      },
    };

    ticketStore = [ticket, ...ticketStore];

    return ticket;
  },


  async getTickets() {
    return ticketStore;
  },


  async getTicketById(id) {
    return ticketStore.find((t) => t.id === id) || null;
  },


  async replyToTicket(ticketId, text) {
    const message = {
      id: Date.now(),
      sender: "user",
      text,
      time: new Date().toISOString(),
    };

    ticketStore = ticketStore.map((t) =>
      t.id === ticketId
        ? {
            ...t,
            status: TICKET_STATUS.PENDING,
            messages: [...t.messages, message],
          }
        : t
    );

    return message;
  },


  // --- Guides ---
  async getGuides() {
    return guides;
  },


  async getGuideById(id) {
    return guides.find((g) => g.id === id) || null;
  },


  // --- Feedback ---
  async submitFeedback({
    rating,
    comment,
    recommend,
  }) {
    const entry = {
      id: `fb-${Date.now()}`,
      rating,
      comment,
      recommend,
      createdAt: new Date().toISOString(),
    };

    feedbackStore = [...feedbackStore, entry];

    return entry;
  },
};
