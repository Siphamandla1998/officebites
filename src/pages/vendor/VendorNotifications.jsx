import { useNavigate } from "react-router-dom";
import NotificationsPanel from "../../components/features/NotificationsPanel";
import { useNotifications } from "../../context/NotificationContext";

export default function VendorNotifications() {
  const navigate = useNavigate();

  const {
    notifications,
    loading,
    markAsRead,
    dismiss,
  } = useNotifications();

  const handleDismiss = async (id) => {
    try {
      await dismiss(id);
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  };

  const handleOpen = async (notification) => {
    try {
      if (!notification.read) {
        await markAsRead(notification.id);
      }

      if (notification.actionUrl) {
        navigate(notification.actionUrl);
      }
    } catch (error) {
      console.error("Failed to open notification:", error);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-ink">
          Notifications
        </h1>

        <p className="text-sm text-ink-muted mt-0.5">
          New orders, payments, messages and important OfficeBites updates.
        </p>
      </div>

      <NotificationsPanel
        notifications={notifications}
        loading={loading}
        onDismiss={handleDismiss}
        onOpen={handleOpen}
        emptyDescription="You'll see new orders, payments and messages here."
      />
    </div>
  );
}