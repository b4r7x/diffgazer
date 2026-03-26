import { Box, Text } from "ink";
import { useTheme } from "../../../theme/theme-context.js";
import { useResponsive } from "../../../hooks/use-terminal-dimensions.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { ProgressList } from "./progress-list.js";
import type { ProgressStepItem } from "./progress-list.js";
import { ActivityLog } from "./activity-log.js";
import { AgentBoard } from "./agent-board.js";
import { ContextSnapshotPreview } from "./context-snapshot-preview.js";
import { ReviewMetricsFooter } from "./review-metrics-footer.js";
import type { StepState, AgentState } from "@diffgazer/schemas/events";
import type { LogEntryData } from "@diffgazer/schemas/ui";
import type { ReviewContextResponse } from "@diffgazer/api/types";
import { type FileProgress, mapStepStatus, getAgentDetail } from "@diffgazer/core/review";

export interface ReviewProgressViewProps {
  steps: StepState[];
  agents: AgentState[];
  logEntries: LogEntryData[];
  fileProgress: FileProgress;
  isStreaming: boolean;
  error: string | null;
  onCancel?: () => void;
  /** Number of issues found so far during the review. */
  issuesFound: number;
  /** Timestamp when the review stream started (used for elapsed time). */
  startedAt: Date | null;
  /** Context snapshot data, available once the context step completes. */
  contextSnapshot?: ReviewContextResponse | null;
}

function mapStepsToProgressItems(steps: StepState[], agents: AgentState[]): ProgressStepItem[] {
  return steps.map((step) => {
    const substeps = step.id === "review" && agents.length > 0
      ? agents.map((agent) => ({
          label: agent.meta.name,
          detail: getAgentDetail(agent),
        }))
      : undefined;

    return {
      id: step.id,
      label: step.label,
      status: mapStepStatus(step.status),
      substeps,
    };
  });
}

export function ReviewProgressView({
  steps,
  agents,
  logEntries,
  fileProgress,
  isStreaming,
  error,
  onCancel,
  issuesFound,
  startedAt,
  contextSnapshot,
}: ReviewProgressViewProps) {
  const { tokens } = useTheme();
  const { isMedium, isWide } = useResponsive();

  const progressItems = mapStepsToProgressItems(steps, agents);

  const filesLabel = fileProgress.total > 0
    ? `${fileProgress.completed.length}/${fileProgress.total} files`
    : fileProgress.completed.length > 0
      ? `${fileProgress.completed.length} files`
      : null;

  const elapsed = startedAt ? Date.now() - startedAt.getTime() : 0;

  const sideBySide = isWide || isMedium;
  const progressWidth = isWide ? "50%" : isMedium ? "40%" : "100%";
  const logWidth = isWide ? "50%" : isMedium ? "60%" : "100%";

  const progressPane = (
    <Box flexDirection="column" flexGrow={1} width={progressWidth}>
      <SectionHeader bordered>Progress</SectionHeader>
      <Box flexDirection="column" paddingTop={1}>
        <ProgressList steps={progressItems} />
        {filesLabel ? (
          <Box marginTop={1} marginLeft={2}>
            <Text color={tokens.muted}>{filesLabel} processed</Text>
            {fileProgress.currentFile ? (
              <Text color={tokens.muted}> — {fileProgress.currentFile}</Text>
            ) : null}
          </Box>
        ) : null}
      </Box>

      {agents.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <SectionHeader variant="muted" bordered>Agents</SectionHeader>
          <Box paddingTop={1}>
            <AgentBoard agents={agents} />
          </Box>
        </Box>
      ) : null}

      {contextSnapshot && !isStreaming ? (
        <Box marginTop={1}>
          <ContextSnapshotPreview snapshot={contextSnapshot} />
        </Box>
      ) : null}
    </Box>
  );

  const logPane = (
    <Box flexDirection="column" flexGrow={1} width={logWidth}>
      <SectionHeader bordered>Activity Log</SectionHeader>
      <Box paddingTop={1}>
        <ActivityLog entries={logEntries} height={progressItems.length + 8} />
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" borderColor={tokens.border}>
      <Box
        flexDirection={sideBySide ? "row" : "column"}
        gap={sideBySide ? 2 : 1}
      >
        {progressPane}
        {logPane}
      </Box>
      {error ? (
        <Box marginTop={1} marginLeft={2}>
          <Text color={tokens.error}>{error}</Text>
        </Box>
      ) : null}
      {onCancel && isStreaming ? (
        <Box marginTop={1}>
          <Button
            variant="destructive"
            isActive
            onPress={onCancel}
          >
            Cancel
          </Button>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <ReviewMetricsFooter
          filesProcessed={fileProgress.completed.length}
          issuesFound={issuesFound}
          elapsed={elapsed}
          isStreaming={isStreaming}
        />
      </Box>
    </Box>
  );
}
