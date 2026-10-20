import { useRequestGuard } from '../../hooks/useRequestGuard';
import { validateMobile } from '../../utils/mobile';
import { checkoutService } from '../../services/checkoutService';
import { manualPaymentService, manualRequestKey } from '../../services/manualPaymentService';
import { useAsync } from '../../hooks/useAsync';
import { useOperationalRefresh } from '../../hooks/useOperationalRefresh';
import { useLocation } from '../../context/LocationContext';
import RequestError from '../../components/ui/RequestError';
import { useEffect, useId, useRef, useState } from "react";
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
import { FiChevronDown, FiShoppingBag, FiUser } from "react-icons/fi";

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
  const { data: deliveryConfig, error: deliveryError, loading: deliveryLoading, refetch: reloadDelivery } = useAsync(checkoutService.deliverySettings, [], null);
  const vendorId = items[0]?.vendorId;
  const gateways = useAsync(() => vendorId ? manualPaymentService.methods(vendorId) : Promise.resolve({}), [vendorId, user?.id], {});
  const otherGateways = useAsync(checkoutService.gateways, [user?.id], []);
  const [showOtherMethods, setShowOtherMethods] = useState(false);
  const otherMethodsId = useId();
  useOperationalRefresh(() => Promise.all([gateways.refetch({ silent: true }), otherGateways.refetch({ silent: true })]), 'checkout-gateways', 30000);
  const [paymentMethod, setPaymentMethod] = useState('manual_payshap');
  const requestKey = useRef(null);
  const singleVendor = new Set(items.map(item => item.vendorId)).size === 1;
  const selectedMethod = gateways.data?.[paymentMethod] === true ? paymentMethod : gateways.data?.manual_payshap === true ? 'manual_payshap' : 'manual_eft';
  const paymentAvailable = singleVendor && gateways.data?.[selectedMethod] === true;
  const otherMethods = Array.isArray(otherGateways.data) ? otherGateways.data.filter(method => !['manual_payshap', 'manual_eft'].includes(method.provider)) : [];
  const geo = useLocation();
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const quoteLock = useRef(false);
  const cartKey = JSON.stringify(items.map(item => ({ mealId: item.mealId, qty: item.qty })));
  const quoteScope = `${user?.id || guestDetails.phone}:${cartKey}`;
  const currentQuoteScope = useRef(quoteScope);
  currentQuoteScope.current = quoteScope;
  const usableQuote = quote?.scope === quoteScope ? quote : null;
  useEffect(() => { setQuote(null); setQuoting(false); quoteLock.current = false; }, [quoteScope]);
  const requestQuote = async () => {
    if (quoteLock.current || !validateGuest()) return;
    const lock = Symbol(); quoteLock.current = lock; setQuoting(true); setQuote(null);
    const scope = quoteScope;
    const current = requests.capture();
    try {
      const location = await geo.requestLocation();
      if (!location || !current() || currentQuoteScope.current !== scope) return;
      const result = await checkoutService.quote(location, items, isAuthenticated ? null : validateMobile(guestDetails.phone).value);
      if (current() && currentQuoteScope.current === scope) setQuote({ ...result, scope, expiresAt: Date.now() + result.expiresInSeconds * 1000 });
    } catch (failure) { if (current()) showToast(failure.message, { type: 'error' }); }
    finally { if (quoteLock.current === lock) { quoteLock.current = false; if (current()) setQuoting(false); } }
  };

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
    const mobile = validateMobile(guestDetails.phone);
    if (!mobile.valid) next.phone = mobile.message;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handlePlaceOrder = async () => {
    if (creating.current || createdOrder) return;
    if (deliveryLoading || deliveryError) return;
    if (gateways.loading || gateways.error || !paymentAvailable) return;
    if (deliveryConfig?.enabled && (!usableQuote?.id || usableQuote.expiresAt <= Date.now())) {
      showToast('Calculate and review delivery before ordering.', { type: 'info' }); return;
    }
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
      const payloadKey = JSON.stringify([user?.id, guestDetails, deliveryDateKey(deliveryDate), deliveryLocation.trim(), cartKey, usableQuote?.id, selectedMethod]);
      if (requestKey.current?.payload !== payloadKey) requestKey.current = { payload: payloadKey, ...await manualRequestKey(payloadKey) };
      const order = await orderService.createOrder({
        customerId: isAuthenticated ? user.id : null,
        customerName: isAuthenticated ? user.name : guestDetails.name,
        guestContact: isAuthenticated ? null : validateMobile(guestDetails.phone).value,
        guestEmail: null,
        deliveryDate: deliveryDateKey(deliveryDate),
        deliveryLocation: deliveryLocation.trim(),
        cartItems: items,
        quoteId: deliveryConfig?.enabled ? usableQuote.id : null,
        paymentMethod: selectedMethod,
        requestId: requestKey.current.id,
      });
      // Preserve the completed guest order even if navigation changed while
      // the server was creating it. Only current-scope UI/cart effects follow.
      const persisted = isAuthenticated || addGuestOrder({
        id: order.id,
        ticketNumber: order.ticketNumber,
        contact: validateMobile(guestDetails.phone).value,
      });
      requestKey.current.clear();
      if (!current()) return;
      setCreatedOrder(order);
      if (!persisted) {
        clearCart();
        return;
      }

      clearCart();

      showToast(
        "Order created — continue to payment options",
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
        <RequestError error={deliveryError} onRetry={reloadDelivery} />
        {deliveryConfig?.enabled && <section className="card p-4 flex flex-col gap-3">
          <p>Delivery uses the OfficeBites hub unless an administrator has approved a vendor origin. Every vendor must serve your destination. Your typed address gives delivery instructions; use your device location to calculate distance.</p>
          <button className="btn-outline" disabled={quoting} onClick={requestQuote}>{quoting ? 'Checking delivery…' : 'Use my location and calculate delivery'}</button>
          {geo.error && <p role="alert">{geo.error} Retry location. If location is unavailable, contact support before ordering; no delivery fee is guessed.</p>}
          {usableQuote?.id && <><p>Maximum delivery distance {Number(usableQuote.distanceKm).toFixed(2)} km · Delivery {formatCurrency(usableQuote.fee)} · Total {formatCurrency(subtotal + Number(usableQuote.fee))}. Delivery is charged once per checkout. Quote valid for five minutes.</p>{usableQuote.vendors?.map(v => <p key={v.vendorId}>{v.vendorName} · {v.mode === 'VENDOR' ? 'Approved vendor location' : 'OfficeBites hub'} · {Number(v.distanceKm).toFixed(2)} km</p>)}</>}
        </section>}
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
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                maxLength={24}
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
            One vendor per checkout. Pay that food vendor directly through your banking app.
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
        <section className="card p-4 flex flex-col gap-3" aria-label="Payment methods">
          <fieldset disabled={submitting || gateways.loading || !!gateways.error || !singleVendor} className="flex flex-col gap-2">
            <legend className="font-semibold mb-3">Pay the vendor directly</legend>
            {gateways.data?.manual_payshap === true && <label className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm cursor-pointer has-[:checked]:border-nude-500 has-[:checked]:bg-nude-50"><input type="radio" name="method" value="manual_payshap" checked={selectedMethod === 'manual_payshap'} onChange={() => setPaymentMethod('manual_payshap')} className="accent-nude-700 shrink-0" /> PayShap — recommended where supported</label>}
            {gateways.data?.manual_eft === true && <label className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm cursor-pointer has-[:checked]:border-nude-500 has-[:checked]:bg-nude-50"><input type="radio" name="method" value="manual_eft" checked={selectedMethod === 'manual_eft'} onChange={() => setPaymentMethod('manual_eft')} className="accent-nude-700 shrink-0" /> Bank transfer (EFT)</label>}
            {gateways.loading && <p className="text-sm text-ink-muted" role="status">Checking this vendor's payment methods…</p>}
          </fieldset>
          <button type="button" className="btn-outline w-full flex items-center justify-between gap-3" aria-expanded={showOtherMethods} aria-controls={otherMethodsId} onClick={() => setShowOtherMethods(value => !value)}>
            Other Payment Methods
            <FiChevronDown aria-hidden="true" className={`shrink-0 transition-transform ${showOtherMethods ? 'rotate-180' : ''}`} />
          </button>
          <div id={otherMethodsId} hidden={!showOtherMethods}>
            {otherGateways.loading ? <p className="text-sm text-ink-muted" role="status">Checking other payment methods…</p> : otherGateways.error ? <div className="flex flex-col gap-2"><p className="text-sm" role="status">Other payment methods are unavailable right now.</p><button type="button" className="btn-outline" onClick={() => otherGateways.refetch()}>Retry other payment methods</button></div> : <div className="flex flex-col gap-2">
              {otherMethods.map(method => {
                const name = ({ payfast: 'PayFast', ozow: 'Ozow' })[method.provider] || 'Additional payment method';
                const status = method.provider === 'payfast' ? 'Unavailable for vendor orders' : method.provider === 'ozow' ? 'Not available yet' : method.maintenance ? 'Temporarily unavailable' : 'Unavailable for this order';
                return <label key={method.provider} className="flex items-start gap-3 rounded-xl border border-line bg-paper p-3">
                  <input type="radio" name="method" value={method.provider} disabled checked={false} readOnly className="mt-1 shrink-0" />
                  <span className="min-w-0 text-sm"><span className="block font-semibold text-ink-soft">{name}</span><span className="block text-ink-muted">{status}</span></span>
                </label>;
              })}
              {otherMethods.length === 0 && <p className="text-sm text-ink-muted">No other payment methods are available for this order.</p>}
              <p className="text-xs text-ink-muted">Unavailable methods cannot be used for this order. Choose an available vendor-direct option above.</p>
            </div>}
          </div>
          <p className="text-sm">The vendor confirms receipt and handles refunds. OfficeBites coordinates support through <Link to="/support" className="underline">Support</Link>. Bank transfers are not automatically refunded.</p>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-app bg-paper-raised border-t border-line px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-nav flex flex-col gap-3">
        {!singleVendor && <p role="alert">Please complete one vendor order at a time. Remove the other vendor’s items before checkout.</p>}
        <RequestError error={gateways.error} onRetry={gateways.refetch} />
        {!gateways.loading && !gateways.error && !paymentAvailable && <p role="status" className="text-sm">Payments are temporarily unavailable. Your cart is saved. Please try again later.</p>}
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">Total</span>
          <span className="font-bold text-ink text-base">{deliveryConfig?.enabled && !usableQuote ? 'Calculate delivery first' : formatCurrency(subtotal + (deliveryConfig?.enabled ? Number(usableQuote?.fee || 0) : 0))}</span>
        </div>
        <button onClick={handlePlaceOrder} className="btn-primary w-full" disabled={submitting || gateways.loading || !!gateways.error || !paymentAvailable || deliveryLoading || !!deliveryError || (deliveryConfig?.enabled && !usableQuote?.id)}>
          {submitting ? <Spinner size={16} className="!border-paper/30 !border-t-paper" /> : "Place order"}
        </button>
      </div>
    </div>
  );
}
