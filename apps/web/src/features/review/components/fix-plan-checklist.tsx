import type { FixPlanStep } from "@diffgazer/core/schemas/review";
import { Checkbox } from "@diffgazer/ui/components/checkbox";
import { cn } from "@diffgazer/ui/lib/utils";

export interface FixPlanChecklistProps {
  steps: FixPlanStep[];
  completedSteps: Set<number>;
  onToggle: (step: number) => void;
  focusedStepIndex?: number | null;
  className?: string;
}

export function FixPlanChecklist({
  steps,
  completedSteps,
  onToggle,
  focusedStepIndex,
  className,
}: FixPlanChecklistProps) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      {steps.map((step, index) => {
        const isComplete = completedSteps.has(step.step);
        return (
          <Checkbox
            key={step.step}
            checked={isComplete}
            onChange={() => onToggle(step.step)}
            label={step.action}
            highlighted={focusedStepIndex === index}
            strikethrough
            className="w-full"
          />
        );
      })}
    </div>
  );
}
