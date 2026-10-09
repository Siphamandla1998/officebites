import { ORDER_STATUS } from '../../utils/constants';
import { useAuth } from '../../context/AuthContext';
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import TicketCard from "../../components/features/TicketCard";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";

export default function TicketConfirmation() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: order, loading, error } = useAsync(() => orderService.getOrderById(orderId), [orderId, user?.id], null);

  if (loading) {
    return (
      <div>
        <Navbar showBack title="Your ticket" showCart={false} />
        <div className="ob-container pt-4"><div className="skeleton h-96" /></div>
      </div>
    );
  }

  if (error || !order?.id) {
    return <div><Navbar showBack title="Your ticket" showCart={false} /><p role="alert" className="ob-container pt-4">This order could not be found. Open your order history or verify your order code and phone number.</p></div>;
  }

  return (
    <div className="pb-8">
      <Navbar showBack title="Your ticket" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-5">
        <TicketCard order={order} />
        <p className="text-xs text-ink-muted text-center px-4">
          {order.status === ORDER_STATUS.PENDING_PAYMENT ? 'Payment is still required. If your bank shows a debit, wait for confirmation or contact support before paying again.'
            : order.status === ORDER_STATUS.CANCELLED ? 'This order has been cancelled. Contact support if a payment needs review.'
            : order.status === ORDER_STATUS.COMPLETED ? 'Your order is complete. Thank you for ordering with OfficeBites.'
            : order.status === ORDER_STATUS.PAYMENT_SUBMITTED ? 'Your payment is awaiting verification.'
            : 'Your payment is confirmed. Track your order for fulfilment updates.'}
        </p>
        {!order.customerId && (
          <p className="text-xs text-ink-muted text-center px-4">
            Save your order code <span className="font-semibold text-ink">{order.ticketNumber}</span> —
            you can look this order up from any device on the{" "}
            <button onClick={() => navigate("/track")} className="font-medium text-nude-600 underline">
              track order
            </button>{" "}
            page.
          </p>
        )}
        <div className="flex flex-col gap-2.5">
          <button onClick={() => navigate(`/orders/${order.id}`)} className="btn-primary w-full">
            Track this order
          </button>
          <button onClick={() => navigate("/")} className="btn-outline w-full">
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
