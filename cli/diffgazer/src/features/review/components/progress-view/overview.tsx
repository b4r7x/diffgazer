import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import type { FileProgress } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import type { ProgressStepWithSubstepsData } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { SectionHeader } from "../../../../components/ui/section-header";
import { useTheme } from "../../../../theme/provider";
import { AgentBoard } from "../agent-board";
import { ContextSnapshotPreview } from "../context-snapshot-preview";
import {
  REVIEW_METRICS_COMPACT_ROWS,
  REVIEW_METRICS_FOOTER_ROWS,
  ReviewMetricsFooter,
} from "../metrics-footer";
import { ProgressList } from "../progress/list";

/**
 * Rows the overview always spends, whatever it renders: the bordered section
 * header, the progress list pad, and the bottom-anchored metrics footer with
 * its margin. Under-count any of these and the footer is pushed past the pane
 * height and clipped open, so each contribution is named rather than folded
 * into one number.
 */
function getOverviewChromeRows(metricsRows: number): number {
  return (
    2 + // "Progress Overview" heading + rule
    1 + // progress list top pad
    1 + // metrics footer top margin
    metricsRows
  );
}

/** The agent board's own chrome: top margin, bordered heading, list pad. */
const AGENT_BOARD_CHROME_ROWS = 1 + 2 + 1;
/** The same board with the pad under the rule dropped. */
const COMPACT_AGENT_BOARD_CHROME_ROWS = AGENT_BOARD_CHROME_ROWS - 1;

export interface ReviewProgressOverviewProps {
  width: string;
  height: number;
  progressSteps: ProgressStepWithSubstepsData[];
  agents: AgentState[];
  fileProgress: FileProgress;
  issuesFound: number;
  elapsed: number;
  isStreaming: boolean;
  reviewId?: string | null;
  contextSnapshot?: ReviewContextResponse | null;
  contextOutputDirectory?: string;
}

export function ReviewProgressOverview({
  width,
  height,
  progressSteps,
  agents,
  fileProgress,
  issuesFound,
  elapsed,
  isStreaming,
  reviewId,
  contextSnapshot,
  contextOutputDirectory,
}: ReviewProgressOverviewProps): ReactElement {
  const { tokens } = useTheme();
  const hasCompletedSnapshot = Boolean(contextSnapshot && !isStreaming);
  const progressRows = progressSteps.reduce(
    (total, step) => total + 1 + (step.substeps?.length ?? 0),
    0,
  );
  // A bordered metrics box that cannot fit whole draws an orphaned top border,
  // so below its budget the ledger goes borderless instead of half-drawn.
  const isCompactMetrics =
    height - progressRows - getOverviewChromeRows(REVIEW_METRICS_FOOTER_ROWS) < 0;
  const metricsRows = isCompactMetrics ? REVIEW_METRICS_COMPACT_ROWS : REVIEW_METRICS_FOOTER_ROWS;
  // The step list is told its budget instead of being clipped: a clipped list
  // can lose the active step, and that is the row the run is watched through.
  const agentRowsFloor = agents.length > 0 && !hasCompletedSnapshot ? 1 : 0;
  const listRows = Math.max(height - getOverviewChromeRows(metricsRows) - agentRowsFloor, 1);
  const visibleProgressRows = Math.min(progressRows, listRows);
  // The board keeps its pad while the pane can afford it, and drops it when
  // that row is the difference between showing the roster and showing nothing.
  const freeRows = height - visibleProgressRows - getOverviewChromeRows(metricsRows);
  const isCompactBoard = freeRows < AGENT_BOARD_CHROME_ROWS + 1;
  const boardChromeRows = isCompactBoard
    ? COMPACT_AGENT_BOARD_CHROME_ROWS
    : AGENT_BOARD_CHROME_ROWS;
  const agentRows = freeRows - boardChromeRows;
  const showAgentBoard = agents.length > 0 && !hasCompletedSnapshot && agentRows >= 1;

  return (
    <Box flexDirection="column" width={width} height={height} overflow="hidden">
      <SectionHeader variant="muted" bordered>
        Progress Overview
      </SectionHeader>
      {/* The step list yields rows first: the metrics ledger and the agent
          announcement are single lines that must never be half-drawn. */}
      <Box flexDirection="column" paddingTop={1} flexShrink={1} overflow="hidden">
        <ProgressList steps={progressSteps} maxRows={listRows} />
      </Box>

      {showAgentBoard ? (
        <Box flexDirection="column" marginTop={1} flexShrink={0} overflow="hidden">
          <AgentBoard agents={agents} maxRows={agentRows} compact={isCompactBoard} />
        </Box>
      ) : null}

      {agents.length > 0 && !showAgentBoard && !hasCompletedSnapshot ? (
        <Box height={1} flexShrink={0} overflow="hidden">
          <Text color={tokens.muted} wrap="truncate-end">
            {`${agents.length} ${agents.length === 1 ? "agent" : "agents"} running — press Tab for the log`}
          </Text>
        </Box>
      ) : null}

      {contextSnapshot && !isStreaming ? (
        <Box marginTop={1}>
          <ContextSnapshotPreview
            key={reviewId ?? "pending"}
            snapshot={contextSnapshot}
            outputDirectory={contextOutputDirectory}
            compact
          />
        </Box>
      ) : null}

      <Box marginTop={1} flexShrink={0}>
        <ReviewMetricsFooter
          metrics={{
            filesProcessed: fileProgress.completed.length,
            filesTotal: fileProgress.total,
            issuesFound,
          }}
          elapsed={elapsed}
          compact={isCompactMetrics}
        />
      </Box>
    </Box>
  );
}
