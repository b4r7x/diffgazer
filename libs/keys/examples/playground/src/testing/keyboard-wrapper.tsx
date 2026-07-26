import { KeyboardProvider } from "@diffgazer/keys";
import type { ReactNode } from "react";

/** Mirrors main.tsx so demo tests render under the same provider as the app. */
export function KeyboardWrapper({ children }: { children: ReactNode }) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}
