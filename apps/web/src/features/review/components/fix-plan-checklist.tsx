import { cn } from "@diffgazer/core/cn";
import { Checkbox } from "@diffgazer/ui/components/checkbox";
import type { FixPlanStep } from "@diffgazer/core/schemas/review";

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
          <Checkbox
            key={step.step}
            checked={isComplete}
            onChange={() => onToggle(step.step)}
            label={step.action}
            strikethrough
            className="w-full"
          />
        );
      })}
    </div>
  );
}
