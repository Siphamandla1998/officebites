// Payment comes from stored suborder payment status, never from a redirect,
// storefront approval or a fulfilment label.
export function paymentState(order) {
  const states = (order?.subOrders || []).map(s => s.paymentStatus);
  if (!states.length) return 'unknown';
  if (states.every(s => s === 'paid')) return 'paid';
  if (states.some(s => s === 'paid')) return 'partial';
  if (states.some(s => s === 'verifying')) return 'verifying';
  if (states.every(s => s === 'unpaid')) return 'unpaid';
  return 'unknown';
}
export function canRetryPayment(order) {
  return order?.status === 'pending_payment' && paymentState(order) === 'unpaid';
}
export function isFulfilled(order) {
  return order?.status === 'completed' && paymentState(order) === 'paid' &&
    order.subOrders.every(s => s.status === 'completed');
}
export function displayOrderStatus(order) {
  const fulfilment = ['confirmed','accepted','preparing','ready','collected','completed'].includes(order?.status);
  if (fulfilment && paymentState(order) !== 'paid') return 'status_review';
  return order?.status === 'completed' && !isFulfilled(order) ? 'status_review' : order?.status;
}
export function paymentMessage(order) {
  if (order?.status === 'cancelled') return 'This order has been cancelled. Contact support if a payment needs review.';
  if (isFulfilled(order)) return 'Your order is complete. Thank you for ordering with OfficeBites.';
  const state = paymentState(order);
  if (state === 'paid') return 'Your payment is confirmed. Track your order for vendor acceptance and fulfilment updates.';
  if (state === 'verifying' || order?.status === 'payment_submitted') return 'Your payment is awaiting verification. Do not pay again while verification is pending.';
  if (state === 'unpaid') return 'Payment is still required. If your bank shows a debit, wait for confirmation or contact support before paying again.';
  return 'Payment status needs review. Refresh your order or contact support before making another payment.';
}
