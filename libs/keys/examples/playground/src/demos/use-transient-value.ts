import { useEffect, useRef, useState } from "react";

export function useTransientValue<T>(initialValue: T, timeoutMs: number) {
  const [value, setValue] = useState(initialValue);
  const timeoutRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timeoutRef.current === null) return;
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const show = (nextValue: T) => {
    clearTimer();
    setValue(nextValue);
    timeoutRef.current = window.setTimeout(() => {
      setValue(initialValue);
      timeoutRef.current = null;
    }, timeoutMs);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return [value, show] as const;
}
