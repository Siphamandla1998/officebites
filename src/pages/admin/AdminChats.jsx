import { useState } from "react";
import { FiMessageCircle, FiTrash2 } from "react-icons/fi";
import EmptyState from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import { useAsync } from "../../hooks/useAsync";
import { chatService } from "../../services/chatService";
import { useToast } from "../../context/ToastContext";
import { formatRelativeTime, formatDate } from "../../utils/formatters";

const RETENTION_DAYS = 5;

function lastActivity(conversation) {
  const last = conversation.messages[conversation.messages.length - 1];
  return last ? last.time : conversation.updatedAt;
}

function daysSince(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
}

export default function AdminChats() {
  const { showToast } = useToast();
  const { data: conversations, loading, refetch } = useAsync(
    () => chatService.getAllConversationsForAdmin(),
    []
  );
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleDelete = async (conversation) => {
    setDeleting(true);
    try {
      await chatService.deleteConversation(conversation.id);
      showToast("Conversation erased", { type: "success" });
      setConfirmDelete(null);
      setSelected(null);
      refetch();
    } catch (err) {
      showToast(err.message || "Couldn't erase this conversation", { type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Chats</h1>
        <p className="text-sm text-ink-muted mt-1">
          Monitor customer-vendor conversations. Conversations can be erased once their last
          message is {RETENTION_DAYS}+ days old.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20" />)}
        </div>
      ) : !conversations || conversations.length === 0 ? (
        <EmptyState
          icon={<FiMessageCircle size={20} />}
          title="No conversations yet"
          description="Customer-vendor chats will show up here once someone starts one."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {conversations.map((c) => {
            const eligible = daysSince(lastActivity(c)) >= RETENTION_DAYS;
            return (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className="card p-4 text-left flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">
                    {c.customerName} <span className="text-ink-muted font-normal">↔</span> {c.vendorName}
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5 truncate">
                    {c.messages.length} message{c.messages.length === 1 ? "" : "s"} · last active{" "}
                    {formatRelativeTime(lastActivity(c))}
                  </p>
                </div>
                {eligible && (
                  <span className="shrink-0 text-[10px] font-medium text-nude-700 bg-nude-100 rounded-full px-2 py-1">
                    Eligible for erasure
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Conversation">
        {selected && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-ink">
                {selected.customerName} ↔ {selected.vendorName}
              </p>
              <p className="text-xs text-ink-muted">
                Started {formatDate(selected.createdAt)} · last active {formatRelativeTime(lastActivity(selected))}
              </p>
            </div>

            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {selected.messages.length === 0 ? (
                <p className="text-sm text-ink-muted">No messages in this conversation.</p>
              ) : (
                selected.messages.map((m) => (
                  <div key={m.id} className="rounded-xl bg-nude-50 px-3.5 py-2.5">
                    <p className="text-sm text-ink">{m.text}</p>
                    <p className="text-[10px] text-ink-muted mt-1">{formatRelativeTime(m.time)}</p>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setConfirmDelete(selected)}
              disabled={daysSince(lastActivity(selected)) < RETENTION_DAYS}
              className="btn-secondary w-full flex items-center justify-center gap-2 !text-danger disabled:opacity-40"
            >
              <FiTrash2 size={14} />
              {daysSince(lastActivity(selected)) < RETENTION_DAYS
                ? `Erasable in ${Math.ceil(RETENTION_DAYS - daysSince(lastActivity(selected)))} day(s)`
                : "Erase conversation"}
            </button>
          </div>
        )}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Erase this conversation?">
        {confirmDelete && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink-muted">
              This permanently deletes the conversation between {confirmDelete.customerName} and{" "}
              {confirmDelete.vendorName}, including all {confirmDelete.messages.length} message(s). This
              can't be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting}
                className="btn-primary flex-1 !bg-danger"
              >
                {deleting ? "Erasing..." : "Erase"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
