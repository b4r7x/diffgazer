import type { Key } from "ink";
import { useContext, useEffect } from "react";
import { KeyboardContext } from "./use-keyboard";

export function useInputMode(isActive: boolean): void {
  const ctx = useContext(KeyboardContext);
  const setInputActive = ctx?.setInputActive;

  useEffect(() => {
    if (!setInputActive || !isActive) return;
    setInputActive(true);
    return () => setInputActive(false);
  }, [isActive, setInputActive]);
}

export function applyTextEditKey(value: string, input: string, key: Key): string | null {
  if (key.backspace) {
    return Array.from(value).slice(0, -1).join("");
  }
  if (key.return || key.escape || key.upArrow || key.downArrow || key.tab) {
    return null;
  }
  if (input.length >= 1 && !key.ctrl && !key.meta) {
    return value + input;
  }
  return null;
}
