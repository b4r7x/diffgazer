import { createContext } from "react";

export interface KeyboardContextValue {
  registerGlobalHandler: (hotkey: string, handler: () => void) => () => void;
  setInputActive: (active: boolean) => void;
  setModalActive: (active: boolean) => void;
  setReviewStreaming: (streaming: boolean, onCancel?: () => void) => void;
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null);
