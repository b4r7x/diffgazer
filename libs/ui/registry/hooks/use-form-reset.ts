"use client";

import { type RefObject, useEffectEvent, useLayoutEffect, useRef } from "react";

interface FormSubscription {
  form: HTMLFormElement;
  listener: (event: Event) => void;
}

/** Registers a native form-reset listener that restores custom uncontrolled state. */
export function useFormReset<T>(
  ref: RefObject<HTMLElement | null>,
  resetValue: T,
  onReset: (value: T) => void,
  enabled = true,
) {
  const handleReset = useEffectEvent(() => {
    onReset(resetValue);
  });

  // Track the attached form so target swaps don't churn the listener every render.
  const subscriptionRef = useRef<FormSubscription | null>(null);

  useLayoutEffect(() => {
    const nextForm = enabled ? (ref.current?.closest("form") ?? null) : null;
    const current = subscriptionRef.current;
    if (current?.form === nextForm) return;

    if (current) {
      current.form.removeEventListener("reset", current.listener);
      subscriptionRef.current = null;
    }

    if (!nextForm) return;

    const listener = (event: Event) => {
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        handleReset();
      });
    };
    nextForm.addEventListener("reset", listener);
    subscriptionRef.current = { form: nextForm, listener };
  });

  useLayoutEffect(() => {
    return () => {
      const current = subscriptionRef.current;
      if (!current) return;
      current.form.removeEventListener("reset", current.listener);
      subscriptionRef.current = null;
    };
  }, []);
}
