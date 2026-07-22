import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import type { FileProgress } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import type { ProgressStepWithSubstepsData } from "@diffgazer/core/schemas/presentation";
import { Box } from "ink";
import type { ReactElement } from "react";
import { ProgressList } from "../../../../components/shared/progress/list";
import { SectionHeader } from "../../../../components/ui/section-header";
import { AgentBoard } from "../agent-board";
import { ContextSnapshotPreview } from "../context-snapshot-preview";
import { ReviewMetricsFooter } from "../metrics-footer";

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
  const agentRows = Math.max(height - progressRows - 11, 1);

  return (
    <Box flexDirection="column" width={width} height={height} overflow="hidden">
      <SectionHeader variant="muted" bordered>
        Progress Overview
      </SectionHeader>
      <Box flexDirection="column" paddingTop={1}>
        <ProgressList steps={progressSteps} />
      </Box>

      {agents.length > 0 && !hasCompletedSnapshot ? (
        <Box flexDirection="column" marginTop={1}>
          <AgentBoard agents={agents} maxRows={agentRows} />
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

      <Box marginTop={1}>
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
