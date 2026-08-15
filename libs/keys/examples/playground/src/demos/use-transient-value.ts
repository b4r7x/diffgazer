import { type RefObject, useEffect, useRef, useState } from "react";

function clearTimer(timeoutRef: RefObject<number | null>) {
  if (timeoutRef.current === null) return;
  window.clearTimeout(timeoutRef.current);
  timeoutRef.current = null;
}

export function useTransientValue<T>(initialValue: T, timeoutMs: number) {
  const [value, setValue] = useState(initialValue);
  const timeoutRef = useRef<number | null>(null);

  const show = (nextValue: T) => {
    clearTimer(timeoutRef);
    setValue(nextValue);
    timeoutRef.current = window.setTimeout(() => {
      setValue(initialValue);
      timeoutRef.current = null;
    }, timeoutMs);
  };

  useEffect(() => {
    return () => clearTimer(timeoutRef);
  }, []);

  return [value, show] as const;
}
