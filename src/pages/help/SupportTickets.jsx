import { useState } from "react";
import { FiFileText, FiSend } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import Filters from "../../components/ui/Filters";
import StatusBadge from "../../components/ui/StatusBadge";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import SignInRequired from "../../components/features/SignInRequired";
import { useAsync } from "../../hooks/useAsync";
import { supportService } from "../../services/supportService";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { formatDate, formatTime } from "../../utils/formatters";
import { TICKET_STATUS, TICKET_STATUS_LABELS } from "../../utils/constants";

export default function SupportTickets() {
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState("");
  const { data: tickets, loading, refetch } = useAsync(
    () => (isAuthenticated ? supportService.getTickets() : Promise.resolve([])),
    [isAuthenticated]
  );

  if (!isAuthenticated) {
    return (
      <div>
        <Navbar showBack title="My Tickets" showCart={false} />
        <SignInRequired
          title="Sign in to view your tickets"
          description="Ticket history is tied to your account, so it needs you to be signed in. Guest submissions get a ticket number by email instead."
        />
      </div>
    );
  }

  const filtered = (tickets || []).filter((t) => filter === "all" || t.status === filter);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    await supportService.replyToTicket(selected.id, reply);
    showToast("Reply sent", { type: "success" });
    setReply("");
    const updated = await supportService.getTicketById(selected.id);
    setSelected(updated);
    refetch();
  };

  return (
    <div className="pb-8">
      <Navbar showBack title="My Tickets" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-4">
        <Filters
          options={[TICKET_STATUS.OPEN, TICKET_STATUS.PENDING, TICKET_STATUS.RESOLVED]}
          active={filter}
          onChange={setFilter}
          allLabel="All tickets"
          labels={TICKET_STATUS_LABELS}
        />

        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-20" />)
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FiFileText size={20} />} title="No tickets here" description="Tickets you raise will show up here." />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((t) => (
              <button key={t.id} onClick={() => setSelected(t)} className="card p-4 text-left flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-ink-muted">{t.ticketNumber}</p>
                    <p className="text-sm font-semibold text-ink mt-0.5">{t.subject}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-ink-muted pt-2 border-t border-line">
                  <span>{t.category} · {t.priority} priority</span>
                  <span>{formatDate(t.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.ticketNumber}>
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{selected.subject}</p>
              <StatusBadge status={selected.status} />
            </div>
            <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
              {selected.messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      m.sender === "user" ? "bg-ink text-paper rounded-br-sm" : "bg-nude-100 text-ink rounded-bl-sm"
                    }`}
                  >
                    {m.text}
                    <p className={`text-[10px] mt-1 ${m.sender === "user" ? "text-paper/50" : "text-ink-muted"}`}>
                      {formatTime(m.time)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {selected.status !== TICKET_STATUS.RESOLVED && (
              <div className="flex items-center gap-2 pt-2 border-t border-line">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendReply()}
                  placeholder="Add a reply..."
                  className="input flex-1"
                  aria-label="Reply to ticket"
                />
                <button onClick={sendReply} className="btn-icon !bg-ink !text-paper !border-ink" aria-label="Send reply">
                  <FiSend size={15} />
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
