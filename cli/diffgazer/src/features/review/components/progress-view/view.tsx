import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  classifyReviewStreamError,
  type FileProgress,
  type ReviewEvent,
} from "@diffgazer/core/review";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import type { TransportFamily } from "@diffgazer/core/schemas/config";
import type { AgentState, LensStat } from "@diffgazer/core/schemas/events";
import {
  BACK_SHORTCUTS,
  type ProgressStepWithSubstepsData,
  type Shortcut,
} from "@diffgazer/core/schemas/presentation";
import { Box, useInput } from "ink";
import { type ReactElement, useContext, useEffect, useState } from "react";
import { useContentZone } from "../../../../components/layout/global";
import { Callout } from "../../../../components/ui/callout";
import { KeyboardContext } from "../../../../hooks/keyboard-context";
import { useResponsive } from "../../../../hooks/use-terminal-dimensions";
import type { BreakpointTier } from "../../../../lib/breakpoints";
import { wrappedRowCount } from "../../../../lib/terminal-width";
import { ReviewProgressActivity } from "./activity";
import { ReviewProgressOverview } from "./overview";

export interface ReviewProgressViewProps {
  progressSteps: ProgressStepWithSubstepsData[];
  agents: AgentState[];
  lensStats?: LensStat[];
  events: readonly ReviewEvent[];
  fileProgress: FileProgress;
  isStreaming: boolean;
  error: string | null;
  errorCode?: string | null;
  /** Admitted transport family; guidance fails neutral when it is absent. */
  transportFamily?: TransportFamily | null;
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
  contextRefreshError?: string | null;
  onRetryContextRefresh?: () => void;
}

const STREAMING_SHORTCUTS: Shortcut[] = [{ key: "c", label: "Cancel" }];
const COMPLETING_SHORTCUTS: Shortcut[] = [{ key: "Enter", label: "View Results" }];
const SAVE_CONTEXT_SHORTCUT: Shortcut = { key: "w", label: "Save context" };
const RETRY_CONTEXT_SHORTCUT: Shortcut = { key: "r", label: "Retry context" };
const OPEN_SETTINGS_SHORTCUT: Shortcut = { key: "s", label: "Open Settings" };
const SETTINGS_RECOVERY_LINE = "Press s to open Settings.";
/** Callout chrome around its text: the margin above it plus its two border rows. */
const CALLOUT_CHROME_ROWS = 3;
/** Columns the callout spends per row: border, horizontal padding, icon and its gap. */
const CALLOUT_CHROME_COLUMNS = 6;

/** Rows `text` occupies inside the callout, honouring the newlines the sanitizer keeps. */
function calloutTextRows(text: string, columns: number): number {
  return text.split("\n").reduce((rows, line) => rows + wrappedRowCount(line, columns), 0);
}

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
  hasContextRefreshError,
  hasError,
  hasSettingsRecovery,
}: {
  isStreaming: boolean;
  hasCancel: boolean;
  hasViewResults: boolean;
  hasContextSnapshot: boolean;
  hasContextRefreshError: boolean;
  hasError: boolean;
  hasSettingsRecovery: boolean;
}): Shortcut[] {
  // A missing API key has no other affordance, so it publishes the one key that
  // recovers it instead of an in-content button.
  if (hasSettingsRecovery) return [OPEN_SETTINGS_SHORTCUT];
  if (hasError) return [];
  if (hasContextRefreshError) return [RETRY_CONTEXT_SHORTCUT];
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
  transportFamily,
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
  contextRefreshError,
  onRetryContextRefresh,
}: ReviewProgressViewProps): ReactElement {
  const { isMedium, isWide, tier } = useResponsive();
  const { contentRows, contentColumns } = useContentZone();
  const keyboard = useContext(KeyboardContext);
  // Lazy now-seed: a zero seed renders a negative elapsed on the first frame
  // and permanently for runs that mount already stopped (error/abort).
  const [currentTime, setCurrentTime] = useState(() => Date.now());

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

  const errorGuidance = error
    ? classifyReviewStreamError(error, errorCode, transportFamily ?? undefined)
    : null;
  const sanitizedError = sanitizeTerminalText(error ?? "");
  const hasSettingsRecovery = Boolean(
    errorGuidance?.kind === "api-key" && onGoToSettings !== undefined,
  );

  useInput(
    (input, key) => {
      if (key.escape) {
        onBack?.();
      } else if (input === "c" && isStreaming) {
        onCancel?.();
      } else if (input === "r" && contextRefreshError) {
        onRetryContextRefresh?.();
      } else if (input === "s" && hasSettingsRecovery) {
        onGoToSettings?.();
      } else if (key.return && !isStreaming && !error) {
        onViewResults?.();
      }
    },
    {
      isActive: Boolean(
        onBack ||
          onViewResults ||
          hasSettingsRecovery ||
          contextRefreshError ||
          (isStreaming && onCancel),
      ),
    },
  );

  const shortcuts = getProgressShortcuts({
    isStreaming,
    hasCancel: Boolean(onCancel),
    hasViewResults: Boolean(onViewResults),
    hasContextSnapshot: Boolean(contextSnapshot),
    hasContextRefreshError: Boolean(contextRefreshError && onRetryContextRefresh),
    hasError: Boolean(error),
    hasSettingsRecovery,
  });

  usePageFooter({
    shortcuts,
    rightShortcuts: onBack ? BACK_SHORTCUTS : [],
  });

  const elapsed = startedAt ? (completedAt?.getTime() ?? currentTime) - startedAt.getTime() : 0;

  const sideBySide = isWide || isMedium;
  const { progress: progressWidth, log: logWidth } = getPaneWidths(tier);

  // The shortcut bar is the only action surface here, so the panes keep the
  // rows an in-content button row used to take. What is left is the callout.
  // Its error line is server text, so its rows are measured rather than assumed:
  // a wrapped or multi-line message would otherwise overflow the reserve and be
  // clipped by the content zone.
  const calloutColumns = Math.max(contentColumns - CALLOUT_CHROME_COLUMNS, 1);
  const errorRows = errorGuidance
    ? CALLOUT_CHROME_ROWS +
      calloutTextRows(errorGuidance.title, calloutColumns) +
      calloutTextRows(sanitizedError, calloutColumns) +
      calloutTextRows(errorGuidance.guidance, calloutColumns) +
      (hasSettingsRecovery ? calloutTextRows(SETTINGS_RECOVERY_LINE, calloutColumns) : 0)
    : 0;
  const paneHeight = Math.max(contentRows - errorRows, 1);
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

  return (
    <Box flexDirection="column">
      <Box flexDirection={sideBySide ? "row" : "column"} gap={sideBySide ? 2 : 1}>
        <ReviewProgressOverview
          width={progressWidth}
          height={progressPaneHeight}
          progressSteps={progressSteps}
          agents={agents}
          fileProgress={fileProgress}
          issuesFound={issuesFound}
          elapsed={elapsed}
          isStreaming={isStreaming}
          reviewId={reviewId}
          contextSnapshot={contextSnapshot}
          contextRefreshError={contextRefreshError}
        />
        <ReviewProgressActivity
          width={logWidth}
          height={logPaneHeight}
          events={events}
          notices={notices}
          agents={agents}
          error={error}
          lensStats={lensStats}
        />
      </Box>
      {errorGuidance ? (
        <Box marginTop={1} flexDirection="column">
          <Callout variant="error">
            <Callout.Title>{errorGuidance.title}</Callout.Title>
            <Callout.Content>{sanitizedError}</Callout.Content>
            <Callout.Content>{errorGuidance.guidance}</Callout.Content>
            {hasSettingsRecovery ? (
              <Callout.Content>{SETTINGS_RECOVERY_LINE}</Callout.Content>
            ) : null}
          </Callout>
        </Box>
      ) : null}
    </Box>
  );
}
