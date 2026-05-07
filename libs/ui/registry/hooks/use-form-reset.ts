"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, type RefObject } from "react";

export function useFormReset<T>(
  ref: RefObject<HTMLElement | null>,
  resetValue: T,
  onReset: (value: T) => void,
  enabled = true,
) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const listenerRef = useRef<(() => void) | null>(null);
  const handleReset = useEffectEvent(() => {
    onReset(resetValue);
  });
  listenerRef.current ??= () => handleReset();

  useLayoutEffect(() => {
    const nextForm = enabled ? ref.current?.closest("form") ?? null : null;
    if (formRef.current === nextForm) return;

    const listener = listenerRef.current;
    if (!listener) return;

    formRef.current?.removeEventListener("reset", listener);
    nextForm?.addEventListener("reset", listener);
    formRef.current = nextForm;
  });

  useEffect(() => {
    return () => {
      const listener = listenerRef.current;
      if (listener) formRef.current?.removeEventListener("reset", listener);
      formRef.current = null;
    };
  }, []);
}
