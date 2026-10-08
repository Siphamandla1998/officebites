import { useNavigate } from "react-router-dom";
import NotificationsPanel from "../../components/features/NotificationsPanel";
import { useNotifications } from "../../context/NotificationContext";
import RequestError from '../../components/ui/RequestError';
import { useToast } from '../../context/ToastContext';

export default function VendorNotifications() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const {
    notifications,
    loading,
    error,
    refresh,
    markAsRead,
    dismiss,
  } = useNotifications();

  const handleDismiss = async (id) => {
    try {
      await dismiss(id);
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
      showToast(error.message || 'Could not dismiss the notification. Retry.', { type: 'error' });
    }
  };

  const handleOpen = async (notification) => {
    try {
      if (!notification.read) {
        if (await markAsRead(notification.id) === false) return;
      }

      if (notification.actionUrl) {
        navigate(notification.actionUrl);
      }
    } catch (error) {
      console.error("Failed to open notification:", error);
      showToast(error.message || 'Could not mark the notification read. Retry.', { type: 'error' });
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

      <RequestError error={error} onRetry={refresh} />
      {!error && <NotificationsPanel
        notifications={notifications}
        loading={loading}
        onDismiss={handleDismiss}
        onOpen={handleOpen}
        emptyDescription="You'll see new orders, payments and messages here."
      />}
    </div>
  );
}
