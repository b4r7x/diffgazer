import { usePageFooter } from "@diffgazer/core/footer";
import { BACK_SHORTCUT, SWITCH_PANE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import {
  containsActiveElement,
  findNavigationItemByValue,
  getNavigationItems,
  getTabbableElements,
  useFocusZone,
  useKey,
  useScopedNavigation,
} from "@diffgazer/keys";
import { type FocusEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { CHROME_ZONE, useChromeBackHandoff } from "@/components/layout/header-chrome";
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

// The chips are a radiogroup nested inside the filter row, so the default owner
// scoping - which only accepts radios whose radiogroup IS the container - would
// drop every one of them.
const AGENT_CHIP_ITEMS = { type: "radio", ownerSelector: null } as const;

/** The chip value that stands for "no agent filter", shared with the row that renders it. */
export const ALL_AGENTS_VALUE = "all";

// The downloads row and the pane's action buttons nest inside the progress
// pane, and focus-sync resolves the first zone whose container holds focus - so
// "downloads" and "actions" must be declared before "progress" or focusing a
// nested button syncs the wrong zone. The chrome is a park with no target of
// its own.
const PROGRESS_ZONES = [
  "downloads",
  "actions",
  "progress",
  "error",
  "log",
  "filters",
  CHROME_ZONE,
] as const;
export type ProgressZone = (typeof PROGRESS_ZONES)[number];

const PROGRESS_SCOPE = "review-progress";

// The error layout is a single column: the error panel sits inside the log
// pane, so there is no second pane for the arrows to reach and they stay with
// the row that owns them. Down leaves the row for the evidence below it.
function getZoneTransition(
  zone: ProgressZone,
  key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown",
  hasError: boolean,
): ProgressZone | null {
  if (hasError) return zone === "error" && key === "ArrowDown" ? "log" : null;
  if (key === "ArrowLeft" && zone === "log") return "progress";
  if (key === "ArrowRight" && zone === "progress") return "log";
  return null;
}

// ←/→ mean what the focused zone makes them mean, and the footer says which.
// Every zone that can move is named only while its row is there to move: the
// action row needs a second enabled action, the download row is three buttons or
// none, the chip row needs agents to choose between - and each flag is what goes
// false when the row unmounts under a focused control.
function getArrowShortcutLabel(
  zone: ProgressZone,
  enabledActionCount: number,
  hasSnapshotDownloads: boolean,
  hasAgentFilterStop: boolean,
): string {
  if (zone === "filters" && hasAgentFilterStop) return "Move Filter";
  if (zone === "actions" && enabledActionCount > 1) return "Move Action";
  if (zone === "downloads" && hasSnapshotDownloads) return "Move Download";
  return "Switch Pane";
}

interface UseReviewProgressKeyboardOptions {
  onViewResults?: () => void;
  onBack?: () => void;
  onCancel?: () => void;
  /** Retries every visible recovery affordance: stalled-stream reconnect and/or failed context refresh. */
  onRetryRecovery?: () => void;
  cancelDisabled?: boolean;
  hasError: boolean;
  hasSnapshotDownloads?: boolean;
  /** Whether the run has agents to filter the log by; a lone "All" chip is not a stop. */
  hasAgentFilters?: boolean;
  /** The chip the filter row has checked; null is the "All" chip. Zone entry lands on it. */
  activeAgentFilter?: string | null;
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
  hasAgentFilters = false,
  activeAgentFilter = null,
  actions = [],
}: UseReviewProgressKeyboardOptions) {
  const progressPaneRef = useRef<HTMLElement>(null);
  const progressScrollRef = useRef<HTMLDivElement>(null);
  const actionsRowRef = useRef<HTMLDivElement>(null);
  const agentFilterRef = useRef<HTMLDivElement>(null);
  const logContentRef = useRef<HTMLDivElement>(null);
  const errorPanelRef = useRef<HTMLDivElement>(null);
  const snapshotDownloadsRef = useRef<HTMLFieldSetElement>(null);
  // The element behind focusedActionId, kept so the park below can still ask
  // whether the action it lost holds focus after it left the item query.
  const focusedActionRef = useRef<HTMLElement | null>(null);
  const [focusedActionId, setFocusedActionId] = useState<string | null>(null);
  const streamingReviewCancel = useStreamingReviewCancelRef();

  // A claimed Tab must never land in a zone with nothing focusable.
  const enabledActionCount = actions.filter((action) => !action.disabled).length;
  // The chip row is a keyboard stop only once there are agents to choose
  // between; the error layout cycles the error row against the log alone, so it
  // has no chip stop either.
  const hasAgentFilterStop = hasAgentFilters && !hasError;
  const tabCycle = [
    "progress" as const,
    ...(hasSnapshotDownloads ? (["downloads"] as const) : []),
    ...(enabledActionCount > 0 ? (["actions"] as const) : []),
    ...(hasAgentFilterStop ? (["filters"] as const) : []),
    "log" as const,
  ];
  const errorTabCycle = ["error" as const, "log" as const];

  const getFocusedActionElement = () =>
    getNavigationItems(progressPaneRef.current, {
      ...PANE_ACTION_ITEMS,
      skipDisabled: false,
    }).find(containsActiveElement) ?? null;
  const getFirstEnabledActionElement = () =>
    getNavigationItems(progressPaneRef.current, PANE_ACTION_ITEMS)[0] ?? null;
  const getLogRegion = () =>
    logContentRef.current?.querySelector<HTMLElement>("[role='log']") ?? null;
  // Radiogroup entry lands on the checked radio - the row's own tab target.
  // Resolving the row itself would focus its first descendant, always "All".
  const getCheckedAgentChip = () =>
    findNavigationItemByValue(agentFilterRef.current, {
      ...AGENT_CHIP_ITEMS,
      value: activeAgentFilter ?? ALL_AGENTS_VALUE,
    });

  const { zone, setZone } = useFocusZone({
    initial: hasError ? "error" : "progress",
    zones: PROGRESS_ZONES,
    scope: PROGRESS_SCOPE,
    tabCycle: hasError ? errorTabCycle : tabCycle,
    focus: {
      autoFocus: true,
      targets: {
        progress: { container: progressPaneRef, target: progressScrollRef },
        filters: { container: agentFilterRef, target: getCheckedAgentChip },
        downloads: snapshotDownloadsRef,
        // No single wrapper holds every action, so the container resolves to
        // whichever one holds focus (the providers focus-park shape) and falls
        // back to the row.
        actions: {
          container: () => getFocusedActionElement() ?? actionsRowRef.current,
          target: getFirstEnabledActionElement,
        },
        error: {
          container: errorPanelRef,
          target: () => getTabbableElements(errorPanelRef.current)[0] ?? null,
        },
        // The log region itself, not the column around it: the error panel
        // shares that column, and a container holding focus is a container the
        // zone move would not repair focus out of.
        log: getLogRegion,
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
    transitions: ({ zone, key }) => getZoneTransition(zone, key, hasError),
  });

  const chrome = useChromeBackHandoff({ zone, setZone, scope: PROGRESS_SCOPE });

  // The error panel's top edge is the screen's: the row declines ArrowUp
  // (there is no content zone under it to exit into), so up from anywhere in
  // the panel is the way into the chrome, and the chrome's own ArrowDown is the
  // way back.
  useKey("ArrowUp", () => chrome.handOff(), {
    scope: PROGRESS_SCOPE,
    containerRef: errorPanelRef,
    focusWithinOnly: true,
    preventDefault: true,
    enabled: hasError,
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
    // Right past the last action continues into the log, the same move the
    // arrow makes from the progress body. Left on the first action stays inert:
    // there is no pane to its left.
    onNavigationBoundaryReached: (direction) => {
      if (direction === "next") setZone("log");
    },
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
    { enabled: hasAgentFilterStop },
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

  // The log's top edge continues up into the chip row above it - the mirror of
  // the chips' ArrowDown. The log reports the boundary only when there is
  // nothing left to scroll or page back to, and it is handed a listener only
  // when there is a chip row to reach: elsewhere ArrowUp stays native.
  const handleLogBoundary = hasAgentFilterStop ? () => setZone("filters") : undefined;

  // The error layout names the keys of the row it mounts on, published from the
  // error panel itself, so the hook leaves that screen's footer to it rather
  // than writing this pane legend over it.
  usePageFooter({
    shortcuts: [
      SWITCH_PANE_SHORTCUT,
      {
        key: "←/→",
        label: getArrowShortcutLabel(
          zone,
          enabledActionCount,
          hasSnapshotDownloads,
          hasAgentFilterStop,
        ),
      },
      ...(zone === "filters" && hasAgentFilterStop ? [{ key: "↓", label: "Log" }] : []),
      ...(hasAgentFilterStop ? [{ key: "f", label: "Filter" }] : []),
      ...(onViewResults ? [{ key: "Enter", label: "View Results" }] : []),
      ...(onRetryRecovery ? [REVIEW_PROGRESS_CONTROLS.retry] : []),
      ...(onCancel
        ? [{ ...REVIEW_PROGRESS_CONTROLS.cancel, key: "c/q", disabled: cancelDisabled }]
        : []),
    ],
    rightShortcuts: onBack ? [BACK_SHORTCUT] : [],
    enabled: !hasError,
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
    errorPanelRef,
    snapshotDownloadsRef,
    chromeReturnZone: chrome.returnZone,
    handleFilterKeyDown,
    handleLogBoundary,
    isAgentFilterFocused: zone === "filters",
    getPaneActionProps,
  };
}
