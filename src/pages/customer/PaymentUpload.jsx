import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import RequestError from '../../components/ui/RequestError';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useOperationalRefresh } from '../../hooks/useOperationalRefresh';
import { useRequestGuard } from '../../hooks/useRequestGuard';
import { manualPaymentService } from '../../services/manualPaymentService';
import { paymentService } from '../../services/paymentService';
import { getGuestOrderAccess } from '../../utils/guest';
import { formatCurrency } from '../../utils/formatters';

export default function PaymentUpload() {
  const { orderId } = useParams();
  const { user } = useAuth();
  const guard = useRequestGuard(`${user?.id || 'guest'}:${orderId}`);
  const result = useAsync(() => manualPaymentService.instructions(orderId), [orderId, user?.id], null);
  useOperationalRefresh(() => result.refetch({ silent: true }), `manual:${orderId}:${user?.id}`, 15000);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const payment = result.data;
  const expired = payment && new Date(payment.deadline).getTime() <= Date.now();
  async function action(fn) {
    if (lock.current) return;
    const current = guard.capture(); lock.current = true;setBusy(true);setFailure(null);
    try { await fn(); if (current()) await result.refetch({ throwOnError: true }); }
    catch (error) { if (current()) setFailure(error); }
    finally { lock.current = false; if (current()) setBusy(false); }
  }
  async function copy(value) {
    try { await navigator.clipboard.writeText(String(value));setMessage('Copied'); }
    catch { setMessage('Copy unavailable. Select and copy the value shown.'); }
  }
  const fields = payment ? [
    ['Vendor', payment.vendor], ['Recipient', payment.destination.accountHolder], ['Bank', payment.destination.bank],
    ...(payment.method === 'manual_payshap' ? [['Registered ShapID', payment.destination.shapId]] : [
      ['Account number', payment.destination.accountNumber], ['Account type', payment.destination.accountType], ['Branch code', payment.destination.branchCode],
    ]), ['Exact amount', formatCurrency(payment.amount)], ['Payment reference', payment.reference],
  ] : [];
  return <div className="pb-8"><Navbar showBack title="Pay the vendor" showCart={false} />
    <main className="ob-container pt-4 flex flex-col gap-4">
      <RequestError error={failure || result.error} onRetry={result.refetch} />
      {result.loading && <p role="status">Loading protected payment instructions…</p>}
      {payment && <>
        <h1 className="text-xl font-bold">{payment.method === 'manual_payshap' ? 'PayShap' : 'Bank transfer (EFT)'}</h1>
        <p>{payment.state === 'awaiting_payment' && !expired ? 'Pay the vendor directly through your banking app. Your order will be confirmed once the vendor verifies receipt of payment.' : 'These are the original payment details for your order. Do not send another payment while receipt or order status is being reviewed.'}</p>
        <p className="font-semibold">Check the recipient name in your banking app before sending money.</p>
        <dl className="card p-4 flex flex-col gap-3">{fields.filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0"><dt className="text-xs text-ink-muted">{label}</dt><dd className="font-semibold break-all">{value}</dd></div>
          <button className="btn-outline" aria-label={`Copy ${label}`} onClick={() => copy(value)}>Copy</button>
        </div>)}</dl>
        <button type="button" className="btn-outline min-h-11" onClick={() => copy(fields.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join('\n'))}>Copy Payment Details</button>
        <p>In your banking app, choose {payment.method === 'manual_payshap' ? 'PayShap and enter the registered ShapID' : 'bank transfer and enter the account details'}, check the recipient, then enter the exact amount and reference above.</p>
        <p>Pay by {new Date(payment.deadline).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} (SAST).</p>
        <p role="status">{payment.state === 'paid' ? 'Payment confirmed. Track your order for fulfilment.' : payment.state === 'cancelled' ? 'Order cancelled. Do not send money. Contact support if you already paid.' : expired ? 'Payment deadline passed. Do not send money or pay again. Contact support if you already paid.' : payment.state === 'payment_reported' ? 'Payment reported. Awaiting independent verification; do not pay again.' : payment.state === 'under_review' || payment.state === 'disputed' ? 'Payment under review. Contact support; do not pay again.' : 'Awaiting payment.'}</p>
        {payment.disputed && <p role="alert">Payment disputed. Fulfilment is on hold pending admin review. Do not pay again.</p>}
        {payment.refundStatus && <p role="status">Vendor refund: {payment.refundStatus.replaceAll('_',' ')}. OfficeBites does not send an automatic bank refund.</p>}
        {message && <p role="status">{message}</p>}
        <button type="button" className="btn-primary min-h-11" disabled={busy || expired || payment.state !== 'awaiting_payment'} onClick={() => action(() => manualPaymentService.report(orderId))}>I've made payment</button>
        <p className="text-sm">Reporting payment does not confirm receipt or authorise fulfilment. The vendor must independently verify the money received.</p>
        <p className="text-sm">The vendor handles refunds after checking their bank account. OfficeBites can help coordinate a dispute. A proof of payment alone does not confirm receipt.</p>
        {!expired && payment.state === 'awaiting_payment' && <button className="btn-outline" disabled={busy} onClick={() => {
          if (window.confirm('Cancel this unpaid order? If you already transferred money, contact support instead. A bank transfer cannot be cancelled here.')) void action(() => paymentService.cancelUnpaidOrder(orderId, getGuestOrderAccess(orderId)));
        }}>Cancel unpaid order</button>}
      </>}
      <Link className="btn-outline" to={`/orders/${orderId}`}>Track order</Link>
      <Link className="btn-outline min-h-11" to="/help/contact">Contact Support</Link>
      {!payment && !result.loading && <p>Historical gateway payments remain in your order history. Contact support for reconciliation. New gateway payments are unavailable.</p>}
    </main>
  </div>;
}
