import type { ReviewProgressMetrics } from '@diffgazer/core/schemas/presentation';
import { KeyValue } from '@diffgazer/ui/components/key-value';
import { SectionHeader } from '@diffgazer/ui/components/section-header';
import { Timer } from './timer';

interface ReviewMetricsFooterProps {
  metrics: ReviewProgressMetrics;
  startTime?: Date;
  isRunning: boolean;
}

export function ReviewMetricsFooter({ metrics, startTime, isRunning }: ReviewMetricsFooterProps) {
  return (
    <div className="shrink-0 pt-4 pb-6 border-t border-tui-border">
      <SectionHeader variant="muted" bordered>Metrics</SectionHeader>
      <KeyValue className="pt-2">
        <KeyValue.Item
          label="Files Processed"
          value={metrics.filesTotal > 0
            ? `${metrics.filesProcessed}/${metrics.filesTotal}`
            : `${metrics.filesProcessed}/...`
          }
        />
        <KeyValue.Item
          label="Issues Found"
          value={metrics.issuesFound}
          variant={metrics.issuesFound > 0 ? 'warning' : 'default'}
        />
        <KeyValue.Item
          label="Elapsed"
          value={<Timer startTime={startTime} running={isRunning} />}
          variant="info"
        />
      </KeyValue>
    </div>
  );
}
