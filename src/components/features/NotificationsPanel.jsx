import { FiBell, FiX, FiChevronRight } from "react-icons/fi";
import EmptyState from "../ui/EmptyState";
import { formatRelativeTime } from "../../utils/formatters";

/**
 * Shared customer/vendor notification list.
 *
 * - Unread notifications receive highlighted styling.
 * - Clicking a notification can mark it as read and navigate to its action.
 * - Dismiss remains independent from opening the notification.
 */
export default function NotificationsPanel({
  notifications,
  loading,
  onDismiss,
  onOpen,
  emptyDescription,
}) {
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
      <EmptyState
        icon={<FiBell size={20} />}
        title="You're all caught up"
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`card p-3.5 flex gap-3 transition-colors ${
            !n.read ? "bg-nude-50/60" : ""
          }`}
        >
          <div
            className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
              !n.read ? "bg-nude-500" : "bg-transparent"
            }`}
          />

          <button
            type="button"
            onClick={() => onOpen?.(n)}
            className={`min-w-0 flex-1 text-left ${
              onOpen ? "cursor-pointer" : "cursor-default"
            }`}
          >
            <p className="text-sm font-semibold text-ink">
              {n.title}
            </p>

            <p className="text-xs text-ink-muted mt-0.5">
              {n.body}
            </p>

            <p className="text-[11px] text-ink-muted mt-1">
              {formatRelativeTime(n.createdAt)}
            </p>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            {onOpen && n.actionUrl && (
              <button
                type="button"
                onClick={() => onOpen(n)}
                className="text-ink-muted hover:text-ink"
                aria-label="Open notification"
              >
                <FiChevronRight size={16} />
              </button>
            )}

            {onDismiss && (
              <button
                type="button"
                onClick={() => onDismiss(n.id)}
                className="text-ink-muted hover:text-ink"
                aria-label="Dismiss notification"
              >
                <FiX size={15} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}