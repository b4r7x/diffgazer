"use client";

import { createContext, useContext } from "react";
import type { StepStatus } from "@/lib/step-status";
import type { HorizontalStepperVariant } from "@/lib/stepper-variants";

export type { StepStatus };

/** Allowed horizontal step status values. */
export type HorizontalStepStatus = Extract<StepStatus, "active" | "completed" | "pending">;

/** Context value shared by stepper. */
interface StepperContextValue {
  /** Id of the active step. */
  value: string;
  /**
   * Ordered step ids. Used to compute status (completed/active/pending) for each step relative
   * to value.
   */
  steps: string[];
  /** Visual variant. Controls the indicator glyph and connector treatment across every step. */
  variant: HorizontalStepperVariant;
}

/** React context backing horizontal stepper. */
export const HorizontalStepperContext = createContext<StepperContextValue | undefined>(undefined);

/** Reads the stepper context. */
export function useStepperContext() {
  const ctx = useContext(HorizontalStepperContext);
  if (ctx === undefined) {
    throw new Error("HorizontalStepperStep must be used within a HorizontalStepper");
  }
  return ctx;
}

/** Provides step info behavior. */
export function useStepInfo(value: string): { status: HorizontalStepStatus; index: number } {
  const { value: currentValue, steps } = useStepperContext();
  const stepIndex = steps.indexOf(value);
  const currentIndex = steps.indexOf(currentValue);

  if (stepIndex === currentIndex) return { status: "active", index: stepIndex };
  if (stepIndex < currentIndex) return { status: "completed", index: stepIndex };
  return { status: "pending", index: stepIndex };
}
