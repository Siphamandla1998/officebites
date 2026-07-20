import { mockResolve } from "./api/mockAdapter";
import { chats } from "../mock/chats";

let chatStore = JSON.parse(JSON.stringify(chats));

export const chatService = {
  async getConversations(userId) {
    return mockResolve(chatStore.filter((c) => c.customerId === userId || c.vendorId === userId));
  },

  async getConversation(id) {
    return mockResolve(chatStore.find((c) => c.id === id) || null);
  },

  async sendMessage(conversationId, { sender, text }) {
    const convo = chatStore.find((c) => c.id === conversationId);
    const message = { id: Date.now(), sender, text, time: new Date().toISOString() };
    if (convo) convo.messages.push(message);
    return mockResolve(message, { delay: 300 });
  },

  async startConversation({ vendorId, vendorName, customerId }) {
    const existing = chatStore.find((c) => c.vendorId === vendorId && c.customerId === customerId);
    if (existing) return mockResolve(existing);
    const convo = { id: `c-${Date.now()}`, vendorId, vendorName, customerId, messages: [] };
    chatStore = [...chatStore, convo];
    return mockResolve(convo, { delay: 250 });
  },
};
