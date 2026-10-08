import { useState } from "react";
import {
  FiMessageCircle,
  FiTrash2,
  FiShoppingBag,
  FiClock,
} from "react-icons/fi";

import EmptyState from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import { useAsync } from "../../hooks/useAsync";
import { chatService } from "../../services/chatService";
import { useToast } from "../../context/ToastContext";
import {
  formatRelativeTime,
  formatDate,
} from "../../utils/formatters";

function lastActivity(conversation) {
  const messages = conversation.messages || [];
  const last = messages[messages.length - 1];

  return (
    last?.time ||
    conversation.updatedAt ||
    conversation.createdAt
  );
}

function shortOrderId(orderId) {
  if (!orderId) return null;

  return orderId.slice(0, 8).toUpperCase();
}

export default function AdminChats() {
  const { showToast } = useToast();

  const {
    data: conversations = [],
    loading,
    refetch,
  } = useAsync(
    () => chatService.getAllConversationsForAdmin(),
    []
  );

  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] =
    useState(null);

  const handleDelete = async (conversation) => {
    setDeleting(true);

    try {
      await chatService.deleteConversation(
        conversation.id
      );

      showToast("Conversation deleted", {
        type: "success",
      });

      setConfirmDelete(null);
      setSelected(null);

      await refetch();
    } catch (err) {
      showToast(
        err.message ||
          "Couldn't delete this conversation",
        {
          type: "error",
        }
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}

      <div>
        <h1 className="text-xl font-bold text-ink">
          Chats
        </h1>

        <p className="text-sm text-ink-muted mt-1">
          Review order-linked customer and vendor
          conversations for support, disputes and
          marketplace safety.
        </p>
      </div>

      {/* Conversation list */}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-20"
            />
          ))}
        </div>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={<FiMessageCircle size={20} />}
          title="No conversations yet"
          description="Order-linked customer and vendor conversations will appear here."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {conversations.map((conversation) => {
            const activity =
              lastActivity(conversation);

            const messageCount =
              conversation.messages?.length || 0;

            return (
              <button
                key={conversation.id}
                onClick={() =>
                  setSelected(conversation)
                }
                className="
                  card
                  p-4
                  text-left
                  flex
                  items-start
                  justify-between
                  gap-3
                  hover:bg-nude-50
                  transition
                "
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink truncate">
                    {conversation.customerName}

                    <span className="text-ink-muted font-normal mx-1">
                      ↔
                    </span>

                    {conversation.vendorName}
                  </p>

                  <p className="text-xs text-ink-muted mt-0.5 truncate">
                    {messageCount}{" "}
                    {messageCount === 1
                      ? "message"
                      : "messages"}
                    {activity && (
                      <>
                        {" "}
                        · last active{" "}
                        {formatRelativeTime(activity)}
                      </>
                    )}
                  </p>

                  {conversation.orderId && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <FiShoppingBag
                        size={11}
                        className="text-ink-muted"
                      />

                      <p className="text-[11px] text-ink-muted">
                        Order{" "}
                        {shortOrderId(
                          conversation.orderId
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {conversation.closedAt ? (
                  <span className="shrink-0 text-[10px] font-medium text-ink-muted bg-nude-100 rounded-full px-2 py-1">
                    Closed
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] font-medium text-success bg-nude-50 rounded-full px-2 py-1">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Conversation viewer */}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Conversation"
      >
        {selected && (
          <div className="flex flex-col gap-4">
            {/* Conversation metadata */}

            <div>
              <p className="text-sm font-semibold text-ink">
                {selected.customerName}

                <span className="text-ink-muted font-normal mx-1">
                  ↔
                </span>

                {selected.vendorName}
              </p>

              <p className="text-xs text-ink-muted mt-1">
                Started{" "}
                {formatDate(selected.createdAt)}

                {lastActivity(selected) && (
                  <>
                    {" "}
                    · last active{" "}
                    {formatRelativeTime(
                      lastActivity(selected)
                    )}
                  </>
                )}
              </p>

              {selected.orderId && (
                <div className="flex items-center gap-1.5 mt-2">
                  <FiShoppingBag
                    size={12}
                    className="text-ink-muted"
                  />

                  <p className="text-xs text-ink-muted">
                    Linked order:{" "}
                    {shortOrderId(
                      selected.orderId
                    )}
                  </p>
                </div>
              )}

              {selected.closedAt && (
                <div className="flex items-center gap-1.5 mt-1">
                  <FiClock
                    size={12}
                    className="text-ink-muted"
                  />

                  <p className="text-xs text-ink-muted">
                    Conversation closed{" "}
                    {formatRelativeTime(
                      selected.closedAt
                    )}
                  </p>
                </div>
              )}

              {selected.retainUntil && (
                <p className="text-xs text-ink-muted mt-1">
                  Support retention until{" "}
                  {formatDate(
                    selected.retainUntil
                  )}
                </p>
              )}
            </div>

            {/* Messages */}

            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {!selected.messages?.length ? (
                <p className="text-sm text-ink-muted">
                  No messages in this conversation.
                </p>
              ) : (
                selected.messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded-xl bg-nude-50 px-3.5 py-2.5"
                  >
                    <p className="text-sm text-ink whitespace-pre-wrap break-words">
                      {message.text}
                    </p>

                    <p className="text-[10px] text-ink-muted mt-1">
                      {formatRelativeTime(
                        message.time
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Admin deletion */}

            <div className="border-t border-line pt-4">
              <p className="text-[11px] text-ink-muted mb-3">
                Normal chat retention is handled
                automatically. Manual deletion should
                only be used when a conversation needs
                to be removed for moderation, privacy
                or administrative reasons.
              </p>

              <button
                onClick={() =>
                  setConfirmDelete(selected)
                }
                className="btn-secondary w-full flex items-center justify-center gap-2 !text-danger"
              >
                <FiTrash2 size={14} />
                Delete conversation
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation */}

      <Modal
        open={!!confirmDelete}
        onClose={() =>
          !deleting && setConfirmDelete(null)
        }
        title="Delete this conversation?"
      >
        {confirmDelete && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              This permanently deletes the
              conversation between{" "}
              <strong className="text-ink">
                {confirmDelete.customerName}
              </strong>{" "}
              and{" "}
              <strong className="text-ink">
                {confirmDelete.vendorName}
              </strong>
              , including all{" "}
              {confirmDelete.messages?.length || 0}{" "}
              message(s). This can't be undone.
            </p>

            {confirmDelete.orderId && (
              <div className="rounded-xl bg-nude-50 p-3">
                <p className="text-xs text-ink-muted">
                  Linked OfficeBites order
                </p>

                <p className="text-sm font-semibold text-ink mt-0.5">
                  {shortOrderId(
                    confirmDelete.orderId
                  )}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setConfirmDelete(null)
                }
                disabled={deleting}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  handleDelete(confirmDelete)
                }
                disabled={deleting}
                className="btn-primary flex-1 !bg-danger"
              >
                {deleting
                  ? "Deleting..."
                  : "Delete permanently"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}