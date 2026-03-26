import { useContext, useEffect } from "react";
import { KeyboardContext } from "../app/providers/keyboard-provider.js";

export function useScope(name: string): void {
  const ctx = useContext(KeyboardContext);
  if (!ctx) {
    throw new Error("useScope must be used within a TerminalKeyboardProvider");
  }

  useEffect(() => {
    ctx.pushScope(name);
    return () => {
      ctx.popScope();
    };
  }, [name, ctx]);
}
