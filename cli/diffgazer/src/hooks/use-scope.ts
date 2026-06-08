import { useContext, useEffect } from "react";
import { KeyboardContext } from "./use-keyboard";

export function useScope(name: string): void {
  const ctx = useContext(KeyboardContext);
  if (!ctx) {
    throw new Error("useScope must be used within a TerminalKeyboardProvider");
  }

  const { pushScope, popScope } = ctx;

  useEffect(() => {
    pushScope(name);
    return () => {
      popScope();
    };
  }, [name, pushScope, popScope]);
}
