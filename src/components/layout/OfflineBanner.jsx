import { FiWifiOff } from "react-icons/fi";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-ink text-paper text-xs font-medium flex items-center justify-center gap-1.5 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <FiWifiOff size={12} />
      You're offline — showing cached menus and orders
    </div>
  );
}
