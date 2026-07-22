import type { IssueDetailsPresentation } from "@diffgazer/core/review";
import { EmptyState } from "@diffgazer/ui/components/empty-state";

export function TraceTabContent({ trace }: Pick<IssueDetailsPresentation, "trace">) {
  if (trace.length === 0) {
    return <EmptyState variant="inline">No trace data available for this issue.</EmptyState>;
  }

  return (
    <div className="space-y-2">
      {trace.map((step) => (
        <div key={step.step} className="border-l-2 border-border pl-2">
          <div className="text-foreground text-sm">
            Step {step.step}: {step.tool}
          </div>
          <div className="text-muted-foreground text-xs">
            <span>{step.input.label} </span>
            {step.input.summary}
          </div>
          <div className="text-muted-foreground text-xs">
            <span>{step.output.label} </span>
            {step.output.summary}
          </div>
        </div>
      ))}
    </div>
  );
}
