import { FiClock } from "react-icons/fi";
import { Link } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import OrderCard from "../../components/features/OrderCard";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { useAuth } from "../../context/AuthContext";
import { getGuestOrderIds } from "../../utils/guest";

export default function OrderHistory() {
  const { user, isAuthenticated } = useAuth();

  const { data: orders, loading } = useAsync(
    () =>
      isAuthenticated
        ? orderService.getOrdersByCustomer(user.id)
        : orderService.getOrdersByIds(getGuestOrderIds()),
    [isAuthenticated, user?.id]
  );

  return (
    <div>
      <Navbar title="Your orders" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-3.5 pb-8">
        {!isAuthenticated && (
          <p className="text-xs text-ink-muted bg-nude-50 rounded-lg px-3.5 py-2.5">
            Showing orders placed as a guest on this device.{" "}
            <Link to="/login" className="font-medium text-nude-600">Sign in</Link> to sync your history
            across devices, or{" "}
            <Link to="/track" className="font-medium text-nude-600">track an order from another device</Link>.
          </p>
        )}
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24" />)
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<FiClock size={20} />}
            title="No orders yet"
            description={
              isAuthenticated
                ? "Your placed orders will show up here."
                : "Orders you place as a guest on this device will show up here."
            }
          />
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} />)
        )}
      </div>
    </div>
  );
}
