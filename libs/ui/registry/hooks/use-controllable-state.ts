"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/** Options for a value that can be controlled by props or owned internally. */
export interface UseControllableStateOptions<T> {
  /** Controlled value. When provided, the component is in controlled mode. */
  value?: T;
  /** Explicitly selects controlled mode when the controlled value can be undefined. */
  controlled?: boolean;
  /** Initial value for uncontrolled mode. */
  defaultValue: T;
  /** Called when the value changes, in both controlled and uncontrolled modes. */
  onChange?: (value: T) => void;
}

/**
 * Generic controlled/uncontrolled state hook.
 *
 * Returns the current value, a setter that accepts direct values or updater
 * functions, and a boolean that reports whether the consumer controls the value.
 */
export function useControllableState<T>({
  value: controlledValue,
  controlled,
  defaultValue,
  onChange,
}: UseControllableStateOptions<T>) {
  const [internal, setInternal] = useState(defaultValue);
  const internalRef = useRef(internal);

  const isControlled = controlled ?? controlledValue !== undefined;
  const current = isControlled ? (controlledValue as T) : internal;

  // Effect-synced Radix useCallbackRef pattern: read the controlled value and
  // consumer onChange through a ref so setValue stays referentially stable.
  const latest = useRef({ isControlled, controlledValue, onChange });

  useLayoutEffect(() => {
    latest.current = { isControlled, controlledValue, onChange };
  });

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    const {
      isControlled: controlledNow,
      controlledValue: valueNow,
      onChange: onChangeNow,
    } = latest.current;
    const previous = controlledNow ? (valueNow as T) : internalRef.current;
    const resolved = typeof next === "function" ? (next as (prev: T) => T)(previous) : next;

    if (Object.is(previous, resolved)) return;

    if (!controlledNow) {
      internalRef.current = resolved;
      setInternal(resolved);
    }

    onChangeNow?.(resolved);
  }, []);

  return [current, setValue, isControlled] as const;
}
