import { getRunSummaryParts, getRunSummaryText, type SeverityPart } from "@diffgazer/core/review";
import type { ReviewMetadata } from "@diffgazer/core/schemas/review";
import type { ReactNode } from "react";

const SEVERITY_BASE_CLASS: Record<SeverityPart["severity"], string> = {
  blocker: "text-severity-blocker",
  high: "text-severity-high",
  medium: "text-severity-medium",
  low: "text-severity-low",
  nit: "text-severity-nit",
};

function severityChipClass(severity: SeverityPart["severity"]): string {
  return `${SEVERITY_BASE_CLASS[severity]} group-data-[highlighted]:text-primary-foreground/85`;
}

export function getRunSummary(metadata: ReviewMetadata): ReactNode {
  const summary = getRunSummaryParts(metadata);

  // Non-chip branches reuse the core sentence so the strings never drift.
  if (summary.partial || summary.passed || summary.parts.length === 0) {
    return getRunSummaryText(metadata);
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
