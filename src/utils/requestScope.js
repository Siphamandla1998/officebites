// Used by handlers outside useAsync: account/thread changes invalidate all work.
export function createRequestScope() {
  let scope, version = 0;
  return {
    set(key) { if (key !== scope) { scope = key; version++; } },
    invalidate() { version++; },
    begin() { const current = ++version; return () => current === version; },
    capture() { const current = version; return () => current === version; },
  };
}
