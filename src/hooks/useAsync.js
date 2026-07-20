import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Runs an async service call and tracks loading/error/data state.
 * `deps` re-triggers the fetch — pass [] to run once on mount.
 */
export function useAsync(asyncFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    asyncFn()
      .then((result) => mounted.current && setData(result))
      .catch((err) => mounted.current && setError(err))
      .finally(() => mounted.current && setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    run();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, refetch: run, setData };
}
