import { useContext, useEffect } from "react";
import { KeyboardContext } from "./keyboard-context";

export function useInputMode(isActive: boolean): void {
  const ctx = useContext(KeyboardContext);
  const setInputActive = ctx?.setInputActive;

  useEffect(() => {
    if (!setInputActive || !isActive) return;
    setInputActive(true);
    return () => setInputActive(false);
  }, [isActive, setInputActive]);
}
