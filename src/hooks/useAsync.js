import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";


/**
 * Runs async service calls safely.
 * Always keeps data as an array/object fallback instead of null.
 */
export function useAsync(asyncFn, deps = []) {

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mounted = useRef(true);



  const run = useCallback(async () => {

    setLoading(true);
    setError(null);


    try {

      const result = await asyncFn();


      if (!mounted.current) return;


      // Prevent null data breaking React rendering
      setData(
        result ?? []
      );


    } catch (err) {


      if (!mounted.current) return;


      console.error(
        "useAsync error:",
        err
      );


      setError(err);


      // Keep UI alive
      setData([]);


    } finally {


      if (mounted.current) {
        setLoading(false);
      }


    }


  }, deps);



  useEffect(() => {

    mounted.current = true;

    run();


    return () => {

      mounted.current = false;

    };


  }, [run]);



  return {

    data,

    loading,

    error,

    refetch: run,

    setData,

  };

}
