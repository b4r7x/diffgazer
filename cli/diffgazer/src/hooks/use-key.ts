import { useContext, useEffect, useEffectEvent } from "react";
import { KeyboardContext } from "../app/providers/keyboard-provider.js";

export function useKey(hotkey: string, handler: () => void, scope?: string): void {
  const ctx = useContext(KeyboardContext);
  if (!ctx) {
    throw new Error("useKey must be used within a TerminalKeyboardProvider");
  }

  const resolvedScope = scope ?? ctx.activeScope;
  const stableHandler = useEffectEvent(handler);
  const { registerHandler } = ctx;

  useEffect(() => {
    if (!resolvedScope) return;
    return registerHandler(resolvedScope, hotkey, stableHandler);
  }, [resolvedScope, hotkey, registerHandler]);
}
