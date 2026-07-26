"use client";

import { createContext, useContext } from "react";
import type { HorizontalStepStatus, StepStatus } from "@/lib/step-status";
import type { HorizontalStepperVariant } from "./horizontal-stepper-variants";

export type { HorizontalStepStatus, StepStatus };

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
  /** True when the compact treatment is forced instead of left to the container query. */
  compact: boolean;
}

export const HorizontalStepperContext = createContext<StepperContextValue | undefined>(undefined);

export function useHorizontalStepperContext() {
  const ctx = useContext(HorizontalStepperContext);
  if (ctx === undefined) {
    throw new Error("HorizontalStepperStep must be used within a HorizontalStepper");
  }
  return ctx;
}

export function useStepInfo(value: string): {
  status: HorizontalStepStatus;
  index: number;
  total: number;
  /** Index of the active step, so a step can tell how far it sits from the window centre. */
  activeIndex: number;
} {
  const { value: currentValue, steps } = useHorizontalStepperContext();
  const stepIndex = steps.indexOf(value);
  const currentIndex = steps.indexOf(currentValue);
  const total = steps.length;
  const info = { index: stepIndex, total, activeIndex: currentIndex };

  if (stepIndex === currentIndex) return { status: "active", ...info };
  if (stepIndex < currentIndex) return { status: "completed", ...info };
  return { status: "pending", ...info };
}
