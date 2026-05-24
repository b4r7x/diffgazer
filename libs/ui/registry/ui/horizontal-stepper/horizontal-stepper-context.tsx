"use client";

import { createContext, useContext } from "react";
import type { StepStatus } from "@/lib/step-status";
import type { HorizontalStepperVariant } from "@/lib/stepper-variants";

export type { StepStatus };

export type HorizontalStepStatus = Extract<StepStatus, "active" | "completed" | "pending">;

interface StepperContextValue {
  value: string;
  steps: string[];
  variant: HorizontalStepperVariant;
}

export const HorizontalStepperContext = createContext<StepperContextValue | undefined>(undefined);

export function useStepperContext() {
  const ctx = useContext(HorizontalStepperContext);
  if (ctx === undefined) {
    throw new Error("HorizontalStepperStep must be used within a HorizontalStepper");
  }
  return ctx;
}

export function useStepInfo(value: string): { status: HorizontalStepStatus; index: number } {
  const { value: currentValue, steps } = useStepperContext();
  const stepIndex = steps.indexOf(value);
  const currentIndex = steps.indexOf(currentValue);

  if (stepIndex === currentIndex) return { status: "active", index: stepIndex };
  if (stepIndex < currentIndex) return { status: "completed", index: stepIndex };
  return { status: "pending", index: stepIndex };
}
