"use client";

import { useState, useEffectEvent } from "react";

export interface UseControllableStateOptions<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}

export function useControllableState<T>({
  value: controlledValue,
  defaultValue,
  onChange,
}: UseControllableStateOptions<T>) {
  const [internal, setInternal] = useState(defaultValue);

  const current = controlledValue !== undefined ? controlledValue : internal;

  const setValue = useEffectEvent((next: T | ((prev: T) => T)) => {
    if (controlledValue !== undefined) {
      const resolved = typeof next === "function"
        ? (next as (prev: T) => T)(current)
        : next;
      onChange?.(resolved);
    } else {
      setInternal((prev) => {
        const resolved = typeof next === "function"
          ? (next as (prev: T) => T)(prev)
          : next;
        onChange?.(resolved);
        return resolved;
      });
    }
  });

  return [current, setValue, controlledValue !== undefined] as const;
}
