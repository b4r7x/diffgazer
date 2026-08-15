"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

type ControllableStateBase<T> = {
  /** Initial value for uncontrolled mode. */
  defaultValue: T;
  /** Called when the value changes, in both controlled and uncontrolled modes. */
  onChange?: (value: T) => void;
};

/** Options for a value that can be controlled by props or owned internally. */
export type UseControllableStateOptions<T> =
  | (ControllableStateBase<T> & {
      /** Explicitly selects controlled mode when the controlled value can be undefined. */
      controlled: true;
      /** Controlled value. Required when controlled is true. */
      value: T;
    })
  | (ControllableStateBase<T> & {
      /** Explicitly selects uncontrolled mode. */
      controlled: false;
      value?: never;
    })
  | (ControllableStateBase<T> & {
      controlled?: undefined;
      /** Controlled value. When provided, the component is in controlled mode. */
      value?: T;
    });

type ResolvedControllableState<T> =
  | { isControlled: true; controlledValue: T }
  | { isControlled: false; controlledValue: undefined };

function resolveControllableState<T>(
  options: UseControllableStateOptions<T>,
): ResolvedControllableState<T> {
  if (options.controlled === true) {
    return { isControlled: true, controlledValue: options.value };
  }
  if (options.controlled === false) {
    return { isControlled: false, controlledValue: undefined };
  }
  if (options.value !== undefined) {
    return { isControlled: true, controlledValue: options.value };
  }
  return { isControlled: false, controlledValue: undefined };
}

/**
 * Generic controlled/uncontrolled state hook.
 *
 * Returns the current value, its public setter, a boolean that reports whether
 * the consumer controls the value, and a silent uncontrolled reset setter.
 */
export function useControllableState<T>(options: UseControllableStateOptions<T>) {
  const { defaultValue, onChange } = options;
  const resolvedState = resolveControllableState(options);
  const { isControlled, controlledValue } = resolvedState;
  const [internal, setInternal] = useState(defaultValue);
  const internalRef = useRef(internal);

  const current = isControlled ? controlledValue : internal;

  // Effect-synced Radix useCallbackRef pattern: read the controlled value and
  // consumer onChange through a ref so setValue stays referentially stable.
  const latest = useRef<ResolvedControllableState<T> & { onChange?: (value: T) => void }>({
    ...resolvedState,
    onChange,
  });

  // Latest-ref sync: public setter is called from consumer event handlers, where useEffectEvent is forbidden; runs every render by design.
  useLayoutEffect(() => {
    latest.current = { ...resolvedState, onChange };
  });

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    const latestState = latest.current;
    const previous = latestState.isControlled ? latestState.controlledValue : internalRef.current;
    const resolved = typeof next === "function" ? (next as (prev: T) => T)(previous) : next;

    if (Object.is(previous, resolved)) return;

    if (!latestState.isControlled) {
      internalRef.current = resolved;
      setInternal(resolved);
    }

    latestState.onChange?.(resolved);
  }, []);

  const resetValue = useCallback((next: T) => {
    if (latest.current.isControlled || Object.is(internalRef.current, next)) return;
    internalRef.current = next;
    setInternal(next);
  }, []);

  return [current, setValue, isControlled, resetValue] as const;
}
