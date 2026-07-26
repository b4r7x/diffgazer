import {
  buildReviewMetricsRows,
  type ReviewProgressMetrics,
} from "@diffgazer/core/schemas/presentation";
import { KeyValue } from "@diffgazer/ui/components/key-value";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { Timer } from "./timer";

interface ReviewMetricsFooterProps {
  metrics: ReviewProgressMetrics;
  startTime?: Date;
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
          <KeyValue.Item key={row.id} label={row.label} value={row.value} variant={row.tone} />
        ))}
      </KeyValue>
    </div>
  );
}
