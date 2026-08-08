import { useState, useRef, useEffect } from "react";
import {
  FiMessageCircle,
  FiSend,
} from "react-icons/fi";

import { useAsync } from "../../hooks/useAsync";
import { chatService } from "../../services/chatService";
import { useAuth } from "../../context/AuthContext";
import SearchBar from "../../components/ui/SearchBar";
import EmptyState from "../../components/ui/EmptyState";
import { formatTime } from "../../utils/formatters";

export default function VendorChat() {
  const { user } = useAuth();

  const {
    data: conversations,
    loading,
    refetch,
  } = useAsync(
    () => chatService.getConversations(),
    [user?.id, user?.vendorId]
  );

  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages.length]);

  const openConvo = async (id) => {
    try {
      setActiveId(id);

      const conversation =
        await chatService.getConversation(id);

      if (!conversation) {
        setMessages([]);
        return;
      }

      setMessages(conversation.messages);

      await chatService.markConversationRead(id);

      await refetch();
    } catch (error) {
      console.error(
        "Failed to open conversation:",
        error
      );
    }
  };

  const send = async () => {
    const messageText = text.trim();

    if (
      !messageText ||
      !activeId ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);

      await chatService.sendMessage(
        activeId,
        messageText
      );

      setText("");

      const conversation =
        await chatService.getConversation(
          activeId
        );

      setMessages(
        conversation?.messages || []
      );

      await refetch();
    } catch (error) {
      console.error(
        "Failed to send message:",
        error
      );
    } finally {
      setSending(false);
    }
  };

  const filteredConversations =
    (conversations || []).filter((conversation) => {
      if (!query.trim()) {
        return true;
      }

      const q = query.toLowerCase();

      return conversation.messages.some(
        (message) =>
          message.text
            .toLowerCase()
            .includes(q)
      );
    });

  const unreadCount = (conversation) =>
    conversation.messages.filter(
      (message) =>
        message.senderId !== user?.id &&
        !message.read
    ).length;

  if (loading) {
    return (
      <div className="p-6">
        Loading messages...
      </div>
    );
  }

  if (!conversations?.length) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<FiMessageCircle />}
          title="No conversations yet"
          description="Customer messages will appear here."
        />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex overflow-hidden">
      {/* Conversation list */}

      <aside className="w-80 border-r border-nude-200 bg-paper flex flex-col">
        <div className="p-4 border-b border-nude-200">
          <h1 className="font-semibold mb-3">
            Customer messages
          </h1>

          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search messages..."
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map(
            (conversation) => {
              const unread =
                unreadCount(conversation);

              const last =
                conversation.messages[
                  conversation.messages.length - 1
                ];

              return (
                <button
                  key={conversation.id}
                  onClick={() =>
                    openConvo(
                      conversation.id
                    )
                  }
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-nude-50 ${
                    activeId ===
                    conversation.id
                      ? "bg-nude-50"
                      : ""
                  }`}
                >
                  <div className="h-10 w-10 rounded-full bg-nude-100 flex items-center justify-center">
                    <FiMessageCircle />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      Customer
                    </div>

                    <div className="text-xs text-ink-muted truncate">
                      {last?.text ||
                        "No messages"}
                    </div>
                  </div>

                  {unread > 0 && (
                    <span className="min-w-5 h-5 rounded-full bg-ink text-paper text-xs flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>
      </aside>

      {/* Active conversation */}

      <section className="flex-1 flex flex-col bg-paper">
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center text-ink-muted">
            Select a conversation
          </div>
        ) : (
          <>
            <div className="border-b border-nude-200 px-5 py-4">
              <h2 className="font-semibold">
                Customer
              </h2>

              <p className="text-xs text-ink-muted">
                OfficeBites customer
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-sm text-ink-muted py-10">
                  No messages yet.
                </div>
              ) : (
                messages.map((message) => {
                  const mine =
                    message.senderId ===
                    user?.id;

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
                        className={`max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm ${
                          mine
                            ? "bg-ink text-paper rounded-br-sm"
                            : "bg-nude-100 text-ink rounded-bl-sm"
                        }`}
                      >
                        <div>
                          {message.text}
                        </div>

                        <p
                          className={`text-[10px] mt-1 ${
                            mine
                              ? "text-paper/50"
                              : "text-ink-muted"
                          }`}
                        >
                          {formatTime(
                            message.time
                          )}
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
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Reply to customer..."
                  className="input flex-1"
                  disabled={sending}
                />

                <button
                  onClick={send}
                  disabled={
                    !text.trim() || sending
                  }
                  className="btn-primary flex items-center gap-2"
                >
                  <FiSend />

                  {sending
                    ? "Sending..."
                    : "Send"}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
