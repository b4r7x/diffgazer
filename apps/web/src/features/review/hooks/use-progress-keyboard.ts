import { usePageFooter } from "@diffgazer/core/footer";
import { BACK_SHORTCUT, SWITCH_PANE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import {
  containsActiveElement,
  getNavigationItems,
  useFocusZone,
  useKey,
  useScopedNavigation,
} from "@diffgazer/keys";
import { type FocusEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useStreamingReviewCancelRef } from "@/components/layout/streaming-review";
import { isInteractiveTarget } from "@/features/review/lib/interactive-target";

/** Spread onto a pane action button: registers it with the actions zone and carries the roving mark. */
export interface ProgressPaneActionButtonProps {
  "data-pane-action": string;
  "data-value": string;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  highlighted: boolean;
}

// Every pane action is marked in the DOM: the recovery buttons render inside the
// scroll content, away from the action row, so the pane is the only container
// holding them all - and it also holds the snapshot download buttons, which the
// marker narrows back out of the item query.
const PANE_ACTION_ITEMS = { type: "button", itemSelector: "[data-pane-action]" } as const;

interface UseReviewProgressKeyboardOptions {
  onViewResults?: () => void;
  onBack?: () => void;
  onCancel?: () => void;
  /** Retries every visible recovery affordance: stalled-stream reconnect and/or failed context refresh. */
  onRetryRecovery?: () => void;
  cancelDisabled?: boolean;
  hasError: boolean;
  hasSnapshotDownloads?: boolean;
  /** The pane's rendered action buttons in DOM order; traversal and zone entry skip disabled entries. */
  actions?: readonly { id: string; disabled?: boolean }[];
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
  actions = [],
}: UseReviewProgressKeyboardOptions) {
  const progressPaneRef = useRef<HTMLElement>(null);
  const progressScrollRef = useRef<HTMLDivElement>(null);
  const actionsRowRef = useRef<HTMLDivElement>(null);
  const agentFilterRef = useRef<HTMLDivElement>(null);
  const logContentRef = useRef<HTMLDivElement>(null);
  const snapshotDownloadsRef = useRef<HTMLFieldSetElement>(null);
  // The element behind focusedActionId, kept so the park below can still ask
  // whether the action it lost holds focus after it left the item query.
  const focusedActionRef = useRef<HTMLElement | null>(null);
  const [focusedActionId, setFocusedActionId] = useState<string | null>(null);
  const streamingReviewCancel = useStreamingReviewCancelRef();

  // A claimed Tab must never land in a zone with nothing focusable.
  const hasEnabledAction = actions.some((action) => !action.disabled);
  const tabCycle = [
    "progress" as const,
    ...(hasSnapshotDownloads ? (["downloads"] as const) : []),
    ...(hasEnabledAction ? (["actions"] as const) : []),
    "log" as const,
  ];

  const getFocusedActionElement = () =>
    getNavigationItems(progressPaneRef.current, {
      ...PANE_ACTION_ITEMS,
      skipDisabled: false,
    }).find(containsActiveElement) ?? null;
  const getFirstEnabledActionElement = () =>
    getNavigationItems(progressPaneRef.current, PANE_ACTION_ITEMS)[0] ?? null;

  const { zone, setZone } = useFocusZone({
    initial: "progress",
    // The downloads row and the pane's action buttons nest inside the progress
    // pane, and focus-sync resolves the first zone whose container holds focus
    // - so "downloads" and "actions" must be declared before "progress" or
    // focusing a nested button syncs the wrong zone.
    zones: ["downloads", "actions", "progress", "log", "filters"] as const,
    scope: "review-progress",
    tabCycle: hasError ? undefined : tabCycle,
    focus: {
      autoFocus: true,
      targets: {
        progress: { container: progressPaneRef, target: progressScrollRef },
        filters: agentFilterRef,
        downloads: snapshotDownloadsRef,
        // No single wrapper holds every action, so the container resolves to
        // whichever one holds focus (the providers focus-park shape) and falls
        // back to the row.
        actions: {
          container: () => getFocusedActionElement() ?? actionsRowRef.current,
          target: getFirstEnabledActionElement,
        },
        log: {
          container: logContentRef,
          target: () => logContentRef.current?.querySelector<HTMLElement>("[role='log']") ?? null,
        },
      },
    },
    // Leaving "downloads" or an action button for "progress" strands DOM focus
    // on the button: the keys repair skips a zone whose container already holds
    // focus, and both territories nest inside the progress pane. Finish the
    // move here.
    onEnterZone: (nextZone) => {
      if (nextZone !== "progress") return;
      const downloads = snapshotDownloadsRef.current;
      const downloadsHoldFocus = downloads != null && containsActiveElement(downloads);
      if (!downloadsHoldFocus && getFocusedActionElement() == null) return;
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

  // Left/Right roam the pane's action buttons the same way, skipping disabled
  // ones; real DOM focus on the visited button is the roving state. The zone
  // gates it so the arrows keep switching panes everywhere else in the pane.
  useScopedNavigation({
    containerRef: progressPaneRef,
    role: PANE_ACTION_ITEMS.type,
    itemSelector: PANE_ACTION_ITEMS.itemSelector,
    orientation: "horizontal",
    moveFocus: true,
    wrap: false,
    focusWithinOnly: true,
    enabled: zone === "actions" && !hasError,
  });

  // The row lost the action it held - it turned disabled mid-interaction (a
  // keyboard-activated [Cancel]) or left the tree entirely ([Retry] on a
  // successful refresh, [Reconnect] when the stream resumes on its own,
  // [Cancel] when the run stops). Browsers blur such a control to <body>, where
  // no zone container holds focus: the Tab cycle restarts from the document top
  // and both pane reticles go dark. Park focus on the progress scroll region
  // instead - the same home the onEnterZone hand-off uses, and the same custody
  // rule useActionRowNavigation applies when its row loses an action. The park
  // claims focus only while the lost action still holds it (jsdom, and browsers
  // that skip the blur) or it fell unclaimed to <body>; focus the user moved to
  // a live element elsewhere is never stolen.
  const lostFocusedActionId =
    focusedActionId != null &&
    !actions.some((action) => action.id === focusedActionId && !action.disabled)
      ? focusedActionId
      : null;
  useEffect(() => {
    if (lostFocusedActionId == null) return;
    // The park target outlives the lost action, so it owns the document read.
    const park = progressScrollRef.current;
    if (!park) return;
    const lostAction = focusedActionRef.current;
    const active = park.ownerDocument.activeElement;
    const stillHeld = lostAction != null && containsActiveElement(lostAction);
    const fellUnclaimed = active == null || active === park.ownerDocument.body;
    if (!stillHeld && !fellUnclaimed) return;
    park.focus({ preventScroll: true });
  }, [lostFocusedActionId]);

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
  // "c" stays bound as an accelerator so Cancel is reachable without walking
  // the pane Tab cycle to the actions zone.
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
          // Inside the action row the arrows step between actions instead of
          // switching panes, so the hint names the move the user's zone makes.
          { key: "←/→", label: zone === "actions" ? "Move Action" : "Switch Pane" },
          { key: "f", label: "Filter" },
          ...(onViewResults ? [{ key: "Enter", label: "View Results" }] : []),
          ...(onRetryRecovery ? [REVIEW_PROGRESS_CONTROLS.retry] : []),
          ...(onCancel
            ? [{ ...REVIEW_PROGRESS_CONTROLS.cancel, key: "c/q", disabled: cancelDisabled }]
            : []),
        ],
    rightShortcuts: onBack ? [BACK_SHORTCUT] : [],
  });

  const getPaneActionProps = (id: string): ProgressPaneActionButtonProps => ({
    "data-pane-action": "",
    "data-value": id,
    onFocus: (event) => {
      focusedActionRef.current = event.currentTarget;
      setFocusedActionId(id);
    },
    highlighted:
      zone === "actions" &&
      focusedActionId === id &&
      actions.some((action) => action.id === id && !action.disabled),
  });

  return {
    progressPaneRef,
    progressScrollRef,
    actionsRowRef,
    agentFilterRef,
    logContentRef,
    snapshotDownloadsRef,
    handleFilterKeyDown,
    getPaneActionProps,
  };
}
