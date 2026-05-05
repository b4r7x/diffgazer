"use client";

import { createContext, useContext } from "react";
import type { StepStatus } from "@/lib/step-status";

export type { StepStatus };
export type SubstepStatus = "pending" | "active" | "completed" | "error";

export interface StepperContextValue {
  expandedIds: string[];
  onToggle: (id: string) => void;
}

export const StepperContext = createContext<StepperContextValue | undefined>(undefined);

export function useStepperContext() {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error("Stepper parts must be used within a Stepper");
  }
  return context;
}

export interface StepperStepContextValue {
  stepId: string;
  isExpanded: boolean;
  status: StepStatus;
  triggerId: string;
  contentId: string;
}

export const StepperStepContext = createContext<StepperStepContextValue | undefined>(undefined);

export function useStepperStepContext() {
  const context = useContext(StepperStepContext);
  if (!context) {
    throw new Error("StepperTrigger/StepperContent must be used within StepperStep");
  }
  return context;
}
