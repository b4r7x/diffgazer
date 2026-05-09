"use client";

import { useId, useLayoutEffect } from "react";
import { useKeyboardRegistryContext } from "../context/keyboard-context.js";

interface UseScopeOptions {
  enabled?: boolean;
}

export function useScope(name: string | null, options: UseScopeOptions = {}): void {
  const { enabled = true } = options;
  const { pushScope } = useKeyboardRegistryContext();
  const order = useId();

  useLayoutEffect(() => {
    if (!enabled || name === null) return;
    return pushScope(name, order);
  }, [pushScope, name, enabled, order]);
}
