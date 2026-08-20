import { usePageFooter } from "@diffgazer/core/footer";
import { BACK_SHORTCUT, SWITCH_PANE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { containsActiveElement, useFocusZone, useKey, useScopedNavigation } from "@diffgazer/keys";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { useStreamingReviewCancelRef } from "@/components/layout/streaming-review";
import { isInteractiveTarget } from "@/features/review/lib/interactive-target";

interface UseReviewProgressKeyboardOptions {
  onViewResults?: () => void;
  onBack?: () => void;
  onCancel?: () => void;
  /** Retries the visible recovery affordance: stalled-stream reconnect or context refresh. */
  onRetryRecovery?: () => void;
  cancelDisabled?: boolean;
  hasError: boolean;
  hasSnapshotDownloads?: boolean;
}

export const REVIEW_PROGRESS_CONTROLS = {
  cancel: { key: "c", label: "Cancel" },
  leave: { key: "Escape", label: "Back" },
  retry: { key: "r", label: "Retry" },
} as const;

export function useReviewProgressKeyboard({
  onViewResults,
  onBack,
  onCancel,
  onRetryRecovery,
  cancelDisabled = false,
  hasError,
  hasSnapshotDownloads = false,
}: UseReviewProgressKeyboardOptions) {
  const progressPaneRef = useRef<HTMLElement>(null);
  const progressScrollRef = useRef<HTMLDivElement>(null);
  const agentFilterRef = useRef<HTMLDivElement>(null);
  const logContentRef = useRef<HTMLDivElement>(null);
  const snapshotDownloadsRef = useRef<HTMLFieldSetElement>(null);
  const streamingReviewCancel = useStreamingReviewCancelRef();

  const tabCycle = hasSnapshotDownloads
    ? (["progress", "downloads", "log"] as const)
    : (["progress", "log"] as const);

  const { setZone } = useFocusZone({
    initial: "progress",
    // The downloads row nests inside the progress pane, and focus-sync resolves
    // the first zone whose container holds focus - so "downloads" must be
    // declared before "progress" or focusing a download button syncs the wrong
    // zone.
    zones: ["downloads", "progress", "log", "filters"] as const,
    scope: "review-progress",
    tabCycle: hasError ? undefined : tabCycle,
    focus: {
      autoFocus: true,
      targets: {
        progress: { container: progressPaneRef, target: progressScrollRef },
        filters: agentFilterRef,
        downloads: snapshotDownloadsRef,
        log: {
          container: logContentRef,
          target: () => logContentRef.current?.querySelector<HTMLElement>("[role='log']") ?? null,
        },
      },
    },
    // Leaving "downloads" for "progress" strands DOM focus on a download button:
    // the keys repair skips a zone whose container already holds focus, and the
    // downloads row nests inside the progress pane. Finish the move here.
    onEnterZone: (zone) => {
      const downloads = snapshotDownloadsRef.current;
      if (zone !== "progress" || !downloads || !containsActiveElement(downloads)) return;
      progressScrollRef.current?.focus({ preventScroll: true });
    },
    transitions: ({ zone, key }) => {
      if (key === "ArrowLeft" && zone === "log") return "progress";
      if (key === "ArrowRight" && zone === "progress") return "log";
      if (key === "ArrowDown" && zone === "filters") return "log";
      return null;
    },
  });

  // Left/Right roam the snapshot download buttons; Tab keeps cycling panes.
  useScopedNavigation({
    containerRef: snapshotDownloadsRef,
    role: "button",
    orientation: "horizontal",
    moveFocus: true,
    wrap: false,
    focusWithinOnly: true,
    enabled: hasSnapshotDownloads,
  });

  useKey(
    "Enter",
    (event) => {
      if (isInteractiveTarget(event.target)) return;
      onViewResults?.();
    },
    { enabled: !!onViewResults && !hasError },
  );
  // Esc leaves the screen without cancelling the run: the review keeps
  // streaming server-side and home's Resume Last Review picks it back up.
  // Cancel stays keyboard-reachable via "c" because pane Tab cycling no
  // longer visits the [Cancel] button.
  useKey(REVIEW_PROGRESS_CONTROLS.leave.key, () => onBack?.(), { enabled: !!onBack });
  useKey(
    REVIEW_PROGRESS_CONTROLS.cancel.key,
    (event) => {
      if (isInteractiveTarget(event.target)) return;
      onCancel?.();
    },
    { enabled: !!onCancel && !hasError && !cancelDisabled },
  );
  // The TUI's retry grammar: r triggers the recovery affordance the pane shows.
  useKey(
    REVIEW_PROGRESS_CONTROLS.retry.key,
    (event) => {
      if (isInteractiveTarget(event.target)) return;
      onRetryRecovery?.();
    },
    { enabled: !!onRetryRecovery && !hasError },
  );
  // While the run streams, the global q shortcut cancels it instead of shutting
  // the app down — the TUI grammar. A pending cancel still swallows q, so a
  // double press cannot fall through to shutdown.
  useEffect(() => {
    if (!onCancel || hasError) return;
    streamingReviewCancel.current = () => {
      if (!cancelDisabled) onCancel();
    };
    return () => {
      streamingReviewCancel.current = null;
    };
  }, [streamingReviewCancel, onCancel, hasError, cancelDisabled]);
  useKey(
    "f",
    (event) => {
      if (isInteractiveTarget(event.target)) return;
      setZone("filters");
    },
    { enabled: !hasError },
  );

  // The agent ToggleGroup claims vertical arrows as extra horizontal moves, so
  // they are intercepted before its navigation handler: ArrowDown stays a zone
  // move into the log and ArrowUp stays inert instead of moving chips.
  const handleFilterKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setZone("log");
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
    }
  };

  usePageFooter({
    shortcuts: hasError
      ? []
      : [
          SWITCH_PANE_SHORTCUT,
          { key: "←/→", label: "Switch Pane" },
          { key: "f", label: "Filter" },
          ...(onViewResults ? [{ key: "Enter", label: "View Results" }] : []),
          ...(onRetryRecovery ? [REVIEW_PROGRESS_CONTROLS.retry] : []),
          ...(onCancel
            ? [{ ...REVIEW_PROGRESS_CONTROLS.cancel, key: "c/q", disabled: cancelDisabled }]
            : []),
        ],
    rightShortcuts: onBack ? [BACK_SHORTCUT] : [],
  });

  return {
    progressPaneRef,
    progressScrollRef,
    agentFilterRef,
    logContentRef,
    snapshotDownloadsRef,
    handleFilterKeyDown,
  };
}
