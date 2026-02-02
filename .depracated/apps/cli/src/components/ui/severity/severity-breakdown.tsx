import type { ReactElement } from "react";
import { Box } from "ink";
import type { SeverityCounts } from "@repo/schemas/ui";
import { SEVERITY_ORDER, SEVERITY_LABELS } from "@repo/schemas/ui";
import { Panel, PanelHeader, PanelContent } from "../layout/index.js";
import { SeverityBar } from "./severity-bar.js";

export interface SeverityBreakdownProps {
  counts: SeverityCounts;
  title?: string;
  borderless?: boolean;
  barWidth?: number;
}

export function SeverityBreakdown({
  counts,
  title = "Severity Breakdown",
  borderless,
  barWidth,
}: SeverityBreakdownProps): ReactElement {
  const maxCount = Math.max(...SEVERITY_ORDER.map((s) => counts[s]), 1);

  return (
    <Panel borderless={borderless}>
      <PanelHeader>{title}</PanelHeader>
      <PanelContent spacing="none">
        <Box flexDirection="column">
          {SEVERITY_ORDER.map((severity) => (
            <SeverityBar
              key={severity}
              label={SEVERITY_LABELS[severity]}
              count={counts[severity]}
              max={maxCount}
              severity={severity}
              barWidth={barWidth}
            />
          ))}
        </Box>
      </PanelContent>
    </Panel>
  );
}
