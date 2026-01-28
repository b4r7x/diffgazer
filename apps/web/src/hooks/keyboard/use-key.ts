"use client";

import { useEffect, useEffectEvent } from "react";
import { useKeyboardContext } from "./use-keyboard-context";

interface UseKeyOptions {
  enabled?: boolean;
}

export function useKey(hotkey: string, handler: () => void, options?: UseKeyOptions) {
  const { register, activeScope } = useKeyboardContext();

  const stableHandler = useEffectEvent(handler);

  useEffect(() => {
    if (options?.enabled === false) return;
    if (!activeScope) return;
    return register(activeScope, hotkey, stableHandler);
  }, [register, activeScope, hotkey, options?.enabled]);
}
