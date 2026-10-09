import { useEffect, useRef } from 'react';
import { createRequestScope } from '../utils/requestScope';
export function useRequestGuard(key) {
  const scope = useRef(null);
  if (!scope.current) scope.current = createRequestScope();
  scope.current.set(key);
  useEffect(() => () => scope.current.invalidate(), [key]);
  return scope.current;
}
