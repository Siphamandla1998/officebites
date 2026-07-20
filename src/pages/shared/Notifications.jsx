import { FiBell } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { notificationService } from "../../services/notificationService";
import { formatRelativeTime } from "../../utils/formatters";

export default function Notifications() {
  const { data: notifications, loading } = useAsync(() => notificationService.getNotifications(), []);

  return (
    <div>
      <Navbar showBack title="Notifications" showCart={false} />
      <div className="ob-container pt-4 pb-8 flex flex-col gap-2.5">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16" />)
        ) : notifications.length === 0 ? (
          <EmptyState icon={<FiBell size={20} />} title="You're all caught up" />
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={`card p-3.5 flex gap-3 ${!n.read ? "bg-nude-50/60" : ""}`}>
              <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${!n.read ? "bg-nude-500" : "bg-transparent"}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{n.title}</p>
                <p className="text-xs text-ink-muted mt-0.5">{n.body}</p>
                <p className="text-[11px] text-ink-muted mt-1">{formatRelativeTime(n.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
