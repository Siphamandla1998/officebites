import { useEffect, useRef } from 'react';
export function useOperationalRefresh(refresh, key, interval = 10000) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!key) return;
    let active = true, running = false;
    const update = async () => {
      if (!active || running || document.visibilityState === 'hidden') return;
      running = true;
      try { await latest.current(); } finally { running = false; }
    };
    const timer = setInterval(update, interval);
    window.addEventListener('focus', update);
    window.addEventListener('pageshow', update);
    document.addEventListener('visibilitychange', update);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('pageshow', update); document.removeEventListener('visibilitychange', update); };
  }, [key, interval]);
}
