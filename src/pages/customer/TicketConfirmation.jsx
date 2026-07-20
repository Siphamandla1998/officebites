import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import TicketCard from "../../components/features/TicketCard";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";

export default function TicketConfirmation() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { data: order, loading } = useAsync(() => orderService.getOrderById(orderId), [orderId]);

  if (loading || !order) {
    return (
      <div>
        <Navbar showBack title="Your ticket" showCart={false} />
        <div className="ob-container pt-4"><div className="skeleton h-96" /></div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <Navbar showBack title="Your ticket" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-5">
        <TicketCard order={order} />
        <p className="text-xs text-ink-muted text-center px-4">
          OfficeBites is verifying your payment. You'll get a notification the moment it's confirmed.
        </p>
        <div className="flex flex-col gap-2.5">
          <button onClick={() => navigate(`/orders/${order.id}`)} className="btn-primary w-full">
            Track this order
          </button>
          <button onClick={() => navigate("/home")} className="btn-outline w-full">
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
