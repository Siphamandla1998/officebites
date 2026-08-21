import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import TextField from "../../components/forms/TextField";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { orderService } from "../../services/orderService";
import { splitCartByVendor, nextOrderableDate } from "../../utils/orderRules";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { addGuestOrderId } from "../../utils/guest";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import { FiShoppingBag, FiUser } from "react-icons/fi";

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [guestDetails, setGuestDetails] = useState({ name: "", phone: "", email: "" });
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [errors, setErrors] = useState({});

  const grouped = splitCartByVendor(items);
  const deliveryDate = nextOrderableDate();

  const updateGuest = (key) => (e) => setGuestDetails((g) => ({ ...g, [key]: e.target.value }));

  const validateGuest = () => {
    const next = {};
    if (!deliveryLocation.trim()) next.deliveryLocation = "Let us know where to deliver";
    if (isAuthenticated) {
      setErrors(next);
      return Object.keys(next).length === 0;
    }
    if (!guestDetails.name.trim()) next.name = "Enter your name so vendors know who's collecting";
    if (!guestDetails.phone.trim()) next.phone = "Enter a mobile number we can reach you on";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (!validateGuest()) {
      showToast("Please fill in your details before ordering", { type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const order = await orderService.createOrder({
        customerId: isAuthenticated ? user.id : null,
        customerName: isAuthenticated ? user.name : guestDetails.name,
        guestContact: isAuthenticated ? null : guestDetails.phone.trim(),
        guestEmail: isAuthenticated ? null : guestDetails.email.trim() || null,
        deliveryDate: deliveryDate.toISOString().slice(0, 10),
        deliveryLocation: deliveryLocation.trim(),
        cartItems: items,
      });
      if (!isAuthenticated) addGuestOrderId(order.id);
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
        {!isAuthenticated && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-nude-100 text-nude-700 flex items-center justify-center shrink-0">
                <FiUser size={14} />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Checking out as a guest</p>
                <p className="text-xs text-ink-muted">
                  No account needed —{" "}
                  <Link to="/login" state={{ from: { pathname: "/checkout" } }} className="text-nude-600 font-medium">
                    sign in
                  </Link>{" "}
                  instead for faster checkout next time.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <TextField
                label="Your name"
                value={guestDetails.name}
                onChange={updateGuest("name")}
                error={errors.name}
                placeholder="e.g. Thabo Mokoena"
              />
              <TextField
                label="Mobile number"
                value={guestDetails.phone}
                onChange={updateGuest("phone")}
                error={errors.phone}
                placeholder="So we can reach you about your order"
              />
              <TextField
                label="Email (optional)"
                value={guestDetails.email}
                onChange={updateGuest("email")}
                error={errors.email}
                placeholder="For your order confirmation"
              />
            </div>
          </div>
        )}

        <div className="card p-4">
          <TextField
            label="Where should we deliver?"
            value={deliveryLocation}
            onChange={(e) => setDeliveryLocation(e.target.value)}
            error={errors.deliveryLocation}
            placeholder="e.g. Nedbank Building, 3rd Floor, Office 302"
          />
        </div>

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
