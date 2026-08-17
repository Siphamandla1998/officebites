import { useState, useRef, useEffect } from "react";
import {
  FiArrowLeft,
  FiMessageCircle,
  FiSend,
  FiSearch,
} from "react-icons/fi";

import { useAsync } from "../../hooks/useAsync";
import { chatService } from "../../services/chatService";
import { useAuth } from "../../context/AuthContext";
import EmptyState from "../../components/ui/EmptyState";
import { formatTime } from "../../utils/formatters";

export default function VendorChat() {
  const { user } = useAuth();

  const {
    data: conversations = [],
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

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeId
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages.length]);

  const openConversation = async (id) => {
    try {
      setActiveId(id);

      const conversation =
        await chatService.getConversation(id);

      if (!conversation) {
        setMessages([]);
        return;
      }

      setMessages(conversation.messages || []);

      await chatService.markConversationRead(id);

      await refetch();
    } catch (error) {
      console.error(
        "Unable to open conversation:",
        error
      );
    }
  };

  const closeConversation = () => {
    setActiveId(null);
    setMessages([]);
    setText("");
  };

  const send = async () => {
    const message = text.trim();

    if (!message || !activeId || sending) {
      return;
    }

    try {
      setSending(true);

      await chatService.sendMessage(
        activeId,
        message
      );

      setText("");

      const updated =
        await chatService.getConversation(
          activeId
        );

      setMessages(updated?.messages || []);

      await refetch();
    } catch (error) {
      console.error(
        "Unable to send message:",
        error
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      send();
    }
  };

  const filteredConversations =
    conversations.filter((conversation) => {
      if (!query.trim()) {
        return true;
      }

      const search = query
        .trim()
        .toLowerCase();

      return conversation.messages?.some(
        (message) =>
          message.text
            ?.toLowerCase()
            .includes(search)
      );
    });

  const getUnreadCount = (conversation) => {
    return (conversation.messages || []).filter(
      (message) =>
        message.senderId !== user?.id &&
        !message.read
    ).length;
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-7 w-40 rounded bg-nude-100" />
          <div className="h-12 rounded-xl bg-nude-100" />
          <div className="h-16 rounded-xl bg-nude-100" />
          <div className="h-16 rounded-xl bg-nude-100" />
        </div>
      </div>
    );
  }

  /*
   * MOBILE:
   * When a conversation is active, show only the conversation.
   *
   * DESKTOP:
   * Keep the conversation list and active conversation side-by-side.
   */

  return (
    <div className="h-[calc(100dvh-80px)] md:h-[calc(100vh-120px)] flex overflow-hidden bg-paper">
      {/* ================================
          CONVERSATION LIST
      ================================= */}

      <aside
        className={`
          w-full md:w-[340px] lg:w-[380px]
          shrink-0
          border-r border-nude-200
          bg-paper
          flex flex-col
          ${
            activeId
              ? "hidden md:flex"
              : "flex"
          }
        `}
      >
        {/* Header */}

        <div className="px-4 pt-5 pb-4 border-b border-nude-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-11 w-11 rounded-full bg-nude-100 flex items-center justify-center">
              <FiMessageCircle
                size={20}
              />
            </div>

            <div>
              <h1 className="text-lg font-semibold text-ink">
                Messages
              </h1>

              <p className="text-xs text-ink-muted">
                Customer conversations
              </p>
            </div>
          </div>

          {/* Search */}

          <div className="relative">
            <FiSearch
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search messages..."
              className="input w-full pl-9"
            />
          </div>
        </div>

        {/* Conversation list */}

        <div className="flex-1 overflow-y-auto">
          {!filteredConversations.length ? (
            <div className="p-6">
              <EmptyState
                icon={<FiMessageCircle />}
                title="No conversations found"
                description={
                  query
                    ? "Try a different search."
                    : "Customer messages will appear here."
                }
              />
            </div>
          ) : (
            filteredConversations.map(
              (conversation) => {
                const unread =
                  getUnreadCount(
                    conversation
                  );

                const lastMessage =
                  conversation.messages?.[
                    conversation.messages
                      .length - 1
                  ];

                return (
                  <button
                    key={conversation.id}
                    onClick={() =>
                      openConversation(
                        conversation.id
                      )
                    }
                    className="
                      w-full
                      flex
                      items-center
                      gap-3
                      px-4
                      py-4
                      text-left
                      border-b
                      border-nude-100
                      hover:bg-nude-50
                      active:bg-nude-100
                      transition
                    "
                  >
                    {/* Avatar */}

                    <div className="h-11 w-11 shrink-0 rounded-full bg-ink text-paper flex items-center justify-center">
                      <FiMessageCircle
                        size={18}
                      />
                    </div>

                    {/* Content */}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-ink">
                          Customer
                        </span>

                        {lastMessage && (
                          <span className="text-[10px] text-ink-muted shrink-0">
                            {formatTime(
                              lastMessage.time
                            )}
                          </span>
                        )}
                      </div>

                      <p
                        className={`text-xs truncate mt-1 ${
                          unread > 0
                            ? "font-medium text-ink"
                            : "text-ink-muted"
                        }`}
                      >
                        {lastMessage?.text ||
                          "Start a conversation"}
                      </p>
                    </div>

                    {/* Unread */}

                    {unread > 0 && (
                      <span className="h-5 min-w-5 px-1.5 rounded-full bg-ink text-paper text-[10px] flex items-center justify-center shrink-0">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              }
            )
          )}
        </div>
      </aside>

      {/* ================================
          CHAT WINDOW
      ================================= */}

      <section
        className={`
          flex-1
          min-w-0
          flex-col
          bg-paper
          ${
            activeId
              ? "flex"
              : "hidden md:flex"
          }
        `}
      >
        {!activeId ? (
          /* Desktop empty state */

          <div className="flex-1 hidden md:flex items-center justify-center">
            <div className="text-center max-w-sm px-6">
              <div className="mx-auto h-16 w-16 rounded-full bg-nude-100 flex items-center justify-center mb-4">
                <FiMessageCircle
                  size={28}
                />
              </div>

              <h2 className="font-semibold text-lg text-ink">
                Your messages
              </h2>

              <p className="text-sm text-ink-muted mt-2">
                Select a customer conversation
                to read and reply to messages.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}

            <header className="h-[68px] shrink-0 border-b border-nude-200 px-3 md:px-5 flex items-center gap-3">
              {/* Mobile back */}

              <button
                onClick={closeConversation}
                className="md:hidden btn-icon"
                aria-label="Back to conversations"
              >
                <FiArrowLeft />
              </button>

              {/* Avatar */}

              <div className="h-10 w-10 rounded-full bg-ink text-paper flex items-center justify-center shrink-0">
                <FiMessageCircle
                  size={17}
                />
              </div>

              <div className="min-w-0">
                <h2 className="font-semibold text-sm">
                  Customer
                </h2>

                <p className="text-xs text-ink-muted truncate">
                  OfficeBites customer
                </p>
              </div>
            </header>

            {/* Messages */}

            <div className="flex-1 overflow-y-auto px-3 md:px-5 py-5 space-y-3">
              {!messages.length ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-sm text-ink-muted">
                    <FiMessageCircle
                      size={28}
                      className="mx-auto mb-3"
                    />

                    <p>No messages yet.</p>

                    <p className="text-xs mt-1">
                      Send the first message.
                    </p>
                  </div>
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
                        className={`
                          max-w-[82%]
                          sm:max-w-[70%]
                          rounded-2xl
                          px-3.5
                          py-2.5
                          text-sm
                          break-words
                          ${
                            mine
                              ? "bg-ink text-paper rounded-br-sm"
                              : "bg-nude-100 text-ink rounded-bl-sm"
                          }
                        `}
                      >
                        <p className="whitespace-pre-wrap">
                          {message.text}
                        </p>

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

            {/* Composer */}

            <div className="shrink-0 border-t border-nude-200 bg-paper p-3 md:p-4">
              <div className="flex items-end gap-2">
                <textarea
                  value={text}
                  onChange={(event) =>
                    setText(event.target.value)
                  }
                  onKeyDown={handleKeyDown}
                  placeholder="Write a message..."
                  rows={1}
                  disabled={sending}
                  className="
                    input
                    flex-1
                    resize-none
                    min-h-[44px]
                    max-h-28
                    py-3
                  "
                />

                <button
                  onClick={send}
                  disabled={
                    !text.trim() ||
                    sending
                  }
                  className="
                    h-11
                    w-11
                    shrink-0
                    rounded-xl
                    bg-ink
                    text-paper
                    flex
                    items-center
                    justify-center
                    disabled:opacity-40
                    disabled:cursor-not-allowed
                  "
                  aria-label="Send message"
                >
                  <FiSend size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
