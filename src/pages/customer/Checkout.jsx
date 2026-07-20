import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { orderService } from "../../services/orderService";
import { splitCartByVendor, nextOrderableDate } from "../../utils/orderRules";
import { formatCurrency, formatDate } from "../../utils/formatters";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import { FiShoppingBag } from "react-icons/fi";

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const grouped = splitCartByVendor(items);
  const deliveryDate = nextOrderableDate();

  const handlePlaceOrder = async () => {
    setSubmitting(true);
    try {
      const order = await orderService.createOrder({
        customerId: user.id,
        customerName: user.name,
        deliveryDate: deliveryDate.toISOString().slice(0, 10),
        cartItems: items,
      });
      clearCart();
      showToast("Order created — upload proof of payment to confirm", { type: "success" });
      navigate(`/payment/${order.id}`);
    } catch (err) {
      showToast(err.message || "Couldn't place order", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div>
        <Navbar showBack title="Checkout" showCart={false} />
        <EmptyState
          icon={<FiShoppingBag size={20} />}
          title="Your cart is empty"
          description="Add meals before checking out."
          action={
            <button onClick={() => navigate("/vendors")} className="btn-primary">
              Browse vendors
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="pb-32">
      <Navbar showBack title="Checkout" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-5">
        <div className="card p-4">
          <p className="text-xs font-medium text-ink-muted mb-1">Delivery date</p>
          <p className="text-sm font-semibold text-ink">{formatDate(deliveryDate)}</p>
          <p className="text-xs text-ink-muted mt-1">
            One checkout, one experience — your order is split behind the scenes so each vendor only
            sees their own items.
          </p>
        </div>

        {grouped.map((group) => (
          <div key={group.vendorId} className="card p-4">
            <p className="text-xs font-semibold text-nude-700 uppercase tracking-wide mb-2.5">
              {group.vendorName}
            </p>
            {group.items.map((item) => (
              <div key={item.mealId} className="flex justify-between text-sm py-1">
                <span className="text-ink-soft">{item.qty} × {item.name}</span>
                <span className="text-ink">{formatCurrency(item.price * item.qty)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold pt-2 mt-2 border-t border-line">
              <span>Subtotal</span>
              <span>{formatCurrency(group.items.reduce((s, i) => s + i.price * i.qty, 0))}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-app bg-paper-raised border-t border-line p-4 shadow-nav flex flex-col gap-3">
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">Total</span>
          <span className="font-bold text-ink text-base">{formatCurrency(subtotal)}</span>
        </div>
        <button onClick={handlePlaceOrder} className="btn-primary w-full" disabled={submitting}>
          {submitting ? <Spinner size={16} className="!border-paper/30 !border-t-paper" /> : "Place order"}
        </button>
      </div>
    </div>
  );
}
