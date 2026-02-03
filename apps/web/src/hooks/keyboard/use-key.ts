"use client";

import { useEffect, useEffectEvent } from "react";
import { useKeyboardContext } from "./use-keyboard-context";

interface UseKeyOptions {
  enabled?: boolean;
  allowInInput?: boolean;
}

export function useKey(
  hotkey: string,
  handler: () => void,
  options?: UseKeyOptions
): void {
  const { register, activeScope } = useKeyboardContext();

  const stableHandler = useEffectEvent(handler);

  useEffect(() => {
    if (options?.enabled === false) return;
    if (!activeScope) return;
    return register(activeScope, hotkey, stableHandler, options);
  }, [register, activeScope, hotkey, options?.enabled, options?.allowInInput, stableHandler]);
}
