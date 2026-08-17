import NotificationsPanel from "../../components/features/NotificationsPanel";
import { useAsync } from "../../hooks/useAsync";
import { notificationService } from "../../services/notificationService";

export default function VendorNotifications() {
  const { data: notifications, loading, refetch } = useAsync(
    () => notificationService.getVendorNotifications(),
    []
  );

  const handleDismiss = async (id) => {
    await notificationService.dismissVendorNotification(id);
    refetch();
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-ink">Notifications</h1>
        <p className="text-sm text-ink-muted mt-0.5">
          New orders, cancellations, payments, messages and stock alerts.
        </p>
      </div>
      <NotificationsPanel
        notifications={notifications}
        loading={loading}
        onDismiss={handleDismiss}
        emptyDescription="You'll see new orders, payments and messages here."
      />
    </div>
  );
}
