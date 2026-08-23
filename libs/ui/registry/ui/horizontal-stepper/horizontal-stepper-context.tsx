"use client";

import { createContext, useContext } from "react";
import type { HorizontalStepStatus, StepStatus } from "@/lib/step-status";
import type { HorizontalStepperVariant } from "./horizontal-stepper-variants";

export type { HorizontalStepStatus, StepStatus };

interface StepperContextValue<TStep extends string = string> {
  /** Id of the active step. */
  value: TStep;
  /**
   * Ordered step ids. Used to compute status (completed/active/pending) for each step relative
   * to value.
   */
  steps: readonly TStep[];
  /** Visual variant. Controls the indicator glyph and connector treatment across every step. */
  variant: HorizontalStepperVariant;
  /** True when the compact treatment is forced instead of left to the container query. */
  compact: boolean;
  /**
   * Announces a mounted step to the root and returns its cleanup. The root's static child scan
   * cannot see steps a consumer component renders, so the mounted elements are what fix the run's
   * real order and length.
   */
  registerStep: (step: string, element: HTMLElement) => () => void;
}

export const HorizontalStepperContext = createContext<StepperContextValue | undefined>(undefined);

export function useHorizontalStepperContext<
  TStep extends string = string,
>(): StepperContextValue<TStep> {
  const ctx = useContext(HorizontalStepperContext);
  if (ctx === undefined) {
    throw new Error("HorizontalStepperStep must be used within a HorizontalStepper");
  }
  return ctx as StepperContextValue<TStep>;
}

export function useStepInfo<TStep extends string = string>(
  value: TStep,
): {
  status: HorizontalStepStatus;
  index: number;
  total: number;
  /** Index of the active step, so a step can tell how far it sits from the window centre. */
  activeIndex: number;
} {
  const { value: currentValue, steps } = useHorizontalStepperContext<TStep>();
  const stepIndex = steps.indexOf(value);
  const currentIndex = steps.indexOf(currentValue);
  const total = steps.length;
  const info = { index: stepIndex, total, activeIndex: currentIndex };

  if (stepIndex === currentIndex) return { status: "active", ...info };
  if (stepIndex < currentIndex) return { status: "completed", ...info };
  return { status: "pending", ...info };
}
