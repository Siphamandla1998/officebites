import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { FiSend } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import { useAsync } from "../../hooks/useAsync";
import { chatService } from "../../services/chatService";
import { useAuth } from "../../context/AuthContext";
import { ROLES } from "../../utils/constants";
import { formatTime } from "../../utils/formatters";

export default function ChatConversation() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: conversation, setData } = useAsync(() => chatService.getConversation(id), [id]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const myRole = user?.role === ROLES.VENDOR ? "vendor" : "customer";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages?.length]);

  const send = async () => {
    if (!text.trim()) return;
    const message = await chatService.sendMessage(id, { sender: myRole, text });
    setData((prev) => ({ ...prev, messages: [...prev.messages, message] }));
    setText("");
  };

  if (!conversation) {
    return (
      <div>
        <Navbar showBack showCart={false} />
        <div className="ob-container pt-4"><div className="skeleton h-40" /></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar showBack title={conversation.vendorName} showCart={false} />
      <div className="flex-1 overflow-y-auto ob-container py-4 flex flex-col gap-2.5">
        {conversation.messages.map((m) => {
          const mine = m.sender === myRole;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                  mine ? "bg-ink text-paper rounded-br-sm" : "bg-nude-100 text-ink rounded-bl-sm"
                }`}
              >
                {m.text}
                <p className={`text-[10px] mt-1 ${mine ? "text-paper/50" : "text-ink-muted"}`}>
                  {formatTime(m.time)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="ob-container pb-4 pt-2 flex items-center gap-2 border-t border-line">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Type a message..."
          className="input flex-1"
        />
        <button onClick={send} className="btn-icon !bg-ink !text-paper !border-ink">
          <FiSend size={15} />
        </button>
      </div>
    </div>
  );
}
