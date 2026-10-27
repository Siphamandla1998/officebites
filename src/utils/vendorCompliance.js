export const complianceKinds = { identity: 'Identity and trading details', food_premises: 'Food and premises approvals', coa: 'Certificate of Acceptability', operations: 'Operational readiness' };
export const bankingFields = { accountHolder: 'Account holder', bank: 'Bank', accountNumber: 'Account number', accountType: 'Account type', branchCode: 'Branch code', shapId: 'Registered ShapID' };
export function complianceExpiry(date) { return date ? new Date(`${date}T23:59:59+02:00`).toISOString() : null; }
export function complianceStatus(event) { return event?.valid_until && Date.parse(event.valid_until) <= Date.now() ? 'expired' : event?.status || 'pending documents'; }
