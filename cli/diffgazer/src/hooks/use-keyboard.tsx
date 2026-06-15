import { createContext } from "react";

export interface KeyboardContextValue {
  registerGlobalHandler: (hotkey: string, handler: () => void) => () => void;
  setInputActive: (active: boolean) => void;
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null);
