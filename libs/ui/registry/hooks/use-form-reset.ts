"use client";

import { useEffectEvent, useLayoutEffect, type RefObject } from "react";

export function useFormReset<T>(
  ref: RefObject<HTMLElement | null>,
  resetValue: T,
  onReset: (value: T) => void,
  enabled = true,
) {
  const handleReset = useEffectEvent(() => {
    onReset(resetValue);
  });

  useLayoutEffect(() => {
    const form = enabled ? ref.current?.closest("form") ?? null : null;
    if (!form) return;

    const listener = () => handleReset();
    form.addEventListener("reset", listener);
    return () => form.removeEventListener("reset", listener);
  });
}
