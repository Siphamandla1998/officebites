import { useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import NotificationsPanel from "../../components/features/NotificationsPanel";
import SignInRequired from "../../components/features/SignInRequired";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";

export default function Notifications() {
  const { isAuthenticated } = useAuth();
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
        <NotificationsPanel
          notifications={notifications}
          loading={loading}
          onDismiss={handleDismiss}
          onOpen={handleOpen}
          emptyDescription="Order updates, messages and support replies will appear here."
        />
      </div>
    </div>
  );
}