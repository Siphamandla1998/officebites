import { mockResolve } from "./api/mockAdapter";
import { TICKET_STATUS } from "../utils/constants";

let ticketStore = [...initialTickets];
let feedbackStore = [];
let ticketSeq = ticketStore.length;

function generateTicketNumber() {
  ticketSeq += 1;
  return `SUP-${new Date().getFullYear()}-${String(100000 + ticketSeq).padStart(6, "0")}`;
}

export const supportService = {
  // --- FAQs ---
  async getFAQCategories() {
    return mockResolve(FAQ_CATEGORIES, { delay: 150 });
  },

  async searchFAQs({ query, category } = {}) {
    let result = [...faqs];
    if (category && category !== "all") result = result.filter((f) => f.category === category);
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
      );
    }
    return mockResolve(result, { delay: 200 });
  },

  // --- Contact support / tickets ---
  async submitContactForm({ name, email, subject, category, message }) {
    const ticket = {
      id: `t-${Date.now()}`,
      ticketNumber: generateTicketNumber(),
      subject,
      category,
      priority: "medium",
      status: TICKET_STATUS.OPEN,
      createdAt: new Date().toISOString(),
      messages: [{ id: 1, sender: "user", text: message, time: new Date().toISOString() }],
      requester: { name, email },
    };
    ticketStore = [ticket, ...ticketStore];
    return mockResolve(ticket, { delay: 500 });
  },

  async reportProblem({ type, description, priority, device, browser, os }) {
    const ticket = {
      id: `t-${Date.now()}`,
      ticketNumber: generateTicketNumber(),
      subject: `${type} report`,
      category: "Technical Issues",
      priority: priority || "medium",
      status: TICKET_STATUS.OPEN,
      createdAt: new Date().toISOString(),
      messages: [{ id: 1, sender: "user", text: description, time: new Date().toISOString() }],
      meta: { type, device, browser, os },
    };
    ticketStore = [ticket, ...ticketStore];
    return mockResolve(ticket, { delay: 500 });
  },

  async getTickets() {
    return mockResolve(ticketStore);
  },

  async getTicketById(id) {
    return mockResolve(ticketStore.find((t) => t.id === id) || null);
  },

  async replyToTicket(ticketId, text) {
    const message = { id: Date.now(), sender: "user", text, time: new Date().toISOString() };
    ticketStore = ticketStore.map((t) =>
      t.id === ticketId
        ? { ...t, status: TICKET_STATUS.PENDING, messages: [...t.messages, message] }
        : t
    );
    return mockResolve(message, { delay: 300 });
  },

  // --- Guides ---
  async getGuides() {
    return mockResolve(guides, { delay: 150 });
  },

  async getGuideById(id) {
    return mockResolve(guides.find((g) => g.id === id) || null);
  },

  // --- Feedback ---
  async submitFeedback({ rating, comment, recommend }) {
    const entry = { id: `fb-${Date.now()}`, rating, comment, recommend, createdAt: new Date().toISOString() };
    feedbackStore = [...feedbackStore, entry];
    return mockResolve(entry, { delay: 400 });
  },
};
