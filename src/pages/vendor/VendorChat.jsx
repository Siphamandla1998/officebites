import { useState, useRef, useEffect } from "react";
import { FiMessageCircle, FiSend } from "react-icons/fi";
import { useAsync } from "../../hooks/useAsync";
import { chatService } from "../../services/chatService";
import { useAuth } from "../../context/AuthContext";
import SearchBar from "../../components/ui/SearchBar";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import { formatTime } from "../../utils/formatters";

export default function VendorChat() {
  const { user } = useAuth();
  const { data: conversations, loading, refetch } = useAsync(
    () => chatService.getConversations(user.vendorId),
    [user.vendorId]
  );
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typing]);

  const openConvo = async (id) => {
    setActiveId(id);
    const convo = await chatService.getConversation(id);
    setMessages(convo.messages);
    await chatService.markConversationRead(id, "vendor");
    refetch();
  };

  const send = async () => {
    if (!text.trim() || !activeId) return;
    const message = await chatService.sendMessage(activeId, { sender: "vendor", text });
    setMessages((prev) => [...prev, message]);
    setText("");
    refetch();

    // Mock "customer is typing" + auto-reply, purely for demo purposes —
    // a real backend would push this over a socket instead.
    setTyping(true);
    setTimeout(async () => {
      setTyping(false);
      const reply = await chatService.sendMessage(activeId, {
        sender: "customer",
        text: "Thanks, noted! 🙏",
      });
      setMessages((prev) => [...prev, reply]);
      refetch();
    }, 1600);
  };

  const filteredConversations = (conversations || []).filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.messages.some((m) => m.text.toLowerCase().includes(q));
  });

  const unreadCount = (c) => c.messages.filter((m) => m.sender === "customer" && !m.read).length;

  if (loading) return <div className="skeleton h-96" />;

  if (!conversations?.length) {
    return (
      <div>
        <h1 className="text-xl font-bold text-ink mb-5">Customer messages</h1>
        <EmptyState icon={<FiMessageCircle size={20} />} title="No conversations yet" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-ink mb-5">Customer messages</h1>
      <div className="card overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr] h-[560px]">
        <div className="border-b md:border-b-0 md:border-r border-line flex flex-col">
          <div className="p-3 border-b border-line">
            <SearchBar value={query} onChange={setQuery} placeholder="Search conversations..." />
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredConversations.map((c) => {
              const unread = unreadCount(c);
              return (
                <button
                  key={c.id}
                  onClick={() => openConvo(c.id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-nude-50 ${
                    activeId === c.id ? "bg-nude-50" : ""
                  }`}
                >
                  <Avatar name="Customer" size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">Customer</p>
                    <p className="text-xs text-ink-muted truncate">
                      {c.messages[c.messages.length - 1]?.text || "No messages"}
                    </p>
                  </div>
                  {unread > 0 && (
                    <span className="h-5 min-w-[20px] px-1 rounded-full bg-nude-500 text-[10px] text-paper flex items-center justify-center font-semibold shrink-0">
                      {unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col">
          {!activeId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-ink-muted">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === "vendor" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        m.sender === "vendor"
                          ? "bg-ink text-paper rounded-br-sm"
                          : "bg-nude-100 text-ink rounded-bl-sm"
                      }`}
                    >
                      {m.text}
                      <p className={`text-[10px] mt-1 ${m.sender === "vendor" ? "text-paper/50" : "text-ink-muted"}`}>
                        {formatTime(m.time)}
                      </p>
                    </div>
                  </div>
                ))}
                {typing && (
                  <div className="flex justify-start">
                    <div className="bg-nude-100 text-ink-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs italic">
                      Customer is typing…
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="p-3 border-t border-line flex items-center gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Reply to customer..."
                  className="input flex-1"
                  aria-label="Reply to customer"
                />
                <button onClick={send} className="btn-icon !bg-ink !text-paper !border-ink" aria-label="Send message">
                  <FiSend size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
