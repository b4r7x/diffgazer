import { type ReactNode, StrictMode } from "react";
import { KeyboardProvider } from "../providers/keyboard.js";

/** Dispatches a bubbling, cancelable keydown event on `window`. */
export function fireKey(key: string, options?: Partial<KeyboardEventInit>): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  window.dispatchEvent(event);
  return event;
}

/** Test wrapper that renders children inside `KeyboardProvider`. */
export function KeyboardWrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

/** Test wrapper that renders children inside StrictMode and `KeyboardProvider`. */
export function StrictKeyboardWrapper({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <KeyboardProvider>{children}</KeyboardProvider>
    </StrictMode>
  );
}
