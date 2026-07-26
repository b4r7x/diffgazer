"use client";

import { createContext, useContext } from "react";

/** Allowed callout tone values. */
export type CalloutTone = "info" | "warning" | "error" | "success";

/** Context value shared by callout. */
export interface CalloutContextValue {
  /** Semantic tone - drives color and default icon. */
  tone: CalloutTone;
  /** Called when dismiss occurs. */
  onDismiss: () => void;
}

export const CalloutContext = createContext<CalloutContextValue | undefined>(undefined);

export function useCalloutContext() {
  const context = useContext(CalloutContext);
  if (!context) {
    throw new Error("Callout compound components must be used within a Callout");
  }
  return context;
}
