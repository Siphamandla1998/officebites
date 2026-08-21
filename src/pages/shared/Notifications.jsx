import Navbar from "../../components/layout/Navbar";
import NotificationsPanel from "../../components/features/NotificationsPanel";
import SignInRequired from "../../components/features/SignInRequired";
import { useAsync } from "../../hooks/useAsync";
import { notificationService } from "../../services/notificationService";
import { useAuth } from "../../context/AuthContext";

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const { data: notifications, loading, refetch } = useAsync(
    () => (isAuthenticated ? notificationService.getNotifications() : Promise.resolve([])),
    [isAuthenticated]
  );

  const handleDismiss = async (id) => {
    await notificationService.dismiss(id);
    refetch();
  };

  if (!isAuthenticated) {
    return (
      <div>
        <Navbar showBack title="Notifications" showCart={false} />
        <SignInRequired
          title="Sign in for order updates"
          description="Create an account to get notified when your order is confirmed, ready, and more."
        />
      </div>
    );
  }

  return (
    <div>
      <Navbar showBack title="Notifications" showCart={false} />
      <div className="ob-container pt-4 pb-8">
        <NotificationsPanel notifications={notifications} loading={loading} onDismiss={handleDismiss} />
      </div>
    </div>
  );
}
