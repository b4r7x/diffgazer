import type { FixPlanStep } from "@diffgazer/core/schemas/review";
import { Checkbox } from "@diffgazer/ui/components/checkbox";
import { cn } from "@diffgazer/ui/lib/utils";

export interface FixPlanChecklistProps {
  steps: FixPlanStep[];
  completedSteps: Set<number>;
  onToggle: (stepIndex: number) => void;
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
        const isComplete = completedSteps.has(index);
        return (
          <Checkbox
            // biome-ignore lint/suspicious/noArrayIndexKey: fix-plan step numbers can repeat; rendered index is the completion identity.
            key={index}
            checked={isComplete}
            onChange={() => onToggle(index)}
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
