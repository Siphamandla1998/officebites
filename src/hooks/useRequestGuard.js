import { useEffect, useRef } from 'react';
import { createRequestScope } from '../utils/requestScope';
export function useRequestGuard(key) {
  const scope = useRef(null);
  if (!scope.current) {
    const requests = createRequestScope();
    // The URL may change before a suspended route unmounts. A completion must
    // belong to the same browser navigation as well as the same account/order.
    for (const method of ['begin', 'capture']) {
      const capture = requests[method];
      requests[method] = () => {
        const current = capture();
        const href = window.location.href;
        const navigationKey = window.history.state?.key;
        return () => current() && window.location.href === href &&
          window.history.state?.key === navigationKey;
      };
    }
    scope.current = requests;
  }
  scope.current.set(key);
  useEffect(() => () => scope.current.invalidate(), [key]);
  return scope.current;
}
