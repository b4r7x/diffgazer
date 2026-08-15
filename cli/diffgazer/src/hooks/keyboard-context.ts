import { createContext } from "react";

export interface KeyboardContextValue {
  registerGlobalHandler: (hotkey: string, handler: () => void) => () => void;
  /** True while some app-level handler already owns the key, so screen-local bindings can stand down. */
  hasGlobalHandler: (hotkey: string) => boolean;
  setInputActive: (active: boolean) => void;
  setModalActive: (active: boolean) => void;
  setReviewStreaming: (streaming: boolean, onCancel?: () => void) => void;
}

export const KeyboardContext = createContext<KeyboardContextValue | null>(null);
