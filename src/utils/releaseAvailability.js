// A missing backend contract must never become an empty successful response.
export function releaseRequestError(error, fallback) {
  const missing = error?.code === 'PGRST202' || error?.code === '42883';
  const failure = new Error(missing
    ? 'This service is unavailable while an update is being completed. Retry later or contact support. No change was saved.'
    : error?.message || fallback);
  failure.code = error?.code;
  return failure;
}
