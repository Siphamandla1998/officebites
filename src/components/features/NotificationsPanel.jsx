import { FiBell, FiX } from "react-icons/fi";
import EmptyState from "../ui/EmptyState";
import { formatRelativeTime } from "../../utils/formatters";

/**
 * Renders a list of notifications with read/unread styling and an optional
 * dismiss action. Used by both the customer Notifications page and the
 * vendor Notifications page — only the data-fetching differs between them.
 */
export default function NotificationsPanel({ notifications, loading, onDismiss, emptyDescription }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-16" />
        ))}
      </div>
    );
  }

  if (!notifications?.length) {
    return (
      <EmptyState icon={<FiBell size={20} />} title="You're all caught up" description={emptyDescription} />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {notifications.map((n) => (
        <div key={n.id} className={`card p-3.5 flex gap-3 ${!n.read ? "bg-nude-50/60" : ""}`}>
          <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${!n.read ? "bg-nude-500" : "bg-transparent"}`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{n.title}</p>
            <p className="text-xs text-ink-muted mt-0.5">{n.body}</p>
            <p className="text-[11px] text-ink-muted mt-1">{formatRelativeTime(n.createdAt)}</p>
          </div>
          {onDismiss && (
            <button
              onClick={() => onDismiss(n.id)}
              className="text-ink-muted hover:text-ink shrink-0"
              aria-label="Dismiss notification"
            >
              <FiX size={15} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
