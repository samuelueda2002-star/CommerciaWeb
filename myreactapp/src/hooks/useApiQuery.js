import { useEffect, useRef, useState } from 'react';

export default function useApiQuery(loader, key, enabled = true) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ data: null, error: null, loading: true, key });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ data: null, error: null, loading: true, key });
    Promise.resolve().then(() => loaderRef.current(controller.signal)).then((data) => {
      if (!controller.signal.aborted) setState({ data, error: null, loading: false, key });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ data: null, error, loading: false, key });
    });
    return () => controller.abort();
  }, [key, attempt, enabled]);

  if (!enabled) return { data: null, error: null, loading: false, retry: () => setAttempt((value) => value + 1) };
  const current = state.key === key ? state : { data: null, error: null, loading: true };
  return { ...current, retry: () => setAttempt((value) => value + 1) };
}
