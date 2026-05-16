import type { ReactNode } from "react";
import type { ReviewMetadata } from "@diffgazer/core/schemas/review";
import { getRunSummaryParts, type SeverityPart } from "@diffgazer/core/review";

const SEVERITY_BASE_CLASS: Record<SeverityPart["severity"], string> = {
  blocker: "text-tui-red",
  high: "text-tui-yellow",
  medium: "text-tui-blue",
  low: "text-tui-cyan",
  nit: "text-tui-muted",
};

export function severityChipClass(severity: SeverityPart["severity"]): string {
  return `${SEVERITY_BASE_CLASS[severity]} group-data-[active]:text-primary-foreground/85`;
}

export function getRunSummary(metadata: ReviewMetadata): ReactNode {
  const summary = getRunSummaryParts(metadata);

  if (summary.passed) return "Passed with no issues.";

  if (summary.parts.length === 0) {
    return `Found ${summary.issueCount} issue${summary.issueCount === 1 ? "" : "s"}.`;
  }

  const rendered: ReactNode[] = summary.parts.flatMap((part, index) => {
    const chip = (
      <span key={part.severity} className={severityChipClass(part.severity)}>
        {part.count} {part.severity}
      </span>
    );
    return index === 0 ? [chip] : [<span key={`${part.severity}-sep`}>, </span>, chip];
  });

  return <>{rendered}</>;
}
