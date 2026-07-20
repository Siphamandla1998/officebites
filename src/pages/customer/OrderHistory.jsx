import { FiClock } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import OrderCard from "../../components/features/OrderCard";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { useAuth } from "../../context/AuthContext";

export default function OrderHistory() {
  const { user } = useAuth();
  const { data: orders, loading } = useAsync(() => orderService.getOrdersByCustomer(user.id), [user.id]);

  return (
    <div>
      <Navbar title="Your orders" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-3.5 pb-8">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24" />)
        ) : orders.length === 0 ? (
          <EmptyState icon={<FiClock size={20} />} title="No orders yet" description="Your placed orders will show up here." />
        ) : (
          orders.map((o) => <OrderCard key={o.id} order={o} />)
        )}
      </div>
    </div>
  );
}
