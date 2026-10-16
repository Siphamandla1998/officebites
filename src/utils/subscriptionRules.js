// Preview/read model only. Entitlements must be recomputed on the server, never
// granted from browser flags or user metadata. No existing plan prices are changed.
export function subscriptionEligibility({ paymentStatus, approvalStatus, expiresAt, suspended, archived }, now = Date.now()) {
  return paymentStatus === 'paid' && approvalStatus === 'approved' && !suspended && !archived &&
    typeof expiresAt === 'string' && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > now;
}
