import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { usePageFooter } from "@diffgazer/core/footer";
import { formatDuration } from "@diffgazer/core/format";
import {
  classifyReviewStreamError,
  getPartialFailureWarning,
  isSessionTerminationCode,
  type LogStreamState,
  type ReviewEvent,
  type ReviewStreamErrorGuidance,
  sanitizePresentationText,
} from "@diffgazer/core/review";
import type { TransportFamily } from "@diffgazer/core/schemas/config";
import type { AgentState, LensStat } from "@diffgazer/core/schemas/events";
import {
  BACK_SHORTCUT,
  type BadgeVariant,
  type ProgressStepData,
  type ReviewProgressMetrics,
} from "@diffgazer/core/schemas/presentation";
import type { ReviewSizeWarning } from "@diffgazer/core/schemas/review";
import { clampIndex, useActionRowNavigation } from "@diffgazer/keys";
import { Badge } from "@diffgazer/ui/components/badge";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { Panel } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { cn } from "@diffgazer/ui/lib/utils";
import { type KeyboardEvent, type RefObject, useState } from "react";
import { chromeReturnShortcut } from "@/components/layout/header-chrome";
import { useFocusWithin } from "@/hooks/use-focus-within";
import { ReviewClockProvider, useReviewClock } from "../hooks/use-clock";
import {
  ALL_AGENTS_VALUE,
  type ProgressPaneActionButtonProps,
  type ProgressZone,
  REVIEW_PROGRESS_CONTROLS,
  useReviewProgressKeyboard,
} from "../hooks/use-progress-keyboard";
import { useStreamLiveness } from "../hooks/use-stream-liveness";
import { ActivityLog } from "./activity-log/log";
import { AgentBoard } from "./agent-board";
import { ContextSnapshotPreview } from "./context-snapshot-preview";
import { ReviewMetricsFooter } from "./metrics-footer";
import { ProgressList } from "./progress-list/list";

export interface ReviewProgressData {
  steps: ProgressStepData[];
  events: readonly ReviewEvent[];
  agents: AgentState[];
  lensStats?: LensStat[];
  metrics: ReviewProgressMetrics;
  startTime?: Date;
  contextSnapshot?: ReviewContextResponse | null;
  notices: string[];
  /** The admitted-but-large advisory the stream reported, once, right after the run started. */
  sizeWarning?: ReviewSizeWarning | null;
}

export interface ReviewProgressViewProps {
  data: ReviewProgressData;
  isRunning: boolean;
  error?: string | null;
  errorCode?: string | null;
  /** Transport of the executing configuration; recovery guidance fails neutral without it. */
  transportFamily?: TransportFamily;
  reviewId?: string | null;
  contextRefreshError?: string | null;
  onRetryContextRefresh?: () => void;
  onRetry?: (reviewId: string) => void;
  /** Opens the record the server saved when a terminated session ended the run. */
  onViewRun?: (reviewId: string) => void;
  onViewResults?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
  cancelDisabled?: boolean;
}

interface AgentOption {
  id: string;
  name: string;
  badgeLabel: string;
  badgeVariant: BadgeVariant;
}

function AgentFilterBar({
  agents,
  active,
  isFocused,
  onChange,
  onKeyDown,
}: {
  agents: AgentOption[];
  active: string | null;
  /** True while the keyboard zone sits on the chip row. */
  isFocused: boolean;
  onChange: (v: string | null) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}) {
  return (
    <ToggleGroup
      value={active ?? ALL_AGENTS_VALUE}
      onChange={(value) => onChange(value === ALL_AGENTS_VALUE ? null : value)}
      // The zone owns the mark, so no chip can keep it after the row loses
      // focus and paint a second one beside the control the user is on.
      highlighted={isFocused ? (active ?? ALL_AGENTS_VALUE) : null}
      onKeyDown={onKeyDown}
      label="Agent filter"
      className="items-center pb-2"
    >
      <ToggleGroupItem
        value={ALL_AGENTS_VALUE}
        className="h-auto min-h-6 px-2 py-1 text-2xs pointer-coarse:min-h-11 pointer-coarse:px-3"
      >
        All
      </ToggleGroupItem>
      {agents.map((agent) => (
        <ToggleGroupItem
          key={agent.id}
          value={agent.name}
          className="h-auto min-h-6 px-2 py-1 text-2xs pointer-coarse:min-h-11 pointer-coarse:px-3"
        >
          <Badge
            variant={agent.badgeVariant}
            size="sm"
            className="mr-1 group-data-[state=on]/segmented-item:border-primary-foreground/40 group-data-[state=on]/segmented-item:bg-primary-foreground/15 group-data-[state=on]/segmented-item:text-primary-foreground"
          >
            {agent.badgeLabel}
          </Badge>
          <span>{agent.name}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** One way out of the error layout, in the order the row walks them. */
interface ErrorAction {
  label: string;
  onAction: () => void;
  variant: "secondary" | "outline";
}

/**
 * The ways forward this panel offers. Every settled failure with a full-frame
 * gate card behind it leaves the live screen, so what is left here is a
 * transport that can be picked up again and a terminated session, whose partial
 * run the server saved before it ended.
 */
function buildErrorActions({
  guidance,
  onBack,
  onRetry,
  onViewRun,
}: {
  guidance: ReviewStreamErrorGuidance;
  onBack?: () => void;
  onRetry?: () => void;
  onViewRun?: () => void;
}): ErrorAction[] {
  const actions: ErrorAction[] = [];
  if (onBack) {
    actions.push({ label: "Back to Home", onAction: onBack, variant: "secondary" });
  }
  if (guidance.kind === "transport" && onRetry) {
    actions.push({ label: guidance.ctaLabel, onAction: onRetry, variant: "outline" });
  }
  if (onViewRun) {
    actions.push({ label: "View Saved Run", onAction: onViewRun, variant: "outline" });
  }
  return actions;
}

function ErrorDisplay({
  error,
  guidance,
  actions,
  panelRef,
  chromeReturnZone,
  hasBack,
}: {
  error: string;
  guidance: ReviewStreamErrorGuidance;
  actions: ErrorAction[];
  /** The error zone's container, owned by the keyboard hook that focuses into it. */
  panelRef: RefObject<HTMLDivElement | null>;
  /** The zone the header Back button returns to, for the parked legend. */
  chromeReturnZone: ProgressZone | null;
  hasBack: boolean;
}) {
  // Only buttons take focus in here, so focus in the panel means the row has it
  // - the zone alone would keep the mark lit after Tab moved on, and the legend
  // below names the row's keys only while they are the ones bound.
  const focus = useFocusWithin<HTMLDivElement>();
  const row = useActionRowNavigation({
    enabled: true,
    actionCount: actions.length,
    // Mount lands on the first way out: this row is the error layout's focus
    // target, not the log behind it.
    defaultZone: "actions",
    // Scoped to the panel so the row's keys stand down the moment focus leaves
    // it: in the log or parked on the header Back button, ←/→ must not yank
    // focus back into the panel, and ↑ belongs to the chrome hand-off.
    containerRef: panelRef,
    canExitActions: false,
    onAction: (index) => actions[index]?.onAction(),
  });
  const focusedLabel = actions[row.focusedIndex]?.label;

  // The error layout's only footer writer: the pane hook stands its own down
  // there, so this names the keys the row binds while it holds focus, and the
  // way back down while the chrome holds it instead.
  usePageFooter({
    shortcuts: focus.focusWithin
      ? [
          // A lone way out has nowhere to move to.
          ...(actions.length > 1 ? [{ key: "←/→", label: "Move Action" }] : []),
          ...(focusedLabel ? [{ key: "Enter/Space", label: focusedLabel }] : []),
        ]
      : chromeReturnShortcut(chromeReturnZone, { error: "Actions" }),
    rightShortcuts: hasBack ? [BACK_SHORTCUT] : [],
  });

  return (
    <div className="shrink-0 px-4 pb-3">
      {/* No reticle of its own: the enclosing log pane already brackets while
          focus sits in here, and a screen wears one. */}
      <Panel
        ref={panelRef}
        {...focus.props}
        tone="error"
        role="alert"
        aria-live="assertive"
        className="max-w-prose text-left"
      >
        <Panel.Header>
          <Panel.Title>{guidance.title}</Panel.Title>
        </Panel.Header>
        <Panel.Content>
          <div className="font-mono text-muted-foreground">{sanitizePresentationText(error)}</div>
          <div className="text-muted-foreground">{guidance.guidance}</div>
          <div className="flex flex-wrap gap-3">
            {actions.map((action, index) => (
              <Button
                key={action.label}
                {...row.getActionProps(index)}
                variant={action.variant}
                bracket
                highlighted={focus.focusWithin && row.focusedIndex === index}
                onClick={action.onAction}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </Panel.Content>
      </Panel>
    </div>
  );
}

const SIZE_WARNING_TITLE = "Large Review";
/**
 * Escape hatch for a diff the model may not fit; the copy must name Home's real
 * affordances — the Review Scope row and [f] — exactly as Home labels them.
 */
const SIZE_WARNING_ACTION_LINE =
  "Cancel this run, then narrow it from Home: the Review Scope row, or [f].";

const PANEL_TONE_BY_LIVENESS = {
  flowing: undefined,
  quiet: "warning",
  stalled: "error",
} as const satisfies Record<LogStreamState, "warning" | "error" | undefined>;

function ContextRefreshErrorNotice({
  error,
  onRetry,
  retryProps,
}: {
  error: string;
  onRetry?: () => void;
  retryProps: ProgressPaneActionButtonProps;
}) {
  return (
    <Callout tone="warning" live className="mb-8">
      <Callout.Title>Context snapshot unavailable</Callout.Title>
      <Callout.Content>{sanitizePresentationText(error)}</Callout.Content>
      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          bracket
          className="mt-3"
          onClick={onRetry}
          {...retryProps}
        >
          Retry
        </Button>
      ) : null}
    </Callout>
  );
}

/**
 * The run naming its own silence. Nothing animates and nothing moves: the panel
 * frame carries the state and this line says how long the stream has been quiet,
 * so "the model is thinking" and "the pipe is dead" stop looking alike.
 */
function StreamLivenessNotice({
  state,
  lastEventAt,
  onReconnect,
  reconnectProps,
}: {
  state: Exclude<LogStreamState, "flowing">;
  lastEventAt: number;
  onReconnect?: () => void;
  reconnectProps: ProgressPaneActionButtonProps;
}) {
  const now = useReviewClock();
  const elapsed = formatDuration(Math.max(0, now - lastEventAt));
  const verdict = state === "stalled" ? "Stream stalled" : "Stream quiet";

  return (
    <div className="mb-6 space-y-2">
      <output
        aria-live="polite"
        className={cn(
          // <output> is display:inline by default, which puts the Reconnect
          // button on the sentence's own line and defeats the space-y-2 stack.
          "block font-mono text-xs",
          state === "stalled" ? "text-error-text" : "text-warning-text",
        )}
      >
        {`${verdict} — no events for ${elapsed}.`}
      </output>
      {state === "stalled" && onReconnect && (
        <Button variant="outline" size="sm" bracket onClick={onReconnect} {...reconnectProps}>
          Reconnect
        </Button>
      )}
    </div>
  );
}

export function ReviewProgressView({
  data,
  isRunning,
  error,
  errorCode,
  transportFamily,
  reviewId,
  contextRefreshError,
  onRetryContextRefresh,
  onRetry,
  onViewRun,
  onViewResults,
  onCancel,
  onBack,
  cancelDisabled = false,
}: ReviewProgressViewProps) {
  const { steps, events, agents, lensStats, metrics, startTime, contextSnapshot, notices } = data;
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const hasError = Boolean(error);
  // The advisory stands down the moment the run has a failure to report: two
  // callouts about the same review would only compete for the reader.
  const sizeWarning = hasError ? null : (data.sizeWarning ?? null);

  const progressPaneFocus = useFocusWithin<HTMLElement>();
  const logPaneFocus = useFocusWithin<HTMLElement>();
  const liveness = useStreamLiveness({ events, isRunning });

  const reconnect = reviewId && onRetry ? () => onRetry(reviewId) : undefined;
  const stalledReconnect = isRunning && liveness.state === "stalled" ? reconnect : undefined;
  const contextRetry = contextRefreshError ? onRetryContextRefresh : undefined;
  // Independent faults recover independently: r repairs every visible
  // affordance, so the footer's "r Retry" stays truthful when both render.
  const retryRecovery =
    stalledReconnect || contextRetry
      ? () => {
          stalledReconnect?.();
          contextRetry?.();
        }
      : undefined;

  // The pane's rendered action buttons in DOM order; the keyboard hook gives
  // them Tab/arrow traversal and the roving mark.
  const paneActions = [
    ...(stalledReconnect ? [{ id: "reconnect" }] : []),
    ...(contextRetry ? [{ id: "context-retry" }] : []),
    ...(isRunning && onCancel && !hasError ? [{ id: "cancel", disabled: cancelDisabled }] : []),
    ...(onViewResults && !hasError ? [{ id: "view-results" }] : []),
  ];

  // The chip row's own order, so [ and ] walk exactly what the eye sees, and
  // wrap where the row ends.
  const cycleAgentFilter = (direction: 1 | -1) => {
    const chips = [ALL_AGENTS_VALUE, ...agents.map((agent) => agent.meta.name)];
    const index = chips.indexOf(agentFilter ?? ALL_AGENTS_VALUE);
    const next = chips[clampIndex(index, direction, chips.length, true)] ?? ALL_AGENTS_VALUE;
    setAgentFilter(next === ALL_AGENTS_VALUE ? null : next);
  };

  const {
    progressPaneRef,
    progressScrollRef,
    actionsRowRef,
    agentFilterRef,
    logContentRef,
    errorPanelRef,
    snapshotDownloadsRef,
    chromeReturnZone,
    handleFilterKeyDown,
    handleLogBoundary,
    isAgentFilterFocused,
    getPaneActionProps,
  } = useReviewProgressKeyboard({
    onViewResults,
    onBack,
    onCancel: isRunning ? onCancel : undefined,
    onRetryRecovery: retryRecovery,
    cancelDisabled,
    hasError,
    hasSnapshotDownloads: !isRunning && contextSnapshot != null,
    hasAgentFilters: agents.length > 0,
    activeAgentFilter: agentFilter,
    onCycleAgentFilter: cycleAgentFilter,
    actions: paneActions,
  });

  const errorGuidance = error ? classifyReviewStreamError(error, errorCode, transportFamily) : null;

  const errorActions = errorGuidance
    ? buildErrorActions({
        guidance: errorGuidance,
        onBack,
        onRetry:
          errorGuidance.kind === "transport" && reviewId && onRetry
            ? () => onRetry(reviewId)
            : undefined,
        // The server skips the partial write when the run streamed no issues, so
        // without one there is no record to open — and the action would trade
        // this screen for a dead end.
        onViewRun:
          isSessionTerminationCode(errorCode ?? "") &&
          metrics.issuesFound > 0 &&
          reviewId &&
          onViewRun
            ? () => onViewRun(reviewId)
            : undefined,
      })
    : [];

  const agentOptions = agents.map((agent) => ({
    id: agent.id,
    name: agent.meta.name,
    badgeLabel: agent.meta.badgeLabel,
    badgeVariant: agent.meta.badgeVariant,
  }));

  const partialFailure = getPartialFailureWarning(agents, error ?? null, lensStats);

  return (
    <ReviewClockProvider running={isRunning}>
      {/* Same pane rhythm as history/providers: 1px column gap so the pane
          frames read as one shared rule, --panel-hairline lifted to the full
          border token (this deliberately firms inner rules too); pt-4 doubles
          as the notched Panel.Label clearance. */}
      <div className="grid flex-1 gap-x-px gap-y-6 px-4 pt-4 pb-4 max-md:overflow-y-auto [--panel-hairline:var(--border)] md:min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
        <Panel
          ref={progressPaneRef}
          as="section"
          {...progressPaneFocus.props}
          aria-label="Progress"
          data-pane="progress"
          focused={progressPaneFocus.focusWithin}
          tone={PANEL_TONE_BY_LIVENESS[isRunning ? liveness.state : "flowing"]}
          className="flex min-w-0 flex-col md:min-h-0"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Progress
          </Panel.Label>

          <ScrollArea
            ref={progressScrollRef}
            tabIndex={-1}
            className="flex-1 px-4 pt-4 focus:outline-none md:min-h-0"
          >
            <ProgressList steps={steps} className="mb-8" />

            {isRunning && liveness.state !== "flowing" && (
              <StreamLivenessNotice
                state={liveness.state}
                lastEventAt={liveness.lastEventAt}
                onReconnect={reconnect}
                reconnectProps={getPaneActionProps("reconnect")}
              />
            )}

            {/* Frozen percentages must stop reading as live progress. */}
            <AgentBoard
              agents={agents}
              className={isRunning && liveness.state === "stalled" ? "opacity-40" : undefined}
            />

            {contextRefreshError ? (
              <ContextRefreshErrorNotice
                error={contextRefreshError}
                onRetry={onRetryContextRefresh}
                retryProps={getPaneActionProps("context-retry")}
              />
            ) : null}

            {contextSnapshot && !isRunning ? (
              <ContextSnapshotPreview
                snapshot={contextSnapshot}
                downloadsRef={snapshotDownloadsRef}
              />
            ) : null}
          </ScrollArea>

          <div className="shrink-0 px-4">
            {/* Metrics own the panel-footer slot even though the action row can
                follow them: that row is conditional, so the metrics band is the
                pane's baseline bottom row and the one the footer rule sits above. */}
            <ReviewMetricsFooter metrics={metrics} startTime={startTime} />

            {(onViewResults || (isRunning && onCancel)) && !error && (
              <div ref={actionsRowRef} className="flex flex-wrap gap-3 pb-4">
                {isRunning && onCancel && (
                  <Button
                    variant="secondary"
                    bracket
                    disabled={cancelDisabled}
                    onClick={onCancel}
                    {...getPaneActionProps("cancel")}
                  >
                    {REVIEW_PROGRESS_CONTROLS.cancel.label}
                  </Button>
                )}
                {onViewResults && (
                  <Button
                    variant="primary"
                    bracket
                    onClick={onViewResults}
                    {...getPaneActionProps("view-results")}
                  >
                    View Results
                  </Button>
                )}
              </div>
            )}
          </div>
        </Panel>

        <Panel
          as="section"
          {...logPaneFocus.props}
          aria-label="Live Activity Log"
          data-pane="log"
          focused={logPaneFocus.focusWithin}
          className="flex min-w-0 flex-col md:min-h-0"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Live Activity Log
          </Panel.Label>

          <div
            ref={agentFilterRef}
            className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3"
          >
            <AgentFilterBar
              agents={agentOptions}
              active={agentFilter}
              isFocused={isAgentFilterFocused}
              onChange={setAgentFilter}
              onKeyDown={handleFilterKeyDown}
            />
            <span className="shrink-0 text-2xs text-muted-foreground font-mono max-sm:hidden">
              tail -f agent.log
            </span>
          </div>

          <div ref={logContentRef} className="flex flex-1 min-h-0 flex-col">
            {sizeWarning && (
              <div className="px-4 pb-2">
                <Callout tone="warning" live>
                  <Callout.Title>{SIZE_WARNING_TITLE}</Callout.Title>
                  {/* One Content only: the callout grid has a single `body`
                      cell, so two Content children render on top of each other. */}
                  <Callout.Content>
                    {sanitizePresentationText(sizeWarning.message)}
                    {/* Only while the run is still reading: once it has finished
                        there are results to read, and narrowing it now would throw
                        them away for nothing. */}
                    {isRunning && <span className="mt-1 block">{SIZE_WARNING_ACTION_LINE}</span>}
                  </Callout.Content>
                </Callout>
              </div>
            )}

            {partialFailure.hasPartialFailure && (
              <div className="px-4 pb-2">
                <Callout tone="warning" live>
                  <Callout.Title>Partial Analysis</Callout.Title>
                  <Callout.Content>{partialFailure.message}</Callout.Content>
                </Callout>
              </div>
            )}

            {notices.length > 0 && (
              <output className="shrink-0 px-4 pb-2 text-sm text-warning-text">
                {notices.map((notice) => (
                  <div key={notice}>{notice}</div>
                ))}
              </output>
            )}

            {error && errorGuidance && (
              <ErrorDisplay
                error={error}
                guidance={errorGuidance}
                actions={errorActions}
                panelRef={errorPanelRef}
                chromeReturnZone={chromeReturnZone}
                hasBack={Boolean(onBack)}
              />
            )}
            <ActivityLog
              events={events}
              sourceFilter={agentFilter}
              streamState={isRunning ? liveness.state : null}
              agents={agents}
              startTime={startTime}
              lastEventAt={liveness.lastEventAt}
              onTopBoundaryReached={handleLogBoundary}
              // The pane brackets carry the focus signal on every layout, so the
              // log drops its own tab stop and inset outline — the same treatment
              // the progress pane's scroller gets above. The error cycle reaches
              // it as a zone target, not as a native tab stop.
              tabIndex={-1}
              // Below md the page scroller owns the whole stack: the log opts out of
              // scrolling on both axes (one axis left non-visible forces the other back
              // to auto) and grows with its content, floored at the height that keeps
              // the pane reading as a log when the run has barely started.
              className="flex-1 min-h-0 px-2 pb-2 focus:outline-none max-md:min-h-[45dvh] max-md:flex-none max-md:overflow-x-visible max-md:overflow-y-visible"
            />
          </div>
        </Panel>
      </div>
    </ReviewClockProvider>
  );
}
