import {
  buildReviewMetricsRows,
  type ReviewMetricId,
  type ReviewProgressMetrics,
} from "@diffgazer/core/schemas/presentation";
import { KeyValue } from "@diffgazer/ui/components/key-value";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { Timer } from "./timer";

interface ReviewMetricsFooterProps {
  metrics: ReviewProgressMetrics;
  startTime?: Date;
}

function getMetricVariant(id: ReviewMetricId, issuesFound: number) {
  if (id === "elapsed") return "info";
  if (id === "issues-found" && issuesFound > 0) return "warning";
  return "default";
}

export function ReviewMetricsFooter({ metrics, startTime }: ReviewMetricsFooterProps) {
  const rows = buildReviewMetricsRows(metrics, <Timer startTime={startTime} />);

  return (
    <div className="shrink-0 pt-4 pb-6 border-t border-border">
      <SectionHeader variant="muted" bordered className="mb-2">
        Metrics
      </SectionHeader>
      <KeyValue className="pt-2">
        {rows.map((row) => (
          <KeyValue.Item
            key={row.id}
            label={row.label}
            value={row.value}
            variant={getMetricVariant(row.id, metrics.issuesFound)}
          />
        ))}
      </KeyValue>
    </div>
  );
}
