import { useCallback, useEffect, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!msg) return undefined;
    const id = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(id);
  }, [msg]);
  const toast = useCallback((m) => setMsg(m), []);
  return { toastMsg: msg, toast };
}
