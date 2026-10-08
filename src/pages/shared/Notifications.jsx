import { useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import NotificationsPanel from "../../components/features/NotificationsPanel";
import SignInRequired from "../../components/features/SignInRequired";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import RequestError from '../../components/ui/RequestError';
import { useToast } from '../../context/ToastContext';

export default function Notifications() {
  const { isAuthenticated } = useAuth();
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

  if (!isAuthenticated) {
    return (
      <div>
        <Navbar
          showBack
          title="Notifications"
          showCart={false}
        />

        <SignInRequired
          title="Sign in for order updates"
          description="Create an account to get notified when your order is confirmed, ready, and more."
        />
      </div>
    );
  }

  return (
    <div>
      <Navbar
        showBack
        title="Notifications"
        showCart={false}
      />

      <div className="ob-container pt-4 pb-8">
        <RequestError error={error} onRetry={refresh} />
        {!error && <NotificationsPanel
          notifications={notifications}
          loading={loading}
          onDismiss={handleDismiss}
          onOpen={handleOpen}
          emptyDescription="Order updates, messages and support replies will appear here."
        />}
      </div>
    </div>
  );
}
