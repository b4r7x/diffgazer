import { useEffect, useEffectEvent } from "react";
import type { HandlerOptions } from "./keyboard-provider";
import { useKeyboardContext } from "./use-keyboard-context";

interface UseKeysOptions extends HandlerOptions {
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
      register(activeScope, key, () => stableHandler(key, index), options)
    );

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [
    register,
    activeScope,
    keysKey,
    options?.enabled,
    options?.allowInInput,
    options?.targetRef,
    options?.requireFocusWithin,
    options?.preventDefault,
  ]);
}
