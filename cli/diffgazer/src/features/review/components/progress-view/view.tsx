import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { usePageFooter } from "@diffgazer/core/footer";
import {
  classifyReviewStreamError,
  type FileProgress,
  type ReviewEvent,
  sanitizeTerminalText,
} from "@diffgazer/core/review";
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
}

const STREAMING_SHORTCUTS: Shortcut[] = [{ key: "c", label: "Cancel" }];
const COMPLETING_SHORTCUTS: Shortcut[] = [{ key: "Enter", label: "View Results" }];
const SAVE_CONTEXT_SHORTCUT: Shortcut = { key: "w", label: "Save context" };
const OPEN_SETTINGS_SHORTCUT: Shortcut = { key: "s", label: "Open Settings" };

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
  hasSettingsRecovery,
}: {
  isStreaming: boolean;
  hasCancel: boolean;
  hasViewResults: boolean;
  hasContextSnapshot: boolean;
  hasError: boolean;
  hasSettingsRecovery: boolean;
}): Shortcut[] {
  // A missing API key has no other affordance, so it publishes the one key that
  // recovers it instead of an in-content button.
  if (hasSettingsRecovery) return [OPEN_SETTINGS_SHORTCUT];
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
}: ReviewProgressViewProps): ReactElement {
  const { isMedium, isWide, tier } = useResponsive();
  const { contentRows } = useContentZone();
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
  const hasSettingsRecovery = Boolean(
    errorGuidance?.kind === "api-key" && onGoToSettings !== undefined,
  );

  useInput(
    (input, key) => {
      if (key.escape) {
        onBack?.();
      } else if (input === "c" && isStreaming) {
        onCancel?.();
      } else if (input === "s" && hasSettingsRecovery) {
        onGoToSettings?.();
      } else if (key.return && !isStreaming && !error) {
        onViewResults?.();
      }
    },
    {
      isActive: Boolean(
        onBack || onViewResults || hasSettingsRecovery || (isStreaming && onCancel),
      ),
    },
  );

  const shortcuts = getProgressShortcuts({
    isStreaming,
    hasCancel: Boolean(onCancel),
    hasViewResults: Boolean(onViewResults),
    hasContextSnapshot: Boolean(contextSnapshot),
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
  // rows an in-content button row used to take. What is left is the callout:
  // two border rows, the title, its content lines and the marginTop above it.
  const calloutRows = hasSettingsRecovery ? 7 : 6;
  const errorRows = errorGuidance ? calloutRows : 0;
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
            <Callout.Content>{sanitizeTerminalText(error ?? "")}</Callout.Content>
            <Callout.Content>{errorGuidance.guidance}</Callout.Content>
            {hasSettingsRecovery ? (
              <Callout.Content>Press s to open Settings.</Callout.Content>
            ) : null}
          </Callout>
        </Box>
      ) : null}
    </Box>
  );
}
