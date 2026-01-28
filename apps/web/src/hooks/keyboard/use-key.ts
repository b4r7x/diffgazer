"use client";

import { useEffect } from "react";
import { useKeyboardContext } from "./use-keyboard-context";

interface UseKeyOptions {
  enabled?: boolean;
}

export function useKey(hotkey: string, handler: () => void, options?: UseKeyOptions) {
  const { register, activeScope } = useKeyboardContext();

  useEffect(() => {
    if (options?.enabled === false) return;
    if (!activeScope) return;
    return register(activeScope, hotkey, handler);
  }, [register, activeScope, hotkey, handler, options?.enabled]);
}
