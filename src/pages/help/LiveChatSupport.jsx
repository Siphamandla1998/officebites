import { useState, useEffect, useRef } from "react";
import { FiSend } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import Avatar from "../../components/ui/Avatar";
import { chatService } from "../../services/chatService";
import { supportService } from "../../services/supportService";
import { formatTime } from "../../utils/formatters";

export default function LiveChatSupport() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    supportService.getSupportConversation().then((convo) => setMessages(convo.messages));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typing]);

  const send = async (overrideText) => {
    const value = overrideText ?? text;
    if (!value.trim()) return;
    const message = await supportService.sendSupportMessage(value);
    setMessages((prev) => [...prev, { ...message, status: "sent" }]);
    setText("");

    setTyping(true);
    const reply = await supportService.sendSupportAgentReply();
    setTyping(false);
    setMessages((prev) => [...prev, reply]);
  };

  return (
    <div className="flex flex-col h-screen">
      <Navbar showBack title="Live Chat" showCart={false} />
      <div className="ob-container flex items-center gap-2.5 py-3 border-b border-line">
        <Avatar name="Zanele" size={36} />
        <div>
          <p className="text-sm font-semibold text-ink">Zanele · OfficeBites Support</p>
          <p className="text-xs text-success flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Online now
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto ob-container py-4 flex flex-col gap-2.5">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                m.sender === "user" ? "bg-ink text-paper rounded-br-sm" : "bg-nude-100 text-ink rounded-bl-sm"
              }`}
            >
              {m.text}
              <p className={`text-[10px] mt-1 flex items-center gap-1 ${m.sender === "user" ? "text-paper/50 justify-end" : "text-ink-muted"}`}>
                {formatTime(m.time)}
                {m.sender === "user" && m.status === "sent" && <span>· Sent</span>}
              </p>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-nude-100 text-ink-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs italic">
              Zanele is typing…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="ob-container pb-2 flex gap-2 overflow-x-auto no-scrollbar">
        {chatService.getQuickReplies().map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            className="shrink-0 rounded-full border border-line px-3.5 py-1.5 text-xs text-ink-soft hover:border-nude-400"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="ob-container pb-4 pt-2 flex items-center gap-2 border-t border-line">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
          className="input flex-1"
          aria-label="Type a message to support"
        />
        <button onClick={() => send()} className="btn-icon !bg-ink !text-paper !border-ink" aria-label="Send message">
          <FiSend size={15} />
        </button>
      </div>
    </div>
  );
}
