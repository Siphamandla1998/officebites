import { useRequestGuard } from '../../hooks/useRequestGuard';
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import TextField from "../../components/forms/TextField";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { orderService } from "../../services/orderService";
import { splitCartByVendor, deliveryDateKey, isOrderingOpen } from "../../utils/orderRules";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { useDeliveryDate } from "../../hooks/useDeliveryDate";
import { addGuestOrder, getGuestOrderAccess } from "../../utils/guest";
import Spinner from "../../components/ui/Spinner";
import EmptyState from "../../components/ui/EmptyState";
import { FiShoppingBag, FiUser } from "react-icons/fi";

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const creating = useRef(false);
  const requests = useRequestGuard(user?.id || 'guest');
  useEffect(() => { setCreatedOrder(null); setSubmitting(false); }, [user?.id]);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [guestDetails, setGuestDetails] = useState({
    name: "",
    phone: "",
  });
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [errors, setErrors] = useState({});

  const grouped = splitCartByVendor(items);
  const deliveryDate = useDeliveryDate();

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
    if (creating.current || createdOrder) return;
    if (!isOrderingOpen(deliveryDate)) {
      showToast("The ordering cutoff has passed. Please review the updated delivery date before ordering.", { type: "info" });
      return;
    }
    if (!validateGuest()) {
      showToast("Please fill in your details before ordering", { type: "error" });
      return;
    }
    const current = requests.capture();
    creating.current = true;
    setSubmitting(true);
    try {
      const order = await orderService.createOrder({
        customerId: isAuthenticated ? user.id : null,
        customerName: isAuthenticated ? user.name : guestDetails.name,
        guestContact: isAuthenticated ? null : guestDetails.phone.trim(),
        guestEmail: null,
        deliveryDate: deliveryDateKey(deliveryDate),
        deliveryLocation: deliveryLocation.trim(),
        cartItems: items,
      });
      // Preserve the completed guest order even if navigation changed while
      // the server was creating it. Only current-scope UI/cart effects follow.
      const persisted = isAuthenticated || addGuestOrder({
        id: order.id,
        ticketNumber: order.ticketNumber,
        contact: guestDetails.phone.trim(),
      });
      if (!current()) return;
      setCreatedOrder(order);
      if (!persisted) {
        clearCart();
        return;
      }

      clearCart();

      showToast(
        "Order created — continue to PayFast to complete payment",
        { type: "success" }
      );

      navigate(`/payment/${order.id}`);

    } catch (err) {
      if (!current()) return;
      showToast(err.message || "Couldn't place order", { type: "error" });
    } finally {
      creating.current = false;
      if (current()) setSubmitting(false);
    }
  };

  if (createdOrder) {
    return <div><Navbar showBack title="Order created" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-4">
        <p>Your order code is <strong>{createdOrder.ticketNumber}</strong>.</p>
        <p>Save this code. Use Track Order with the phone number you entered to recover your order after leaving this tab. Your browser may not retain these details.</p>
        <button className="btn-primary" disabled={!isAuthenticated && !getGuestOrderAccess(createdOrder.id)} onClick={() => navigate(`/payment/${createdOrder.id}`)}>Continue to payment</button>
      </div></div>;
  }
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
    <div className="pb-[calc(8rem+env(safe-area-inset-bottom))]">
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

      <div className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-app bg-paper-raised border-t border-line px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-nav flex flex-col gap-3">
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
