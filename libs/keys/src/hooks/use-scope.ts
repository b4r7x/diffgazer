"use client";

import { useId, useLayoutEffect } from "react";
import { useKeyboardRegistryContext } from "../providers/keyboard-context.js";

/** Options for pushing a named keyboard scope. */
export interface UseScopeOptions {
  /** Whether the scope is active. When false, the scope is not pushed. */
  enabled?: boolean;
}

/**
 * Pushes a named scope onto the keyboard scope stack and automatically pops it
 * when disabled or unmounted.
 */
export function useScope(name: string | null, options: UseScopeOptions = {}): string | null {
  const { enabled = true } = options;
  const { pushScope } = useKeyboardRegistryContext();
  const order = useId();

  useLayoutEffect(() => {
    if (!enabled || name === null) return;
    return pushScope(name, order);
  }, [pushScope, name, enabled, order]);

  return enabled && name !== null ? name : null;
}
