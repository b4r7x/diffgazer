import { cn } from "../lib/cn";

export interface HorizontalStepperStep {
  value: string;
  label: string;
}

export interface HorizontalStepperProps {
  steps: HorizontalStepperStep[];
  currentStep: string;
  className?: string;
}

export function HorizontalStepper({
  steps,
  currentStep,
  className,
}: HorizontalStepperProps) {
  const currentIndex = steps.findIndex((s) => s.value === currentStep);

  return (
    <div
      className={cn("flex items-center gap-1 font-mono text-[10px]", className)}
    >
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        return (
          <div key={step.value} className="flex items-center gap-1">
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
                isActive && "bg-tui-blue text-primary-foreground font-bold",
                isCompleted && "text-tui-green",
                !isActive && !isCompleted && "text-tui-muted",
              )}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
