// Allowlisted admin guidance; never display raw database/network diagnostics.
export function manualSettingsError(error) {
  if (error?.code === '40001') return 'Server settings changed. Reload settings and review your draft before saving.';
  if (error?.code === '42501' || /Active admin/i.test(error?.message || '')) return 'An active administrator session is required. Sign in again, then reload settings.';
  if (error?.code === 'PGRST202' || error?.code === '42883') return 'The reviewed settings update is not installed. Ask the operator to review the backend release; no automatic fallback was attempted.';
  if (/collection|authoris|unlock/i.test(error?.message || '')) return 'The payment activation gate rejected this change. Keep payments disabled and ask the release operator to review readiness.';
  if (error?.code === '23514' || error?.code === '22023') return 'Review the deadline, threshold and change reason before saving.';
  return 'The save outcome could not be confirmed. Check your connection and reload settings before another save.';
}
