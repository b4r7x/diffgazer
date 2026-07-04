import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  type FileProgress,
  getPartialFailureWarning,
  sanitizeTerminalText,
} from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import type {
  LogEntryData,
  ProgressStepData,
  Shortcut,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { type ReactElement, useEffect, useState } from "react";
import { ProgressList } from "../../../components/shared/progress/list";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { SectionHeader } from "../../../components/ui/section-header";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { ActivityLog } from "./activity-log";
import { AgentBoard } from "./agent-board";
import { ContextSnapshotPreview } from "./context-snapshot-preview";
import { ReviewMetricsFooter } from "./metrics-footer";

export interface ReviewProgressViewProps {
  progressSteps: ProgressStepData[];
  agents: AgentState[];
  logEntries: LogEntryData[];
  fileProgress: FileProgress;
  isStreaming: boolean;
  error: string | null;
  notices: string[];
  onCancel?: () => void;
  onViewResults?: () => void;
  issuesFound: number;
  startedAt: Date | null;
  reviewId?: string | null;
  contextSnapshot?: ReviewContextResponse | null;
}

const STREAMING_SHORTCUTS: Shortcut[] = [];
const COMPLETING_SHORTCUTS: Shortcut[] = [{ key: "Enter", label: "View Results" }];

function getResponsiveWidth(
  isWide: boolean,
  isMedium: boolean,
  widths: { wide: string; medium: string; narrow: string },
): string {
  if (isWide) return widths.wide;
  if (isMedium) return widths.medium;
  return widths.narrow;
}

export function ReviewProgressView({
  progressSteps,
  agents,
  logEntries,
  fileProgress,
  isStreaming,
  error,
  notices,
  onCancel,
  onViewResults,
  issuesFound,
  startedAt,
  reviewId,
  contextSnapshot,
}: ReviewProgressViewProps): ReactElement {
  const { tokens } = useTheme();
  const { isMedium, isWide } = useResponsive();
  const [completedAt, setCompletedAt] = useState<number | null>(null);

  useEffect(() => {
    if (isStreaming) {
      setCompletedAt(null);
      return;
    }
    setCompletedAt((current) => current ?? Date.now());
  }, [isStreaming]);

  usePageFooter({
    shortcuts: isStreaming ? STREAMING_SHORTCUTS : COMPLETING_SHORTCUTS,
  });

  const elapsed = startedAt ? (completedAt ?? Date.now()) - startedAt.getTime() : 0;

  const sideBySide = isWide || isMedium;
  const progressWidth = getResponsiveWidth(isWide, isMedium, {
    wide: "33%",
    medium: "40%",
    narrow: "100%",
  });
  const logWidth = getResponsiveWidth(isWide, isMedium, {
    wide: "67%",
    medium: "60%",
    narrow: "100%",
  });

  const partialFailure = getPartialFailureWarning(agents, error);

  const progressPane = (
    <Box flexDirection="column" width={progressWidth}>
      <SectionHeader variant="muted" bordered>
        Progress Overview
      </SectionHeader>
      <Box flexDirection="column" paddingTop={1}>
        <ProgressList steps={progressSteps} />
      </Box>

      {agents.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <AgentBoard agents={agents} />
        </Box>
      ) : null}

      {contextSnapshot && !isStreaming ? (
        <Box marginTop={1}>
          <ContextSnapshotPreview key={reviewId ?? "pending"} snapshot={contextSnapshot} />
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

  const logPane = (
    <Box flexDirection="column" width={logWidth}>
      <Box justifyContent="space-between">
        <SectionHeader variant="muted">Live Activity Log</SectionHeader>
        <Text color={tokens.muted}>tail -f agent.log</Text>
      </Box>

      {partialFailure.hasPartialFailure ? (
        <Box paddingTop={1}>
          <Callout variant="warning">
            <Callout.Title>Partial Analysis</Callout.Title>
            <Callout.Content>{sanitizeTerminalText(partialFailure.message)}</Callout.Content>
          </Callout>
        </Box>
      ) : null}

      {notices.length > 0 ? (
        <Box flexDirection="column" paddingTop={1}>
          {notices.map((notice) => (
            <Text key={notice} color={tokens.warning}>
              {sanitizeTerminalText(notice)}
            </Text>
          ))}
        </Box>
      ) : null}

      <Box paddingTop={1}>
        <ActivityLog entries={logEntries} height={progressSteps.length + 8} />
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column">
      <Box flexDirection={sideBySide ? "row" : "column"} gap={sideBySide ? 2 : 1}>
        {progressPane}
        {logPane}
      </Box>
      {error ? (
        <Box marginTop={1} marginLeft={2}>
          <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text>
        </Box>
      ) : null}
      {isStreaming && onCancel ? (
        <Box marginTop={1}>
          <Button variant="destructive" isActive onPress={onCancel}>
            Cancel
          </Button>
        </Box>
      ) : null}
      {!isStreaming && onViewResults ? (
        <Box marginTop={1}>
          <Button variant="primary" isActive onPress={onViewResults}>
            View Results
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
