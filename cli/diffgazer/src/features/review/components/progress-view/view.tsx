import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  classifyReviewStreamError,
  type FileProgress,
  isProviderRecoveryError,
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
import type { ReviewSizeWarning } from "@diffgazer/core/schemas/review";
import { Box, useInput } from "ink";
import { type ReactElement, useContext, useEffect, useState } from "react";
import { useContentZone } from "../../../../components/layout/global";
import { Callout } from "../../../../components/ui/callout";
import { KeyboardContext } from "../../../../hooks/keyboard-context";
import { useResponsive } from "../../../../hooks/use-terminal-dimensions";
import type { BreakpointTier } from "../../../../lib/breakpoints";
import {
  CALLOUT_CHROME_COLUMNS,
  CALLOUT_CHROME_ROWS,
  calloutTextRows,
} from "../../lib/callout-geometry";
import {
  getProviderRecoveryLine,
  getProviderRecoveryShortcut,
  PROVIDER_RECOVERY_KEY,
} from "../../lib/provider-recovery";
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
  /** Advisory from the start gate: the run fits the model, but barely reads well at this size. */
  sizeWarning?: ReviewSizeWarning | null;
  onCancel?: () => void;
  onBack?: () => void;
  onViewResults?: () => void;
  onGoToSettings?: () => void;
  /** Stops this run and opens the file picker, so the change can be reviewed in pieces. */
  onFilterFiles?: () => void;
  issuesFound: number;
  startedAt: Date | null;
  completedAt: Date | null;
  reviewId?: string | null;
  contextSnapshot?: ReviewContextResponse | null;
  contextRefreshError?: string | null;
  onRetryContextRefresh?: () => void;
}

const STREAMING_SHORTCUTS: Shortcut[] = [{ key: "c", label: "Cancel" }];
const FILTER_FILES_KEY = "f";
const FILTER_FILES_SHORTCUT: Shortcut = { key: FILTER_FILES_KEY, label: "Filter Files" };
const SIZE_WARNING_TITLE = "Large Review";
const SIZE_WARNING_ACTION_LINE = `Press ${FILTER_FILES_KEY} to stop this run and pick the files to review instead.`;
const COMPLETING_SHORTCUTS: Shortcut[] = [{ key: "Enter", label: "View Results" }];
const SAVE_CONTEXT_SHORTCUT: Shortcut = { key: "w", label: "Save context" };
const RETRY_CONTEXT_SHORTCUT: Shortcut = { key: "r", label: "Retry context" };

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
  hasFilterFiles,
  providerRecoveryLabel,
}: {
  isStreaming: boolean;
  hasCancel: boolean;
  hasViewResults: boolean;
  hasContextSnapshot: boolean;
  hasContextRefreshError: boolean;
  hasError: boolean;
  hasFilterFiles: boolean;
  providerRecoveryLabel: string | null;
}): Shortcut[] {
  // A provider failure has no other affordance, so it publishes the one key that
  // recovers it, named by the CTA, instead of an in-content button.
  if (providerRecoveryLabel) return [getProviderRecoveryShortcut(providerRecoveryLabel)];
  if (hasError) return [];
  if (hasContextRefreshError) return [RETRY_CONTEXT_SHORTCUT];
  if (isStreaming) {
    return [
      ...(hasCancel ? STREAMING_SHORTCUTS : []),
      ...(hasFilterFiles ? [FILTER_FILES_SHORTCUT] : []),
    ];
  }
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
  sizeWarning,
  onCancel,
  onBack,
  onViewResults,
  onGoToSettings,
  onFilterFiles,
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
  const providerRecoveryLabel =
    errorGuidance && isProviderRecoveryError(errorGuidance.kind) && onGoToSettings !== undefined
      ? errorGuidance.ctaLabel
      : null;
  const providerRecoveryLine = providerRecoveryLabel
    ? getProviderRecoveryLine(providerRecoveryLabel)
    : null;
  // The advisory stands down the moment the run has a failure to report: two
  // callouts about the same review would compete for the same rows.
  const activeSizeWarning = errorGuidance ? null : (sizeWarning ?? null);
  // Only while the run is still reading: once it has finished there are results
  // to read, and narrowing it would throw them away for nothing.
  const canFilterFiles = Boolean(activeSizeWarning && onFilterFiles && isStreaming);
  const sanitizedSizeWarning = activeSizeWarning
    ? sanitizeTerminalText(activeSizeWarning.message)
    : null;

  useInput(
    (input, key) => {
      if (key.escape) {
        onBack?.();
      } else if (input === FILTER_FILES_KEY && canFilterFiles) {
        onFilterFiles?.();
      } else if (input === "c" && isStreaming) {
        onCancel?.();
      } else if (input === "r" && contextRefreshError) {
        onRetryContextRefresh?.();
      } else if (input === PROVIDER_RECOVERY_KEY && providerRecoveryLine) {
        onGoToSettings?.();
      } else if (key.return && !isStreaming && !error) {
        onViewResults?.();
      }
    },
    {
      isActive: Boolean(
        onBack ||
          onViewResults ||
          providerRecoveryLine ||
          contextRefreshError ||
          canFilterFiles ||
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
    hasFilterFiles: canFilterFiles,
    providerRecoveryLabel,
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
      (providerRecoveryLine ? calloutTextRows(providerRecoveryLine, calloutColumns) : 0)
    : 0;
  // The advisory is server text too, and the two callouts are mutually
  // exclusive, so the panes give up rows for whichever one is on screen.
  const sizeWarningRows = sanitizedSizeWarning
    ? CALLOUT_CHROME_ROWS +
      calloutTextRows(SIZE_WARNING_TITLE, calloutColumns) +
      calloutTextRows(sanitizedSizeWarning, calloutColumns) +
      (canFilterFiles ? calloutTextRows(SIZE_WARNING_ACTION_LINE, calloutColumns) : 0)
    : 0;
  const paneHeight = Math.max(contentRows - errorRows - sizeWarningRows, 1);
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
      {sanitizedSizeWarning ? (
        <Box marginTop={1} flexDirection="column">
          <Callout variant="warning">
            <Callout.Title>{SIZE_WARNING_TITLE}</Callout.Title>
            <Callout.Content>{sanitizedSizeWarning}</Callout.Content>
            {canFilterFiles ? <Callout.Content>{SIZE_WARNING_ACTION_LINE}</Callout.Content> : null}
          </Callout>
        </Box>
      ) : null}
      {errorGuidance ? (
        <Box marginTop={1} flexDirection="column">
          <Callout variant="error">
            <Callout.Title>{errorGuidance.title}</Callout.Title>
            <Callout.Content>{sanitizedError}</Callout.Content>
            <Callout.Content>{errorGuidance.guidance}</Callout.Content>
            {providerRecoveryLine ? (
              <Callout.Content>{providerRecoveryLine}</Callout.Content>
            ) : null}
          </Callout>
        </Box>
      ) : null}
    </Box>
  );
}
