"use client";

import { useState, useCallback, useRef } from "react";

export interface UseControllableStateOptions<T> {
  value?: T;
  controlled?: boolean;
  defaultValue: T;
  onChange?: (value: T) => void;
}

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

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    const previous = isControlled ? (controlledValue as T) : internalRef.current;
    const resolved = typeof next === "function"
      ? (next as (prev: T) => T)(previous)
      : next;

    if (Object.is(previous, resolved)) return;

    if (!isControlled) {
      internalRef.current = resolved;
      setInternal(resolved);
    }

    onChange?.(resolved);
  }, [controlledValue, isControlled, onChange]);

  return [current, setValue, isControlled] as const;
}
