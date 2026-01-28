"use client";

import { useEffect } from "react";
import { useKeyboardContext } from "./use-keyboard-context";

interface UseScopeOptions {
  enabled?: boolean;
}

export function useScope(name: string, options: UseScopeOptions = {}) {
  const { enabled = true } = options;
  const { pushScope } = useKeyboardContext();

  useEffect(() => {
    if (!enabled) return;
    return pushScope(name);
  }, [name, pushScope, enabled]);
}
