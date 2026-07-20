import Navbar from "../../components/layout/Navbar";
import NotificationsPanel from "../../components/features/NotificationsPanel";
import { useAsync } from "../../hooks/useAsync";
import { notificationService } from "../../services/notificationService";

export default function Notifications() {
  const { data: notifications, loading, refetch } = useAsync(
    () => notificationService.getNotifications(),
    []
  );

  const handleDismiss = async (id) => {
    await notificationService.dismiss(id);
    refetch();
  };

  return (
    <div>
      <Navbar showBack title="Notifications" showCart={false} />
      <div className="ob-container pt-4 pb-8">
        <NotificationsPanel notifications={notifications} loading={loading} onDismiss={handleDismiss} />
      </div>
    </div>
  );
}
