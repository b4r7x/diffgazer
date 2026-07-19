import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  classifyReviewStreamError,
  type FileProgress,
  getPartialFailureWarning,
  getReviewEventLogSource,
  type ReviewEvent,
  sanitizeTerminalText,
} from "@diffgazer/core/review";
import type { AgentState, LensStat } from "@diffgazer/core/schemas/events";
import {
  BACK_SHORTCUTS,
  type ProgressStepWithSubstepsData,
  type Shortcut,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text, useInput } from "ink";
import { type ReactElement, useContext, useEffect, useState } from "react";
import { getContentZoneRows } from "../../../components/layout/global";
import { ProgressList } from "../../../components/shared/progress/list";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { SectionHeader } from "../../../components/ui/section-header";
import { KeyboardContext } from "../../../hooks/use-keyboard";
import { useResponsive } from "../../../hooks/use-terminal-dimensions";
import type { BreakpointTier } from "../../../lib/breakpoints";
import { useTheme } from "../../../theme/provider";
import { ActivityLog } from "./activity-log";
import { AgentBoard } from "./agent-board";
import { ContextSnapshotPreview } from "./context-snapshot-preview";
import { ReviewMetricsFooter } from "./metrics-footer";

export interface ReviewProgressViewProps {
  progressSteps: ProgressStepWithSubstepsData[];
  agents: AgentState[];
  lensStats?: LensStat[];
  events: readonly ReviewEvent[];
  fileProgress: FileProgress;
  isStreaming: boolean;
  error: string | null;
  errorCode?: string | null;
  notices: string[];
  onCancel?: () => void;
  onBack?: () => void;
  onViewResults?: () => void;
  onGoToSettings?: () => void;
  issuesFound: number;
  startedAt: Date | null;
  completedAt: Date | null;
  reviewId?: string | null;
  contextSnapshot?: ReviewContextResponse | null;
  contextOutputDirectory?: string;
}

const STREAMING_SHORTCUTS: Shortcut[] = [{ key: "c", label: "Cancel" }];
const COMPLETING_SHORTCUTS: Shortcut[] = [{ key: "Enter", label: "View Results" }];
const SAVE_CONTEXT_SHORTCUT: Shortcut = { key: "w", label: "Save context" };
function getPaneWidths(tier: BreakpointTier): { progress: string; log: string } {
  if (tier === "wide") return { progress: "33%", log: "67%" };
  if (tier === "medium") return { progress: "40%", log: "60%" };
  return { progress: "100%", log: "100%" };
}

function getProgressShortcuts({
  isStreaming,
  hasCancel,
  hasViewResults,
  hasContextSnapshot,
  hasError,
}: {
  isStreaming: boolean;
  hasCancel: boolean;
  hasViewResults: boolean;
  hasContextSnapshot: boolean;
  hasError: boolean;
}): Shortcut[] {
  if (hasError) return [];
  if (isStreaming) return hasCancel ? STREAMING_SHORTCUTS : [];
  return [
    ...(hasViewResults ? COMPLETING_SHORTCUTS : []),
    ...(hasContextSnapshot ? [SAVE_CONTEXT_SHORTCUT] : []),
  ];
}

export function ReviewProgressView({
  progressSteps,
  agents,
  lensStats,
  events,
  fileProgress,
  isStreaming,
  error,
  errorCode,
  notices,
  onCancel,
  onBack,
  onViewResults,
  onGoToSettings,
  issuesFound,
  startedAt,
  completedAt,
  reviewId,
  contextSnapshot,
  contextOutputDirectory,
}: ReviewProgressViewProps): ReactElement {
  const { tokens } = useTheme();
  const { isMedium, isWide, rows, tier } = useResponsive();
  const keyboard = useContext(KeyboardContext);
  // Lazy now-seed: a zero seed renders a negative elapsed on the first frame
  // and permanently for runs that mount already stopped (error/abort).
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  useEffect(() => {
    keyboard?.setReviewStreaming(isStreaming, onCancel);
    return () => keyboard?.setReviewStreaming(false);
  }, [isStreaming, keyboard, onCancel]);

  useEffect(() => {
    if (!isStreaming || !startedAt || completedAt) return;

    const updateCurrentTime = () => setCurrentTime(Date.now());
    updateCurrentTime();
    const interval = setInterval(updateCurrentTime, 1000);

    return () => clearInterval(interval);
  }, [completedAt, isStreaming, startedAt]);

  useInput(
    (input, key) => {
      if (key.escape) {
        onBack?.();
      } else if (input === "c" && isStreaming) {
        onCancel?.();
      }
    },
    { isActive: Boolean(onBack || (isStreaming && onCancel)) },
  );

  const sourceOptions = Array.from(
    new Set(
      events.map(getReviewEventLogSource).filter((source): source is string => Boolean(source)),
    ),
  );
  const activeSourceFilter =
    sourceFilter && sourceOptions.includes(sourceFilter) ? sourceFilter : null;

  useInput(
    (input) => {
      if (input !== "f" || sourceOptions.length === 0) return;
      const currentIndex = activeSourceFilter ? sourceOptions.indexOf(activeSourceFilter) + 1 : 0;
      const nextIndex = (currentIndex + 1) % (sourceOptions.length + 1);
      setSourceFilter(nextIndex === 0 ? null : (sourceOptions[nextIndex - 1] ?? null));
    },
    { isActive: sourceOptions.length > 0 },
  );

  const shortcuts = getProgressShortcuts({
    isStreaming,
    hasCancel: Boolean(onCancel),
    hasViewResults: Boolean(onViewResults),
    hasContextSnapshot: Boolean(contextSnapshot),
    hasError: Boolean(error),
  });

  usePageFooter({
    shortcuts,
    rightShortcuts: onBack ? BACK_SHORTCUTS : [],
  });

  const elapsed = startedAt ? (completedAt?.getTime() ?? currentTime) - startedAt.getTime() : 0;

  const sideBySide = isWide || isMedium;
  const { progress: progressWidth, log: logWidth } = getPaneWidths(tier);

  const partialFailure = getPartialFailureWarning(agents, error, lensStats);
  const errorGuidance = error ? classifyReviewStreamError(error, errorCode) : null;
  const contentRows = getContentZoneRows(rows);
  const hasActionRow = !error && ((isStreaming && onCancel) || (!isStreaming && onViewResults));
  const actionRows = hasActionRow ? 2 : 0;
  let errorRows = 0;
  if (errorGuidance) {
    errorRows = errorGuidance.kind === "api-key" && onGoToSettings ? 8 : 6;
  }
  const paneHeight = Math.max(contentRows - actionRows - errorRows, 1);
  const hasCompletedSnapshot = Boolean(contextSnapshot && !isStreaming);
  const stackedPaneGap = sideBySide ? 0 : 1;
  let progressPaneHeight = paneHeight;
  if (!sideBySide) {
    progressPaneHeight = hasCompletedSnapshot
      ? Math.max(paneHeight - 5, 1)
      : Math.max(Math.floor((paneHeight - stackedPaneGap) / 2), 1);
  }
  const logPaneHeight = sideBySide
    ? paneHeight
    : Math.max(paneHeight - progressPaneHeight - stackedPaneGap, 1);
  const progressRows = progressSteps.reduce(
    (total, step) => total + 1 + (step.substeps?.length ?? 0),
    0,
  );
  const agentRows = Math.max(progressPaneHeight - progressRows - 11, 1);
  const activityLogHeight = Math.max(
    logPaneHeight -
      2 -
      (sourceOptions.length > 0 ? 1 : 0) -
      (notices.length > 0 ? notices.length + 1 : 0) -
      (partialFailure.hasPartialFailure ? 5 : 0),
    1,
  );

  const progressPane = (
    <Box flexDirection="column" width={progressWidth} height={progressPaneHeight} overflow="hidden">
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

  const logPane = (
    <Box flexDirection="column" width={logWidth} height={logPaneHeight} overflow="hidden">
      <Box justifyContent="space-between">
        <SectionHeader variant="muted">Live Activity Log</SectionHeader>
        <Text color={tokens.muted}>tail -f agent.log</Text>
      </Box>

      {sourceOptions.length > 0 ? (
        <Text color={tokens.muted} wrap="truncate-end">
          Filter [f]: {activeSourceFilter ?? "All agents"}
        </Text>
      ) : null}

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
        <ActivityLog
          events={events}
          height={activityLogHeight}
          isActive
          sourceFilter={activeSourceFilter ?? undefined}
        />
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column">
      <Box flexDirection={sideBySide ? "row" : "column"} gap={sideBySide ? 2 : 1}>
        {progressPane}
        {logPane}
      </Box>
      {errorGuidance ? (
        <Box marginTop={1} flexDirection="column">
          <Callout variant="error">
            <Callout.Title>{errorGuidance.title}</Callout.Title>
            <Callout.Content>{sanitizeTerminalText(error ?? "")}</Callout.Content>
            <Callout.Content>{errorGuidance.guidance}</Callout.Content>
          </Callout>
          {errorGuidance.kind === "api-key" && onGoToSettings ? (
            <Box marginTop={1}>
              <Button variant="primary" isActive onPress={onGoToSettings}>
                Go to Settings
              </Button>
            </Box>
          ) : null}
        </Box>
      ) : null}
      {isStreaming && onCancel ? (
        <Box marginTop={1} gap={2}>
          <Button variant="destructive" onPress={onCancel}>
            Cancel
          </Button>
          {onBack ? (
            <Button variant="secondary" onPress={onBack}>
              Back
            </Button>
          ) : null}
        </Box>
      ) : null}
      {!isStreaming && !error && onViewResults ? (
        <Box marginTop={1}>
          <Button variant="primary" isActive onPress={onViewResults}>
            View Results
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
