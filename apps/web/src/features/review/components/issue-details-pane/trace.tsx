import type { IssueDetailsPresentation } from "@diffgazer/core/review";
import { EmptyState } from "@diffgazer/ui/components/empty-state";
import { Panel } from "@diffgazer/ui/components/panel";

export function TraceTabContent({ trace }: Pick<IssueDetailsPresentation, "trace">) {
  if (trace.length === 0) {
    return <EmptyState variant="inline">No trace data available for this issue.</EmptyState>;
  }

  return (
    <div className="space-y-2">
      {trace.map((step) => (
        <Panel key={step.step} frame="rail" density="compact">
          <Panel.Content spacing="none">
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
          </Panel.Content>
        </Panel>
      ))}
    </div>
  );
}
