import {
  buildReviewMetricsRows,
  type ReviewProgressMetrics,
} from "@diffgazer/core/schemas/presentation";
import { KeyValue } from "@diffgazer/ui/components/key-value";
import { Panel } from "@diffgazer/ui/components/panel";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { Timer } from "./timer";

interface ReviewMetricsFooterProps {
  metrics: ReviewProgressMetrics;
  startTime?: Date;
}

export function ReviewMetricsFooter({ metrics, startTime }: ReviewMetricsFooterProps) {
  const rows = buildReviewMetricsRows(metrics, <Timer startTime={startTime} />);

  return (
    // px-0: the progress pane's wrapper already owns the px-4 column. text-base
    // keeps the metric values at the pane's size, not the footer's xs default.
    <Panel.Footer className="block px-0 pt-4 pb-6 text-base">
      <SectionHeader variant="muted" bordered className="mb-2">
        Metrics
      </SectionHeader>
      <KeyValue className="pt-2">
        {rows.map((row) => (
          <KeyValue.Item key={row.id} label={row.label} value={row.value} variant={row.tone} />
        ))}
      </KeyValue>
    </Panel.Footer>
  );
}
