import type { IssueFixStepPresentation } from "@diffgazer/core/review";
import { Checkbox } from "@diffgazer/ui/components/checkbox";
import { cn } from "@diffgazer/ui/lib/utils";

export interface FixPlanChecklistProps {
  steps: readonly IssueFixStepPresentation[];
  completedSteps: Set<number>;
  onToggle: (stepIndex: number) => void;
  focusedStepIndex?: number | null;
  onFocusedIndexChange?: (stepIndex: number) => void;
  className?: string;
}

export function FixPlanChecklist({
  steps,
  completedSteps,
  onToggle,
  focusedStepIndex,
  onFocusedIndexChange,
  className,
}: FixPlanChecklistProps) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      {steps.map((step) => {
        const isComplete = completedSteps.has(step.completionIndex);
        return (
          <Checkbox
            key={step.completionIndex}
            checked={isComplete}
            onChange={() => onToggle(step.completionIndex)}
            onFocus={() => onFocusedIndexChange?.(step.completionIndex)}
            onClick={() => onFocusedIndexChange?.(step.completionIndex)}
            label={`${String(step.number)}. ${step.action}`}
            description={
              step.risk || step.files.length > 0 ? (
                <span className="flex flex-wrap gap-x-3">
                  {step.risk ? <span>Risk: {step.risk}</span> : null}
                  {step.files.length > 0 ? <span>Files: {step.files.join(", ")}</span> : null}
                </span>
              ) : undefined
            }
            highlighted={focusedStepIndex === step.completionIndex}
            strikethrough
            className="w-full"
          />
        );
      })}
    </div>
  );
}
