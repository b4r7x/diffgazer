import { cn } from "@/utils/cn";
import type { OnboardingStep } from "../types";

const STEP_LABELS: Record<OnboardingStep, string> = {
  storage: "Storage",
  provider: "Provider",
  "api-key": "API Key",
  model: "Model",
  analysis: "Analysis",
  execution: "Execution",
};

interface WizardProgressProps {
  steps: OnboardingStep[];
  currentStep: OnboardingStep;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="flex items-center gap-1 font-mono text-[10px]">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        return (
          <div key={step} className="flex items-center gap-1">
            {index > 0 && (
              <span
                className={cn(
                  "mx-0.5",
                  isCompleted ? "text-tui-green" : "text-tui-border",
                )}
              >
                -
              </span>
            )}
            <span
              className={cn(
                "px-1.5 py-0.5",
                isActive && "bg-tui-blue text-black font-bold",
                isCompleted && "text-tui-green",
                !isActive && !isCompleted && "text-tui-muted",
              )}
            >
              {STEP_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
