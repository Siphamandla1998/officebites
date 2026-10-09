import { useSyncExternalStore } from 'react';
import { financialRevision, subscribeFinancialData } from '../utils/financialInvalidation';
export function useFinancialRevision() { return useSyncExternalStore(subscribeFinancialData, financialRevision, financialRevision); }
