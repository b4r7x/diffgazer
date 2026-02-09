import { PanelHeader } from '@diffgazer/ui';
import { MetricItem } from './metric-item';
import { Timer } from './timer';
import type { ReviewProgressMetrics } from '@diffgazer/schemas/ui';

interface ReviewMetricsFooterProps {
  metrics: ReviewProgressMetrics;
  startTime?: Date;
  isRunning: boolean;
}

export function ReviewMetricsFooter({ metrics, startTime, isRunning }: ReviewMetricsFooterProps) {
  return (
    <div className="shrink-0 pt-4 pb-6 border-t border-tui-border">
      <PanelHeader variant="section-bordered">Metrics</PanelHeader>
      <div className="space-y-3 pt-2">
        <MetricItem
          label="Files Processed"
          value={metrics.filesTotal > 0
            ? `${metrics.filesProcessed}/${metrics.filesTotal}`
            : `${metrics.filesProcessed}/...`
          }
        />
        <MetricItem
          label="Issues Found"
          value={metrics.issuesFound}
          variant={metrics.issuesFound > 0 ? 'warning' : 'default'}
        />
        <MetricItem
          label="Elapsed"
          value={<Timer startTime={startTime} running={isRunning} />}
          variant="info"
        />
      </div>
    </div>
  );
}
