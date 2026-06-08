import type { ReactNode } from "react";
import { TerminalKeyboardProvider as SurfaceTerminalKeyboardProvider } from "../../hooks/use-keyboard";

interface TerminalKeyboardProviderProps {
  children: ReactNode;
}

export function TerminalKeyboardProvider({ children }: TerminalKeyboardProviderProps) {
  return <SurfaceTerminalKeyboardProvider>{children}</SurfaceTerminalKeyboardProvider>;
}
