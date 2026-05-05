"use client";

import { createContext, useContext } from "react";

export type CalloutVariant = "info" | "warning" | "error" | "success";

export const textColorByVariant: Record<CalloutVariant, string> = {
  info: "text-info-fg",
  warning: "text-warning-fg",
  error: "text-error-fg",
  success: "text-success-fg",
};

export interface CalloutContextValue {
  variant: CalloutVariant;
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
