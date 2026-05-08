"use client";

import { useEffect } from "react";
import { useKeyboardRegistryContext } from "../context/keyboard-context.js";

interface UseScopeOptions {
  enabled?: boolean;
}

export function useScope(name: string | null, options: UseScopeOptions = {}): void {
  const { enabled = true } = options;
  const { pushScope } = useKeyboardRegistryContext();

  useEffect(() => {
    if (!enabled || name === null) return;
    return pushScope(name);
  }, [pushScope, name, enabled]);
}
