"use client";

import { createContext, useContext } from "react";
import type { StepStatus } from "@/lib/step-status";

export type { StepStatus };

interface StepperContextValue {
  value: string;
  steps: string[];
}

export const HorizontalStepperContext = createContext<StepperContextValue | undefined>(undefined);

export function useStepperContext() {
  const ctx = useContext(HorizontalStepperContext);
  if (ctx === undefined) {
    throw new Error("HorizontalStepperStep must be used within a HorizontalStepper");
  }
  return ctx;
}

export function useStepInfo(value: string): { status: StepStatus; index: number } {
  const { value: currentValue, steps } = useStepperContext();
  const stepIndex = steps.indexOf(value);
  const currentIndex = steps.indexOf(currentValue);

  if (stepIndex === currentIndex) return { status: "active", index: stepIndex };
  if (stepIndex < currentIndex) return { status: "completed", index: stepIndex };
  return { status: "pending", index: stepIndex };
}
