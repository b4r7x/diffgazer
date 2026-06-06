import { type ReactNode, StrictMode } from "react";
import { KeyboardProvider } from "../providers/keyboard.js";

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

export function KeyboardWrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}

export function StrictKeyboardWrapper({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <KeyboardProvider>{children}</KeyboardProvider>
    </StrictMode>
  );
}
