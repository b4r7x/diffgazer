"use client";

import { createContext, useContext } from "react";
import type { StepStatus } from "@/lib/step-status";
import type { StepperVariant } from "@/lib/stepper-variants";

export type { StepStatus };

/** Allowed substep status values. */
export type SubstepStatus = "pending" | "active" | "completed" | "error";

/** Context value shared by stepper. */
export interface StepperContextValue {
  /** Controlled set of currently expanded step ids. */
  expandedIds: string[];
  /** Called when an item should toggle. */
  onToggle: (id: string) => void;
  /** Visual variant. Controls the indicator glyph and connector treatment across every step. */
  variant: StepperVariant;
  /** DOM id for tab target. */
  tabTargetId: string | null;
  /** Registers step with stepper. */
  registerStep: (
    registrationId: string,
    descriptor: { id: string; status: StepStatus; label: string | undefined },
    element: HTMLElement | null,
  ) => void;
  /** Unregisters step from stepper. */
  unregisterStep: (registrationId: string) => void;
}

/** React context backing stepper. */
export const StepperContext = createContext<StepperContextValue | undefined>(undefined);

/** Reads the stepper context. */
export function useStepperContext() {
  const context = useContext(StepperContext);
  if (!context) {
    throw new Error("Stepper parts must be used within a Stepper");
  }
  return context;
}

/** Context value shared by stepper step. */
export interface StepperStepContextValue {
  /** Stable identifier matched against expandedIds. */
  stepId: string;
  /** Whether stepper step is expanded. */
  isExpanded: boolean;
  /**
   * Step status. Drives the indicator glyph, label styling, aria-current, aria-disabled, and
   * tab-order eligibility.
   */
  status: StepStatus;
  /** DOM id for trigger. */
  triggerId: string;
  /** DOM id for content. */
  contentId: string;
  /** Whether stepper step has content. */
  hasContent: boolean;
  /** Updates trigger label. */
  setTriggerLabel: (label: string | undefined) => void;
}

/** React context backing stepper step. */
export const StepperStepContext = createContext<StepperStepContextValue | undefined>(undefined);

/** Reads the stepper step context. */
export function useStepperStepContext() {
  const context = useContext(StepperStepContext);
  if (!context) {
    throw new Error("StepperTrigger/StepperContent must be used within StepperStep");
  }
  return context;
}
