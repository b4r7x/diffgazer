import { useContext } from "react";
import { KeyboardContext, type KeyboardContextValue } from "../providers/keyboard-provider.js";

export function useKeyboardContext(): KeyboardContextValue {
  const ctx = useContext(KeyboardContext);
  if (ctx === undefined) {
    throw new Error("useKeyboardContext must be used within KeyboardProvider");
  }
  return ctx;
}

export function useOptionalKeyboardContext(): KeyboardContextValue | null {
  return useContext(KeyboardContext) ?? null;
}
