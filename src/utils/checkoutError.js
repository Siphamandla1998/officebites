export function checkoutError(error) {
  const message = error?.message || '';
  let text;
  if (/Active approved vendor required|no longer available/i.test(message)) text = 'A vendor or meal in your cart is no longer available for orders. Remove unavailable items or choose another vendor.';
  else if (/ordering has closed/i.test(message)) text = 'Ordering has closed for the displayed delivery date. Review the delivery date before trying again.';
  else if (/customer identity|active account|suspended|JWT|PGRST30|refresh.token/i.test(message + ' ' + error?.code)) text = 'Your session could not be verified. Sign in again and review checkout.';
  else if (/guest name|required.*name/i.test(message)) text = 'Enter your name before placing a guest order.';
  else if (/mobile|guest.*contact/i.test(message)) text = 'Enter a valid mobile number before placing your order.';
  else if (/delivery location/i.test(message)) text = 'Enter your delivery location before placing your order.';
  else if (/quote|delivery policy changed|origin approval/i.test(message)) text = 'Delivery details changed or expired. Review delivery and request a new quote before ordering.';
  else if (/cart is empty/i.test(message)) text = 'Your cart is empty.';
  else if (/positive whole|quantity|duplicate meals|valid meals/i.test(message)) text = 'Review the meals and quantities in your cart before placing the order.';
  else text = 'Your order was not confirmed. Check order history before retrying, or contact support if the problem continues.';
  const failure = new Error(text);
  failure.code = typeof error?.code === 'string' && /^[A-Z0-9_]+$/i.test(error.code) ? error.code : 'CHECKOUT_UNCONFIRMED';
  return failure;
}
