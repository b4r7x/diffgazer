import type { ReactNode } from "react";
import type { ReviewMetadata } from "@diffgazer/core/schemas/review";
import type { TimelineItem } from "@diffgazer/core/schemas/ui";
import {
  buildTimelineItems as coreBuildTimelineItems,
  getRunSummaryParts,
  type SeverityPart,
} from "@diffgazer/core/review";

const SEVERITY_CLASS: Record<SeverityPart["severity"], string> = {
  blocker: "text-tui-red",
  high: "text-tui-yellow",
  medium: "text-tui-blue",
  low: "text-tui-cyan",
  nit: "text-tui-muted",
};

export function getRunSummary(metadata: ReviewMetadata): ReactNode {
  const summary = getRunSummaryParts(metadata);

  if (summary.passed) return "Passed with no issues.";

  if (summary.parts.length === 0) {
    return `Found ${summary.issueCount} issue${summary.issueCount === 1 ? "" : "s"}.`;
  }

  const rendered: ReactNode[] = [];
  summary.parts.forEach((part, index) => {
    if (index > 0) rendered.push(", ");
    rendered.push(
      <span key={part.severity} className={SEVERITY_CLASS[part.severity]}>
        {part.count} {part.severity}
      </span>,
    );
  });

  return <>{rendered}</>;
}

export function buildTimelineItems(reviews: ReviewMetadata[]): TimelineItem[] {
  return coreBuildTimelineItems(reviews);
}
