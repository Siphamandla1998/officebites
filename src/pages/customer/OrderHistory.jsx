import {
  FiClock,
  FiSearch,
  FiArrowRight,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import OrderCard from "../../components/features/OrderCard";
import EmptyState from "../../components/ui/EmptyState";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { useAuth } from "../../context/AuthContext";
import { getGuestOrders } from "../../utils/guest";

export default function OrderHistory() {
  const { user, isAuthenticated } = useAuth();

  const { data: orders = [], loading } = useAsync(
    () =>
      isAuthenticated
        ? orderService.getOrdersByCustomer(user.id)
        : orderService.getGuestOrdersHistory(
            getGuestOrders()
          ),
    [isAuthenticated, user?.id]
  );

  return (
    <div>
      <Navbar title="Your orders" showCart={false} />

      <div className="ob-container pt-4 flex flex-col gap-3.5 pb-8">
        {!isAuthenticated && (
          <>
            {/* Guest order explanation */}
            <div className="text-xs text-ink-muted bg-nude-50 rounded-lg px-3.5 py-2.5">
              Showing orders placed as a guest on this device.{" "}
              <Link
                to="/login"
                className="font-medium text-nude-600"
              >
                Sign in
              </Link>{" "}
              to keep your account orders together.
            </div>

            {/* Cross-device order tracking */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-nude-100 text-nude-700 flex items-center justify-center">
                  <FiSearch size={18} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    Track an order
                  </p>

                  <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                    Ordered from another phone or computer?
                    Use your OfficeBites order number and the
                    mobile number used at checkout.
                  </p>

                  <Link
                    to="/track"
                    className="btn-secondary mt-3 inline-flex items-center gap-2"
                  >
                    Track order
                    <FiArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="skeleton h-24"
            />
          ))
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<FiClock size={20} />}
            title="No orders yet"
            description={
              isAuthenticated
                ? "Your placed orders will show up here."
                : "No orders from this device yet. You can place a new order or track an existing order above."
            }
          />
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
            />
          ))
        )}
      </div>
    </div>
  );
}