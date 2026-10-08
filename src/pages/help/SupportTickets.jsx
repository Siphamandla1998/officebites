import { useState, useEffect, useRef } from "react";
import RequestError from '../../components/ui/RequestError';
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
const SUPPORT_STATUS_LABELS = { open: "Open", waiting_customer: "Waiting for you", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };

export default function SupportTickets() {
  const { showToast } = useToast();
  const { isAuthenticated, user } = useAuth();
  const account = useRef(user?.id);
  account.current = user?.id;
  const [filter, setFilter] = useState("all");
  const [selectedState, setSelectedState] = useState(null);
  const selected = selectedState?.uid === user?.id ? selectedState.ticket : null;
  const setSelected = value => setSelectedState(current => ({ uid: user?.id, ticket: typeof value === 'function' ? value(current?.uid === user?.id ? current.ticket : null) : value }));
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const { data: tickets, loading, error, refetch } = useAsync(
    () => (isAuthenticated ? supportService.getTickets() : Promise.resolve([])),
    [isAuthenticated, user?.id]
  );
  useEffect(() => { setSelectedState(null); setReply(''); setSending(false); }, [user?.id]);

  if (!isAuthenticated) {
    return (
      <div>
        <Navbar showBack title="My Tickets" showCart={false} />
        <SignInRequired
          title="Sign in to view your tickets"
          description="Sign in to contact support and view your ticket history."
        />
      </div>
    );
  }

  const filtered = (tickets || []).filter((t) => filter === "all" || t.status === filter);

  const sendReply = async () => {
    const uid = user?.id;
    const ticketId = selected?.id;
    if (!reply.trim() || !selected || sending || ['resolved','closed'].includes(selected.status)) return;
    setSending(true);
    try {
      await supportService.replyToTicket(selected.id, reply);
      if (account.current !== uid) return;
      showToast("Reply sent", { type: "success" });
      setReply("");
      const updated = await supportService.getTicketById(selected.id);
      if (account.current !== uid) return;
      setSelected(current => current?.id === ticketId ? updated : current);
      await refetch();
    } catch (error) {
      if (account.current === uid) showToast(error.message || "Could not send your reply.", { type: "error" });
    } finally { if (account.current === uid) setSending(false); }
  };

  return (
    <div className="pb-8">
      <Navbar showBack title="My Tickets" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-4">
        <Filters
          options={Object.keys(SUPPORT_STATUS_LABELS)}
          active={filter}
          onChange={setFilter}
          allLabel="All tickets"
          labels={SUPPORT_STATUS_LABELS}
        />

        {error ? <RequestError error={error} onRetry={refetch} /> : loading ? (
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
            {!["resolved", "closed"].includes(selected.status) && (
              <div className="flex items-center gap-2 pt-2 border-t border-line">
                <input
                  disabled={sending}
                  maxLength={5000}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendReply()}
                  placeholder="Add a reply..."
                  className="input flex-1"
                  aria-label="Reply to ticket"
                />
                <button disabled={sending || !reply.trim()} onClick={sendReply} className="btn-icon !bg-ink !text-paper !border-ink" aria-label="Send reply">
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
