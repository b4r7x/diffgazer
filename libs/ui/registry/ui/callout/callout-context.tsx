"use client";

import { createContext, useContext } from "react";

export type CalloutTone = "info" | "warning" | "error" | "success";

export interface CalloutContextValue {
  tone: CalloutTone;
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
