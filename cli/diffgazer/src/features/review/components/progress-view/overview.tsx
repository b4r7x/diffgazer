import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import type { FileProgress } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import type { ProgressStepWithSubstepsData } from "@diffgazer/core/schemas/presentation";
import { Box } from "ink";
import type { ReactElement } from "react";
import { SectionHeader } from "../../../../components/ui/section-header";
import { AgentBoard } from "../agent-board";
import { ContextSnapshotPreview } from "../context-snapshot-preview";
import { REVIEW_METRICS_FOOTER_ROWS, ReviewMetricsFooter } from "../metrics-footer";
import { ProgressList } from "../progress/list";

/**
 * Rows the overview always spends, whatever it renders: the bordered section
 * header, the progress list pad, and the bottom-anchored metrics footer with
 * its margin. Under-count any of these and the footer is pushed past the pane
 * height and clipped open, so each contribution is named rather than folded
 * into one number.
 */
const OVERVIEW_CHROME_ROWS =
  2 + // "Progress Overview" heading + rule
  1 + // progress list top pad
  1 + // metrics footer top margin
  REVIEW_METRICS_FOOTER_ROWS;

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
  const hasCompletedSnapshot = Boolean(contextSnapshot && !isStreaming);
  const progressRows = progressSteps.reduce(
    (total, step) => total + 1 + (step.substeps?.length ?? 0),
    0,
  );
  // The board keeps its pad while the pane can afford it, and drops it when
  // that row is the difference between showing the roster and showing nothing.
  const freeRows = height - progressRows - OVERVIEW_CHROME_ROWS;
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
      <Box flexDirection="column" paddingTop={1} flexShrink={0}>
        <ProgressList steps={progressSteps} />
      </Box>

      {showAgentBoard ? (
        <Box flexDirection="column" marginTop={1} flexShrink={0} overflow="hidden">
          <AgentBoard agents={agents} maxRows={agentRows} compact={isCompactBoard} />
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
        />
      </Box>
    </Box>
  );
}
