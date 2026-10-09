import { useState, useEffect, useCallback, useRef } from "react";

// Lists default to []; callers requesting one record pass null explicitly.
export function useAsync(asyncFn, deps = [], initialData = []) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const request = useRef(0);
  const initial = useRef(initialData);
  const dataGeneration = useRef(0);
  const scope = useRef({ deps, generation: 0 });
  if (deps.length !== scope.current.deps.length || deps.some((v, i) => !Object.is(v, scope.current.deps[i]))) {
    scope.current = { deps: [...deps], generation: scope.current.generation + 1 };
    request.current++;
  }
  const generation = scope.current.generation;
  const [resultScope, setResultScope] = useState(generation);

  const run = useCallback(async (options = {}) => {
    if (generation !== scope.current.generation) return;
    const current = ++request.current;
    const silent = options?.silent === true;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      if (!mounted.current || current !== request.current || generation !== scope.current.generation) return;
      dataGeneration.current = generation;
      setData(result ?? initial.current);
      setResultScope(generation);
      return result;
    } catch (err) {
      if (!mounted.current || current !== request.current || generation !== scope.current.generation) return;
      console.error("useAsync error:", err);
      setError(err);
      if (Array.isArray(err.partialData)) { setData(err.partialData); dataGeneration.current = generation; }
      else if (dataGeneration.current !== generation) setData(initial.current);
      setResultScope(generation);
      if (options?.throwOnError) throw err;
    } finally {
      if (mounted.current && current === request.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    mounted.current = true;
    run();
    return () => { mounted.current = false; };
  }, [run]);

  const setScopedData = useCallback(value => {
    if (!mounted.current || generation !== scope.current.generation) return;
    request.current++;
    dataGeneration.current = generation;
    setData(value);
    setResultScope(generation);
  }, [generation]);
  const sameScope = resultScope === generation;
  return { data: sameScope ? data : initial.current, loading: sameScope ? loading : true, error: sameScope ? error : null, refetch: run, setData: setScopedData };
}
