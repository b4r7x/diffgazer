import { Box } from "ink";
import { SeverityBar } from "./severity-bar.js";

export interface SeverityBreakdownProps {
  issues: Array<{ severity: string; count: number }>;
}

export function SeverityBreakdown({ issues }: SeverityBreakdownProps) {
  const total = issues.reduce((sum, i) => sum + i.count, 0);
  const visible = issues.filter((i) => i.count > 0);

  return (
    <Box flexDirection="column">
      {visible.map((issue) => (
        <SeverityBar
          key={issue.severity}
          severity={issue.severity}
          count={issue.count}
          total={total}
        />
      ))}
    </Box>
  );
}
