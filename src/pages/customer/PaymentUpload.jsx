import RequestError from '../../components/ui/RequestError';
import { useAuth } from '../../context/AuthContext';
import { useRequestGuard } from '../../hooks/useRequestGuard';
import { useEffect, useRef, useState } from "react";
import Modal from '../../components/ui/Modal';
import { checkoutService } from '../../services/checkoutService';
import { useOperationalRefresh } from '../../hooks/useOperationalRefresh';
import { useNavigate, useParams } from "react-router-dom";
import { FiCreditCard } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import Spinner from "../../components/ui/Spinner";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { paymentService } from "../../services/paymentService";
import { useToast } from "../../context/ToastContext";
import { formatCurrency } from "../../utils/formatters";
import { getGuestOrderAccess } from "../../utils/guest";
import { canRetryPayment, paymentMessage } from '../../utils/orderState';

export default function PaymentUpload() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const guard = useRequestGuard(`${user?.id || 'guest'}:${orderId}`);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [payfastLoading, setPayfastLoading] = useState(false);
  const actionLock = useRef(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const gateways = useAsync(checkoutService.gateways, [], []);
  useOperationalRefresh(() => gateways.refetch({ silent: true }), 'payment-gateways', 30000);
  const payfastAvailable = gateways.data?.some(g => g.provider === 'payfast' && g.enabled && g.ready && !g.maintenance);
  const ozowAvailable = gateways.data?.some(g => g.provider === 'ozow' && g.enabled && g.ready && !g.maintenance);

  const { data: order, loading, error, refetch } = useAsync(
    () => orderService.getOrderById(orderId),
    [orderId, user?.id], null
  );

  useEffect(() => {
    setPayfastLoading(false);
    setCancelling(false); setCancelOpen(false); actionLock.current = false;
    const refresh = () => { guard.invalidate(); actionLock.current = false; setPayfastLoading(false); setCancelling(false); setCancelOpen(false); void refetch({ silent: true }); };
    window.addEventListener('pageshow', refresh);
    return () => window.removeEventListener('pageshow', refresh);
  }, [orderId, user?.id, refetch, guard]);

  const handlePayfast = async () => {
    if (payfastLoading || actionLock.current || gateways.loading || gateways.error || !payfastAvailable) return;
    const lock = Symbol(); actionLock.current = lock;
    const current = guard.begin();
    setPayfastLoading(true);

    try {
      const fresh = await refetch({ silent: true, throwOnError: true });
      if (!current()) return;
      if (!fresh?.id) throw new Error("Could not check this order. Please try again.");
      if (!canRetryPayment(fresh)) {
        setPayfastLoading(false);
        showToast("This order is no longer awaiting payment.", { type: "info" });
        navigate(`/orders/${orderId}`, { replace: true });
        return;
      }
      const guestAccess = getGuestOrderAccess(orderId);
      if (!fresh.customerId && !guestAccess?.contact) {
        throw new Error("Verify your order code and phone number on Track Order before retrying payment.");
      }

      const { processUrl, fields } =
        await paymentService.initiatePayfastPayment(
          orderId,
          guestAccess?.contact || null
        );

      if (!current()) return;
      paymentService.redirectToPayfast({ processUrl, fields });
    } catch (err) {
      if (!current()) return;
      showToast(
        err.message || "Couldn't start PayFast payment",
        { type: "error" }
      );
      setPayfastLoading(false);
    } finally {
      if (actionLock.current === lock) actionLock.current = false;
    }
  };

  const cancelPayment = async () => {
    if (actionLock.current) return;
    const lock = Symbol(); actionLock.current = lock;
    const current = guard.begin();
    setCancelling(true);
    try {
      await paymentService.cancelUnpaidOrder(orderId, getGuestOrderAccess(orderId));
      if (!current()) return;
      setCancelOpen(false);
      showToast('Unpaid order cancelled. No payment was reversed.', { type: 'info' });
      navigate(`/orders/${orderId}`, { replace: true });
    } catch (failure) {
      if (current()) showToast(failure.message || 'Cancellation was not confirmed. Refresh the order before retrying.', { type: 'error' });
    } finally {
      if (actionLock.current === lock) actionLock.current = false;
      if (current()) { setCancelling(false); void refetch({ silent: true }); }
    }
  };

  const handleOzow = async () => {
    if (actionLock.current || gateways.loading || gateways.error || !ozowAvailable) return;
    const lock = Symbol(); actionLock.current = lock;
    const current = guard.begin(); setPayfastLoading(true);
    try {
      const fresh = await refetch({ silent: true, throwOnError: true });
      if (!current()) return;
      if (!canRetryPayment(fresh)) throw new Error('Refresh your order and verify payment status before paying.');
      const guestAccess = getGuestOrderAccess(orderId);
      if (!fresh.customerId && !guestAccess?.contact) throw new Error('Verify your order code and phone number on Track Order first.');
      const redirectUrl = await paymentService.initiateOzowPayment(orderId, guestAccess?.contact || null);
      if (current()) window.location.assign(redirectUrl);
    } catch (failure) {
      if (current()) { showToast(failure.message, { type: 'error' }); setPayfastLoading(false); }
    } finally { if (actionLock.current === lock) actionLock.current = false; }
  };

  if (loading) {
    return (
      <div>
        <Navbar showBack title="Payment" showCart={false} />
        <div className="ob-container pt-4">
          <div className="skeleton h-48" />
        </div>
      </div>
    );
  }

  if (error || !order?.id) {
    return (
      <div>
        <Navbar showBack title="Payment" showCart={false} />
        <p role="alert" className="ob-container pt-4 text-sm text-ink-muted">
          Could not load this order. Please refresh or open it from your order history.
        </p>
        <RequestError error={error || new Error("Order unavailable")} onRetry={refetch} />
      </div>
    );
  }

  if (!canRetryPayment(order)) {
    return (
      <div>
        <Navbar showBack title="Payment" showCart={false} />
        <div className="ob-container pt-4 flex flex-col gap-3">
          <p className="text-sm text-ink-muted">Payment options are unavailable until the order state is verified.</p>
          <p className="text-sm text-ink-muted">{paymentMessage(order)}</p>
          <button onClick={() => navigate(`/orders/${orderId}`)} className="btn-primary">View order status</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <Navbar showBack title="Payment" showCart={false} />

      <div className="ob-container pt-4 flex flex-col gap-5">
        <div className="flex justify-between pt-1 pb-1">
          <span className="text-sm font-semibold text-ink">
            Amount due
          </span>

          <span className="text-base font-bold text-ink">
            {formatCurrency(order.total)}
          </span>
        </div>

        <div className="card p-4 flex flex-col gap-3">
          <RequestError error={gateways.error} onRetry={gateways.refetch} />
          {gateways.data?.map(g => <div key={g.provider}>{g.notice && <p>{g.notice}</p>}{g.provider === 'payfast' && !payfastAvailable && <p>PayFast is temporarily unavailable. Your order remains available for later payment.</p>}</div>)}
          <div className="h-9 w-9 rounded-lg bg-nude-100 text-nude-700 flex items-center justify-center">
            <FiCreditCard size={16} />
          </div>

          <div>
            <p className="text-sm font-semibold text-ink">
              Pay securely with PayFast
            </p>

            <p className="text-xs text-ink-muted mt-1">
              You'll be redirected to PayFast to complete your payment.
              OfficeBites will confirm your order automatically after
              PayFast verifies the transaction.
            </p>
          </div>

          <div className="rounded-xl bg-nude-50 px-3.5 py-3">
            <p className="text-xs text-ink-muted">
              This payment is for your existing order {order.ticketNumber}.
              If your bank already shows a debit, wait for confirmation or contact
              support before making another payment.
            </p>
          </div>

          <button
            onClick={() => navigate(`/orders/${orderId}`)}
            className="btn-outline w-full"
          >
            Return to order
          </button>

          <button
            onClick={handlePayfast}
            className="btn-primary w-full"
            disabled={payfastLoading || cancelling || gateways.loading || !!gateways.error || !payfastAvailable}
          >
            {payfastLoading ? (
              <Spinner
                size={16}
                className="!border-paper/30 !border-t-paper"
              />
            ) : (
              `Pay ${formatCurrency(order.total)} with PayFast`
            )}
          </button>
          <button className="btn-outline w-full" disabled={payfastLoading || cancelling} onClick={() => setCancelOpen(true)}>Cancel payment</button>
          {ozowAvailable && <button className="btn-primary w-full" disabled={payfastLoading || cancelling || gateways.loading || !!gateways.error} onClick={handleOzow}>Pay {formatCurrency(order.total)} with Ozow</button>}
          <Modal open={cancelOpen} onClose={() => { if (!cancelling) setCancelOpen(false); }} title="Cancel payment?">
            <p>Returning to your order leaves it available for payment. Confirming cancellation cancels an unpaid order only if no provider payment may be processing. A verified payment is never cancelled or refunded here.</p>
            <p>If you already opened PayFast or your bank shows a debit, return to your order and contact support for reconciliation. Leaving this page does not cancel a bank payment.</p>
            <div className="flex flex-col gap-3 mt-4">
              <button className="btn-outline" disabled={cancelling} onClick={() => { setCancelOpen(false); navigate(`/orders/${orderId}`); }}>Return to order without cancelling</button>
              <button className="btn-primary" disabled={cancelling} onClick={cancelPayment}>{cancelling ? 'Checking payment…' : 'Confirm cancel unpaid order'}</button>
            </div>
          </Modal>
        </div>
      </div>
    </div>
  );
}
