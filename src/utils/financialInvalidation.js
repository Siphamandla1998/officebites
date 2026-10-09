let revision = 0;
const listeners = new Set();
export function invalidateFinancialData() { revision++; for (const listener of listeners) listener(); }
export function financialRevision() { return revision; }
export function subscribeFinancialData(listener) { listeners.add(listener); return () => listeners.delete(listener); }
