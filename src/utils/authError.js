export function authError(error) {
  const code = error?.code || error?.error_code || 'AUTH_UNAVAILABLE';
  const messages = {
    invalid_credentials: 'Could not sign in. Check your email and password for this OfficeBites environment.',
    email_not_confirmed: 'Confirm your email address before signing in.',
    user_banned: 'This account is unavailable. Contact OfficeBites support.',
    over_request_rate_limit: 'Too many sign-in attempts. Please wait before trying again.',
    refresh_token_not_found: 'Your session has expired. Please sign in again.',
    refresh_token_already_used: 'Your session could not be restored. Please sign in again.',
  };
  const failure = new Error(messages[code] || 'Authentication could not be completed. Please retry or contact support.');
  failure.code = /^[A-Z0-9_]+$/i.test(String(code)) ? String(code) : 'AUTH_UNAVAILABLE';
  failure.status = Number(error?.status) || undefined;
  return failure;
}
