import type { ContextType } from "react";
import { useContext } from "react";
import { KeyboardContext } from "./keyboard-provider";

type KeyboardContextValue = NonNullable<ContextType<typeof KeyboardContext>>;

export function useKeyboardContext(): KeyboardContextValue {
  const ctx = useContext(KeyboardContext);
  if (ctx === undefined) {
    throw new Error("useKeyboardContext must be used within KeyboardProvider");
  }
  return ctx;
}
