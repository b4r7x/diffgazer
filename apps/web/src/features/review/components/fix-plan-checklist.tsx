import { cn } from "@/utils/cn";
import type { FixPlanStep } from "@stargazer/schemas/review";

export interface FixPlanChecklistProps {
  steps: FixPlanStep[];
  completedSteps: Set<number>;
  onToggle: (step: number) => void;
  className?: string;
}

export function FixPlanChecklist({ steps, completedSteps, onToggle, className }: FixPlanChecklistProps) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      {steps.map((step) => {
        const isComplete = completedSteps.has(step.step);
        return (
          <button
            type="button"
            key={step.step}
            className="flex gap-2 cursor-pointer w-full text-left"
            onClick={() => onToggle(step.step)}
            aria-pressed={isComplete}
          >
            <span className={isComplete ? "text-tui-green" : "text-tui-fg"} aria-hidden="true">
              [{isComplete ? "x" : " "}]
            </span>
            <span className={isComplete ? "text-tui-muted line-through" : ""}>{step.action}</span>
          </button>
        );
      })}
    </div>
  );
}
