import { mockResolve } from "./api/mockAdapter";
import { chats } from "../mock/chats";

let chatStore = JSON.parse(JSON.stringify(chats));

// Single mock live-support conversation, seeded with a friendly greeting —
// separate from vendor/customer chats since it always has a "support" agent.
let supportConversation = {
  id: "support-live",
  messages: [
    {
      id: 1,
      sender: "agent",
      text: "Hi! I'm Zanele from OfficeBites support. How can I help today?",
      time: new Date(Date.now() - 60000).toISOString(),
    },
  ],
};

const QUICK_REPLIES = [
  "Thanks, that answers it!",
  "I still need help with this.",
  "Can you check my ticket status?",
];

export const chatService = {
  async getConversations(userId) {
    return mockResolve(chatStore.filter((c) => c.customerId === userId || c.vendorId === userId));
  },

  async getConversation(id) {
    return mockResolve(chatStore.find((c) => c.id === id) || null);
  },

  async sendMessage(conversationId, { sender, text }) {
    const convo = chatStore.find((c) => c.id === conversationId);
    const message = { id: Date.now(), sender, text, time: new Date().toISOString(), read: false };
    if (convo) convo.messages.push(message);
    return mockResolve(message, { delay: 300 });
  },

  /** Marks every message not sent by `role` as read (used for unread badges). */
  async markConversationRead(conversationId, role) {
    const convo = chatStore.find((c) => c.id === conversationId);
    if (convo) convo.messages = convo.messages.map((m) => (m.sender !== role ? { ...m, read: true } : m));
    return mockResolve({ success: true }, { delay: 120 });
  },

  async startConversation({ vendorId, vendorName, customerId }) {
    const existing = chatStore.find((c) => c.vendorId === vendorId && c.customerId === customerId);
    if (existing) return mockResolve(existing);
    const convo = { id: `c-${Date.now()}`, vendorId, vendorName, customerId, messages: [] };
    chatStore = [...chatStore, convo];
    return mockResolve(convo, { delay: 250 });
  },

  // --- Live support chat (mock agent) ---
  async getSupportConversation() {
    return mockResolve(supportConversation, { delay: 200 });
  },

  getQuickReplies() {
    return QUICK_REPLIES;
  },

  async sendSupportMessage(text) {
    const message = { id: Date.now(), sender: "user", text, time: new Date().toISOString() };
    supportConversation = { ...supportConversation, messages: [...supportConversation.messages, message] };
    return mockResolve(message, { delay: 250 });
  },

  /** Mock agent auto-reply, simulating a real support agent responding. */
  async sendSupportAgentReply(text = "Got it — let me look into that for you.") {
    const message = { id: Date.now() + 1, sender: "agent", text, time: new Date().toISOString() };
    supportConversation = { ...supportConversation, messages: [...supportConversation.messages, message] };
    return mockResolve(message, { delay: 300 });
  },
};
