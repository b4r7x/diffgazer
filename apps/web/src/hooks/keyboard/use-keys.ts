"use client";

import { useEffect, useEffectEvent } from "react";
import { useKeyboardContext } from "./use-keyboard-context";

interface UseKeysOptions {
  enabled?: boolean;
}

export function useKeys(
  keys: readonly string[],
  handler: (key: string, index: number) => void,
  options?: UseKeysOptions
) {
  const { register, activeScope } = useKeyboardContext();

  const stableHandler = useEffectEvent(handler);

  const keysKey = keys.join(',');

  useEffect(() => {
    if (options?.enabled === false) return;
    if (!activeScope) return;

    const cleanups = keys.map((key, i) =>
      register(activeScope, key, () => stableHandler(key, i))
    );
    return () => cleanups.forEach(cleanup => cleanup());
  }, [register, activeScope, keysKey, options?.enabled]);
}
