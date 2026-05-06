"use client";

import { useEffect } from "react";
import { useKeyboardContext } from "../context/keyboard-context.js";

interface UseScopeOptions {
  enabled?: boolean;
}

export function useScope(name: string | null, options: UseScopeOptions = {}): void {
  const { enabled = true } = options;
  const { pushScope } = useKeyboardContext();

  useEffect(() => {
    if (!enabled || name === null) return;
    return pushScope(name);
  }, [pushScope, name, enabled]);
}
