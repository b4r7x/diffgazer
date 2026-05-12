import { StrictMode, type ReactNode } from "react";
import { KeyboardProvider } from "../providers/keyboard-provider";

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
