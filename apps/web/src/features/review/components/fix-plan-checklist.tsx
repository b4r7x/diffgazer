import type { IssueFixStepPresentation } from "@diffgazer/core/review";
import { Checkbox } from "@diffgazer/ui/components/checkbox";
import { cn } from "@diffgazer/ui/lib/utils";

/**
 * Marks the checklist root so the details keyboard hook can find the rendered
 * step checkboxes and move real DOM focus between them. The hook resolves it
 * inside the details scroll body it already owns, so the marker never has to be
 * unique document-wide.
 */
export const FIX_PLAN_CHECKLIST_SELECTOR = '[data-checklist="fix-plan"]';

export interface FixPlanChecklistProps {
  steps: readonly IssueFixStepPresentation[];
  completedSteps: ReadonlySet<number>;
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
    <div data-checklist="fix-plan" className={cn("space-y-1 text-sm", className)}>
      {steps.map((step) => {
        const isComplete = completedSteps.has(step.completionIndex);
        return (
          <Checkbox
            key={step.completionIndex}
            data-value={String(step.completionIndex)}
            checked={isComplete}
            onChange={() => onToggle(step.completionIndex)}
            onFocus={() => onFocusedIndexChange?.(step.completionIndex)}
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
            // One focus grammar at a time: while real DOM focus sits on the row
            // its ring is the marker, so the collection highlight (fill, left
            // bar, bold) yields. data-highlighted stays on as the remembered
            // step position for when focus parks elsewhere.
            className={cn(
              "w-full",
              "data-highlighted:focus:bg-transparent data-highlighted:focus:font-normal data-highlighted:focus:border-l-transparent",
            )}
          />
        );
      })}
    </div>
  );
}
