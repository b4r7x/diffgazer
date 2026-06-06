"use client";

import { useId, useLayoutEffect } from "react";
import { useKeyboardRegistryContext } from "../providers/keyboard-context.js";

export interface UseScopeOptions {
  enabled?: boolean;
}

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
