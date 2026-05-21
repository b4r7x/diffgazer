"use client";

import { createContext, useContext } from "react";
import type { StepStatus } from "@/lib/step-status";
import type { StepperVariant } from "@/lib/stepper-variants";

export type { StepStatus };

/**
 * Sub-steps retain the original four-state lifecycle. The six-state expansion
 * applies to top-level steps where `skipped`/`disabled` carry workflow
 * semantics; sub-steps describe agent activity within an active step, where
 * those states are not meaningful.
 */
export type SubstepStatus = "pending" | "active" | "completed" | "error";

export interface StepperContextValue {
  expandedIds: string[];
  onToggle: (id: string) => void;
  variant: StepperVariant;
  /** Stable id of the trigger that owns the single roving tab stop. */
  tabTargetId: string | null;
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
  hasContent: boolean;
}

export const StepperStepContext = createContext<StepperStepContextValue | undefined>(undefined);

export function useStepperStepContext() {
  const context = useContext(StepperStepContext);
  if (!context) {
    throw new Error("StepperTrigger/StepperContent must be used within StepperStep");
  }
  return context;
}
