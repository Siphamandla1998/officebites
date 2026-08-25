import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiSend, FiArrowLeft } from "react-icons/fi";

import Navbar from "../../components/layout/Navbar";
import { useAsync } from "../../hooks/useAsync";
import { chatService } from "../../services/chatService";
import { useAuth } from "../../context/AuthContext";
import { formatTime } from "../../utils/formatters";

export default function ChatConversation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    data: conversation,
    loading,
    refetch,
  } = useAsync(
    () => chatService.getConversation(id),
    [id]
  );

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    if (!conversation) return;

    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });

    chatService.markConversationRead(id).catch(() => {});
  }, [conversation, id]);

  const send = async () => {
    const messageText = text.trim();

    if (!messageText || sending) {
      return;
    }

    try {
      setSending(true);

      await chatService.sendMessage(
        id,
        messageText
      );

      setText("");

      await refetch();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />

        <div className="max-w-3xl mx-auto px-4 py-10">
          Loading conversation...
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-paper">
        <Navbar />

        <div className="max-w-3xl mx-auto px-4 py-10">
          <button
            onClick={() => navigate("/chat")}
            className="flex items-center gap-2 text-sm mb-6"
          >
            <FiArrowLeft />
            Back to messages
          </button>

          <div className="card p-6">
            Conversation not found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto flex flex-col">
        <div className="border-b border-nude-200 px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate("/chat")}
            className="btn-icon"
            aria-label="Back to messages"
          >
            <FiArrowLeft />
          </button>

          <div>
            <h1 className="font-semibold">
              {user?.id === conversation.customerId
                ? conversation.vendorName
                : conversation.customerName}
            </h1>

            <p className="text-xs text-ink-muted">
              OfficeBites messages
            </p>
          </div>
        </div>

        <div className="flex-1 px-4 py-6 space-y-3 overflow-y-auto">
          {conversation.messages.length === 0 ? (
            <div className="text-center text-sm text-ink-muted py-10">
              No messages yet. Start the conversation.
            </div>
          ) : (
            conversation.messages.map((message) => {
              const mine =
                message.senderId === user?.id;

              return (
                <div
                  key={message.id}
                  className={`flex ${
                    mine
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      mine
                        ? "bg-ink text-paper rounded-br-sm"
                        : "bg-nude-100 text-ink rounded-bl-sm"
                    }`}
                  >
                    <div>{message.text}</div>

                    <p
                      className={`text-[10px] mt-1 ${
                        mine
                          ? "text-paper/50"
                          : "text-ink-muted"
                      }`}
                    >
                      {formatTime(message.time)}
                    </p>
                  </div>
                </div>
              );
            })
          )}

          <div ref={bottomRef} />
        </div>

        <div className="border-t border-nude-200 p-4">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(event) =>
                setText(event.target.value)
              }
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="input flex-1"
              disabled={sending}
            />

            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="btn-primary flex items-center gap-2"
            >
              <FiSend />

              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
