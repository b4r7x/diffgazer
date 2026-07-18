"use client";

import { type RefObject, useCallback, useEffectEvent, useLayoutEffect, useRef } from "react";

interface FormSubscription {
  form: HTMLFormElement;
  listener: (event: Event) => void;
}

interface ControlledFormResetHandlers {
  syncResetBaseline: () => void;
  onReset: () => void;
}

function resolveForm(element: HTMLElement | null): HTMLFormElement | null {
  if (!element) return null;
  const formId = element.getAttribute("form");
  if (formId === null) return element.closest("form");
  const form = element.ownerDocument.getElementById(formId);
  const FormElement = element.ownerDocument.defaultView?.HTMLFormElement;
  return FormElement && form instanceof FormElement ? form : null;
}

/** Keeps custom form controls aligned with native reset semantics. */
export function useFormReset<T>(
  ref: RefObject<HTMLElement | null>,
  resetValue: T,
  onReset: (value: T) => void,
  isUncontrolled = true,
  controlled?: ControlledFormResetHandlers,
) {
  const resetGenerationRef = useRef(0);
  const invalidatePendingReset = useCallback(() => {
    resetGenerationRef.current += 1;
  }, []);
  const handleReset = useEffectEvent(() => {
    if (isUncontrolled) {
      onReset(resetValue);
      return;
    }
    controlled?.onReset();
  });
  const syncControlledResetBaseline = useEffectEvent(() => {
    controlled?.syncResetBaseline();
  });

  // Track the attached form so target swaps don't churn the listener every render.
  const subscriptionRef = useRef<FormSubscription | null>(null);

  // Latest-ref sync: controlled reset baselines must reflect the latest value before native reset handling.
  useLayoutEffect(() => {
    if (isUncontrolled || !controlled) return;
    syncControlledResetBaseline();
  });

  // Latest-ref sync: form ownership can change through refs, so subscription reconciliation must run every render.
  useLayoutEffect(() => {
    const nextForm = isUncontrolled || controlled ? resolveForm(ref.current) : null;
    const current = subscriptionRef.current;
    if (current?.form === nextForm) return;

    if (current) {
      invalidatePendingReset();
      current.form.removeEventListener("reset", current.listener);
      subscriptionRef.current = null;
    }

    if (!nextForm) return;

    const listener = (event: Event) => {
      const resetGeneration = resetGenerationRef.current + 1;
      resetGenerationRef.current = resetGeneration;
      queueMicrotask(() => {
        if (event.defaultPrevented) return;
        if (resetGenerationRef.current !== resetGeneration) return;
        handleReset();
      });
    };
    nextForm.addEventListener("reset", listener);
    subscriptionRef.current = { form: nextForm, listener };
  });

  useLayoutEffect(() => {
    return () => {
      invalidatePendingReset();
      const current = subscriptionRef.current;
      if (!current) return;
      current.form.removeEventListener("reset", current.listener);
      subscriptionRef.current = null;
    };
  }, [invalidatePendingReset]);

  return invalidatePendingReset;
}
