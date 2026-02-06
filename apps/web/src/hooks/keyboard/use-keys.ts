import { useEffect, useEffectEvent } from "react";
import { useKeyboardContext } from "./use-keyboard-context";

interface UseKeysOptions {
  enabled?: boolean;
}

export function useKeys(
  keys: readonly string[],
  handler: (key: string, index: number) => void,
  options?: UseKeysOptions
): void {
  const { register, activeScope } = useKeyboardContext();

  const stableHandler = useEffectEvent(handler);

  const keysKey = keys.join(",");

  useEffect(() => {
    if (options?.enabled === false) return;
    if (!activeScope) return;

    const cleanups = keys.map((key, index) =>
      register(activeScope, key, () => stableHandler(key, index))
    );

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [register, activeScope, keysKey, options?.enabled]);
}
