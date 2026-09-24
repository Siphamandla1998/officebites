import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiFileText,
  FiInbox,
  FiLock,
  FiMail,
  FiMessageSquare,
  FiPaperclip,
  FiRefreshCw,
  FiSend,
  FiShoppingBag,
  FiUser,
} from "react-icons/fi";

import { supportService } from "../../services/supportService";

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "waiting_customer", label: "Waiting for customer" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const FILTERS = [
  { value: "active", label: "Active" },
  { value: "open", label: "Open" },
  { value: "waiting_customer", label: "Waiting" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status) {
  return (
    STATUS_OPTIONS.find((item) => item.value === status)?.label ||
    status ||
    "Unknown"
  );
}

function priorityLabel(priority) {
  return (
    PRIORITY_OPTIONS.find((item) => item.value === priority)?.label ||
    priority ||
    "Normal"
  );
}

function statusClass(status) {
  switch (status) {
    case "open":
      return "bg-warning/10 text-warning";
    case "waiting_customer":
      return "bg-nude-100 text-nude-700";
    case "in_progress":
      return "bg-ink/5 text-ink";
    case "resolved":
      return "bg-success/10 text-success";
    case "closed":
      return "bg-ink/5 text-ink-muted";
    default:
      return "bg-nude-100 text-ink-soft";
  }
}

function priorityClass(priority) {
  switch (priority) {
    case "urgent":
      return "bg-danger/10 text-danger";
    case "high":
      return "bg-warning/10 text-warning";
    case "low":
      return "bg-nude-100 text-ink-muted";
    default:
      return "bg-ink/5 text-ink-soft";
  }
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const [attachmentUrl, setAttachmentUrl] = useState(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);

  const loadTickets = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (quiet) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const data = await supportService.getTickets();

      setTickets(data);

      setSelectedId((current) => {
        if (current && data.some((ticket) => ticket.id === current)) {
          return current;
        }

        return data[0]?.id || null;
      });
    } catch (err) {
      setError(err?.message || "Unable to load support tickets.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const selected = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) || null,
    [tickets, selectedId]
  );

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      let matchesFilter = true;

      if (filter === "active") {
        matchesFilter = !["resolved", "closed"].includes(ticket.status);
      } else if (filter !== "all") {
        matchesFilter = ticket.status === filter;
      }

      if (!matchesFilter) return false;
      if (!q) return true;

      const haystack = [
        ticket.ticketNumber,
        ticket.subject,
        ticket.category,
        ticket.requester?.name,
        ticket.requester?.email,
        ticket.requester?.contact,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [tickets, filter, search]);

  const activeCount = useMemo(
    () =>
      tickets.filter(
        (ticket) => !["resolved", "closed"].includes(ticket.status)
      ).length,
    [tickets]
  );

  const urgentCount = useMemo(
    () =>
      tickets.filter(
        (ticket) =>
          ticket.priority === "urgent" &&
          !["resolved", "closed"].includes(ticket.status)
      ).length,
    [tickets]
  );

  const waitingCount = useMemo(
    () =>
      tickets.filter((ticket) => ticket.status === "waiting_customer").length,
    [tickets]
  );

  async function refreshSelected() {
    if (!selectedId) return;

    const updated = await supportService.getTicketById(selectedId);

    if (!updated) return;

    setTickets((current) =>
      current.map((ticket) => (ticket.id === updated.id ? updated : ticket))
    );
  }

  async function changeStatus(status) {
    if (!selected || status === selected.status) return;

    try {
      setSaving(true);
      setActionError("");

      await supportService.adminUpdateTicket(selected.id, {
        status,
      });

      await refreshSelected();
    } catch (err) {
      setActionError(err?.message || "Unable to update ticket status.");
    } finally {
      setSaving(false);
    }
  }

  async function changePriority(priority) {
    if (!selected || priority === selected.priority) return;

    try {
      setSaving(true);
      setActionError("");

      await supportService.adminUpdateTicket(selected.id, {
        priority,
      });

      await refreshSelected();
    } catch (err) {
      setActionError(err?.message || "Unable to update ticket priority.");
    } finally {
      setSaving(false);
    }
  }

  async function sendReply() {
    const body = reply.trim();

    if (!selected || !body) return;

    try {
      setSending(true);
      setActionError("");

      await supportService.adminReplyToTicket(selected.id, body, {
        internal: false,
      });

      setReply("");

      await refreshSelected();
    } catch (err) {
      setActionError(err?.message || "Unable to send reply.");
    } finally {
      setSending(false);
    }
  }

  async function addInternalNote() {
    const body = internalNote.trim();

    if (!selected || !body) return;

    try {
      setSending(true);
      setActionError("");

      await supportService.adminReplyToTicket(selected.id, body, {
        internal: true,
      });

      setInternalNote("");

      await refreshSelected();
    } catch (err) {
      setActionError(err?.message || "Unable to add internal note.");
    } finally {
      setSending(false);
    }
  }

  async function openAttachment() {
    if (!selected?.attachmentPath) return;

    try {
      setAttachmentLoading(true);
      setActionError("");

      const url = await supportService.getAttachmentUrl(
        selected.attachmentPath
      );

      setAttachmentUrl(url);

      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setActionError(err?.message || "Unable to open attachment.");
    } finally {
      setAttachmentLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center">
        <FiRefreshCw className="mx-auto animate-spin text-ink-muted" size={22} />
        <p className="mt-3 text-sm text-ink-muted">
          Loading support queue…
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Customer care
          </p>

          <h1 className="mt-1 text-2xl font-semibold text-ink">
            Support
          </h1>

          <p className="mt-1 text-sm text-ink-soft">
            Manage customer issues, replies and internal support notes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadTickets({ quiet: true })}
          disabled={refreshing}
          className="btn-secondary self-start sm:self-auto"
        >
          <FiRefreshCw
            size={14}
            className={refreshing ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-danger/20 bg-danger/5 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-muted">Active tickets</p>
            <FiInbox size={16} className="text-ink-muted" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-muted">Urgent</p>
            <FiAlertCircle size={16} className="text-ink-muted" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {urgentCount}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-muted">
              Waiting for customer
            </p>
            <FiClock size={16} className="text-ink-muted" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">
            {waitingCount}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 lg:flex-row">
        <section className="lg:w-[38%] lg:min-w-[320px]">
          <div className="rounded-2xl border border-line bg-white">
            <div className="border-b border-line p-3">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tickets…"
                className="input w-full"
              />

              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {FILTERS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition ${
                      filter === item.value
                        ? "bg-ink text-paper"
                        : "bg-nude-100 text-ink-soft hover:bg-nude-200"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[680px] overflow-y-auto">
              {filteredTickets.length === 0 ? (
                <div className="p-8 text-center">
                  <FiInbox
                    size={22}
                    className="mx-auto text-ink-muted"
                  />
                  <p className="mt-3 text-sm font-medium text-ink">
                    No tickets found
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    There are no tickets matching this view.
                  </p>
                </div>
              ) : (
                filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(ticket.id);
                      setActionError("");
                      setAttachmentUrl(null);
                    }}
                    className={`w-full border-b border-line p-4 text-left transition last:border-b-0 ${
                      selectedId === ticket.id
                        ? "bg-nude-50"
                        : "hover:bg-nude-50/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-ink">
                        {ticket.ticketNumber}
                      </p>

                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-medium ${priorityClass(
                          ticket.priority
                        )}`}
                      >
                        {priorityLabel(ticket.priority)}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-1 text-sm font-medium text-ink">
                      {ticket.subject}
                    </p>

                    <p className="mt-1 line-clamp-1 text-xs text-ink-muted">
                      {ticket.requester?.name || "Customer"}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-medium ${statusClass(
                          ticket.status
                        )}`}
                      >
                        {statusLabel(ticket.status)}
                      </span>

                      <span className="text-[10px] text-ink-muted">
                        {formatDateTime(ticket.createdAt)}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="min-w-0 flex-1">
          {!selected ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-line bg-white p-8 text-center">
              <div>
                <FiMessageSquare
                  size={24}
                  className="mx-auto text-ink-muted"
                />
                <p className="mt-3 text-sm font-medium text-ink">
                  Select a support ticket
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Ticket details and conversation will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-muted">
                      {selected.ticketNumber}
                    </p>

                    <h2 className="mt-1 text-lg font-semibold text-ink">
                      {selected.subject}
                    </h2>

                    <p className="mt-1 text-xs text-ink-muted">
                      {selected.category}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                        selected.status
                      )}`}
                    >
                      {statusLabel(selected.status)}
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityClass(
                        selected.priority
                      )}`}
                    >
                      {priorityLabel(selected.priority)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-nude-50 p-3">
                    <div className="flex items-center gap-2 text-xs text-ink-muted">
                      <FiUser size={13} />
                      Customer
                    </div>

                    <p className="mt-2 text-sm font-medium text-ink">
                      {selected.requester?.name || "Customer"}
                    </p>

                    {selected.requester?.email && (
                      <p className="mt-1 break-all text-xs text-ink-soft">
                        {selected.requester.email}
                      </p>
                    )}

                    {selected.requester?.contact && (
                      <p className="mt-1 text-xs text-ink-soft">
                        {selected.requester.contact}
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-nude-50 p-3">
                    <div className="flex items-center gap-2 text-xs text-ink-muted">
                      <FiClock size={13} />
                      Timeline
                    </div>

                    <div className="mt-2 space-y-1 text-xs text-ink-soft">
                      <p>
                        Created:{" "}
                        <span className="text-ink">
                          {formatDateTime(selected.createdAt)}
                        </span>
                      </p>

                      <p>
                        First response:{" "}
                        <span className="text-ink">
                          {formatDateTime(selected.firstResponseAt)}
                        </span>
                      </p>

                      <p>
                        Resolved:{" "}
                        <span className="text-ink">
                          {formatDateTime(selected.resolvedAt)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                {(selected.orderId || selected.attachmentPath) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selected.orderId && (
                      <a
                        href={`/orders/${selected.orderId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary"
                      >
                        <FiShoppingBag size={14} />
                        Linked order
                        <FiExternalLink size={12} />
                      </a>
                    )}

                    {selected.attachmentPath && (
                      <button
                        type="button"
                        onClick={openAttachment}
                        disabled={attachmentLoading}
                        className="btn-secondary"
                      >
                        <FiPaperclip size={14} />
                        {attachmentLoading
                          ? "Opening…"
                          : "View attachment"}
                      </button>
                    )}
                  </div>
                )}

                {attachmentUrl && (
                  <p className="mt-2 text-[10px] text-ink-muted">
                    Attachment opened using a temporary private URL.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-line bg-white p-5">
                <h3 className="text-sm font-semibold text-ink">
                  Ticket controls
                </h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                      Status
                    </span>

                    <select
                      value={selected.status}
                      onChange={(event) => changeStatus(event.target.value)}
                      disabled={saving}
                      className="input w-full"
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="mb-1.5 block text-xs font-medium text-ink-muted">
                      Priority
                    </span>

                    <select
                      value={selected.priority}
                      onChange={(event) => changePriority(event.target.value)}
                      disabled={saving}
                      className="input w-full"
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {actionError && (
                  <div className="mt-3 rounded-xl bg-danger/5 p-3 text-xs text-danger">
                    {actionError}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-line bg-white">
                <div className="border-b border-line p-5">
                  <h3 className="text-sm font-semibold text-ink">
                    Conversation
                  </h3>

                  <p className="mt-1 text-xs text-ink-muted">
                    Customer messages, public replies and internal notes.
                  </p>
                </div>

                <div className="max-h-[500px] space-y-3 overflow-y-auto p-5">
                  {selected.messages.length === 0 ? (
                    <div className="py-8 text-center">
                      <FiMessageSquare
                        size={20}
                        className="mx-auto text-ink-muted"
                      />
                      <p className="mt-2 text-xs text-ink-muted">
                        No messages yet.
                      </p>
                    </div>
                  ) : (
                    selected.messages.map((message) => {
                      const internal = message.internal;
                      const support = message.senderRole === "support";

                      return (
                        <div
                          key={message.id}
                          className={`flex ${
                            support ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[88%] rounded-2xl px-4 py-3 ${
                              internal
                                ? "border border-warning/20 bg-warning/5"
                                : support
                                  ? "bg-ink text-paper"
                                  : "bg-nude-100 text-ink"
                            }`}
                          >
                            <div className="mb-1.5 flex items-center gap-1.5">
                              {internal && <FiLock size={11} />}

                              <span
                                className={`text-[10px] font-medium ${
                                  support && !internal
                                    ? "text-paper/60"
                                    : "text-ink-muted"
                                }`}
                              >
                                {internal
                                  ? "Internal note"
                                  : support
                                    ? "OfficeBites Support"
                                    : selected.requester?.name || "Customer"}
                              </span>
                            </div>

                            <p className="whitespace-pre-wrap text-sm">
                              {message.text}
                            </p>

                            <p
                              className={`mt-2 text-[10px] ${
                                support && !internal
                                  ? "text-paper/50"
                                  : "text-ink-muted"
                              }`}
                            >
                              {formatDateTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-line bg-white p-5">
                  <div className="flex items-center gap-2">
                    <FiMail size={15} />
                    <h3 className="text-sm font-semibold text-ink">
                      Reply to customer
                    </h3>
                  </div>

                  <p className="mt-1 text-xs text-ink-muted">
                    This message will be visible to the customer.
                  </p>

                  <textarea
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                    rows={5}
                    maxLength={5000}
                    placeholder="Write your response…"
                    className="input mt-4 w-full resize-y"
                  />

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[10px] text-ink-muted">
                      {reply.length}/5000
                    </span>

                    <button
                      type="button"
                      onClick={sendReply}
                      disabled={sending || !reply.trim()}
                      className="btn-primary"
                    >
                      <FiSend size={14} />
                      Send reply
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-white p-5">
                  <div className="flex items-center gap-2">
                    <FiLock size={15} />
                    <h3 className="text-sm font-semibold text-ink">
                      Internal note
                    </h3>
                  </div>

                  <p className="mt-1 text-xs text-ink-muted">
                    Internal notes are visible to OfficeBites admins only.
                  </p>

                  <textarea
                    value={internalNote}
                    onChange={(event) => setInternalNote(event.target.value)}
                    rows={5}
                    maxLength={5000}
                    placeholder="Add an internal note…"
                    className="input mt-4 w-full resize-y"
                  />

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[10px] text-ink-muted">
                      {internalNote.length}/5000
                    </span>

                    <button
                      type="button"
                      onClick={addInternalNote}
                      disabled={sending || !internalNote.trim()}
                      className="btn-secondary"
                    >
                      <FiFileText size={14} />
                      Add note
                    </button>
                  </div>
                </div>
              </div>

              {selected.status === "resolved" && (
                <div className="flex items-start gap-2 rounded-2xl bg-success/5 p-4 text-sm text-success">
                  <FiCheckCircle size={17} className="mt-0.5 shrink-0" />
                  This ticket is resolved.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}