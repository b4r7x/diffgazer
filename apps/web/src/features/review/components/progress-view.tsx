import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { formatDuration } from "@diffgazer/core/format";
import {
  classifyReviewStreamError,
  getPartialFailureWarning,
  isProviderRecoveryError,
  type LogStreamState,
  type ReviewEvent,
  type ReviewStreamErrorGuidance,
  sanitizePresentationText,
} from "@diffgazer/core/review";
import type { TransportFamily } from "@diffgazer/core/schemas/config";
import type { AgentState, LensStat } from "@diffgazer/core/schemas/events";
import type {
  BadgeVariant,
  ProgressStepData,
  ReviewProgressMetrics,
} from "@diffgazer/core/schemas/presentation";
import { Badge } from "@diffgazer/ui/components/badge";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { Panel } from "@diffgazer/ui/components/panel";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { cn } from "@diffgazer/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useFocusWithin } from "@/hooks/use-focus-within";
import { ReviewClockProvider, useReviewClock } from "../hooks/use-clock";
import {
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
  onViewResults?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
  cancelDisabled?: boolean;
}

interface AgentOption {
  id: string;
  name: string;
  badgeLabel?: string;
  badgeVariant?: BadgeVariant;
}

function AgentFilterBar({
  agents,
  active,
  onChange,
}: {
  agents: AgentOption[];
  active: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <ToggleGroup
      value={active ?? "all"}
      onChange={(value) => onChange(value === "all" ? null : value)}
      label="Agent filter"
      className="items-center pb-2"
    >
      <ToggleGroupItem
        value="all"
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
            variant={agent.badgeVariant ?? "info"}
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

function ErrorDisplay({
  error,
  guidance,
  onBack,
  onRetry,
}: {
  error: string;
  guidance: ReviewStreamErrorGuidance;
  onBack?: () => void;
  onRetry?: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="shrink-0 px-4 pb-3">
      <Panel tone="error" role="alert" aria-live="assertive" className="p-4 text-left max-w-prose">
        <div className="text-error-text mb-2 text-lg font-bold">{guidance.title}</div>
        <div className="text-muted-foreground font-mono text-sm mb-2">
          {sanitizePresentationText(error)}
        </div>
        <div className="text-muted-foreground mb-4 text-sm">{guidance.guidance}</div>
        <div className="flex flex-wrap gap-3">
          {onBack && (
            <Button variant="secondary" bracket onClick={onBack}>
              Back to Home
            </Button>
          )}
          {isProviderRecoveryError(guidance.kind) && (
            <Button
              variant="outline"
              bracket
              className="border-warning text-warning-text hover:bg-warning/10"
              onClick={() => navigate({ to: "/settings/providers" })}
            >
              {guidance.ctaLabel}
            </Button>
          )}
          {guidance.kind === "transport" && onRetry && (
            <Button variant="outline" bracket onClick={onRetry}>
              {guidance.ctaLabel}
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}

const PANEL_TONE_BY_LIVENESS = {
  flowing: undefined,
  quiet: "warning",
  stalled: "error",
} as const satisfies Record<LogStreamState, "warning" | "error" | undefined>;

function ContextRefreshErrorNotice({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <Callout tone="warning" live className="mb-8">
      <Callout.Title>Context snapshot unavailable</Callout.Title>
      <Callout.Content>{sanitizePresentationText(error)}</Callout.Content>
      {onRetry ? (
        <Button variant="outline" size="sm" bracket className="mt-3" onClick={onRetry}>
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
}: {
  state: Exclude<LogStreamState, "flowing">;
  lastEventAt: number;
  onReconnect?: () => void;
}) {
  const now = useReviewClock();
  const elapsed = formatDuration(Math.max(0, now - lastEventAt));
  const verdict = state === "stalled" ? "Stream stalled" : "Stream quiet";

  return (
    <div className="mb-6 space-y-2">
      <output
        aria-live="polite"
        className={cn(
          "font-mono text-xs",
          state === "stalled" ? "text-error-text" : "text-warning-text",
        )}
      >
        {`${verdict} — no events for ${elapsed}.`}
      </output>
      {state === "stalled" && onReconnect && (
        <Button variant="outline" size="sm" bracket onClick={onReconnect}>
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
  onViewResults,
  onCancel,
  onBack,
  cancelDisabled = false,
}: ReviewProgressViewProps) {
  const { steps, events, agents, lensStats, metrics, startTime, contextSnapshot, notices } = data;
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const hasError = Boolean(error);

  const progressPaneFocus = useFocusWithin<HTMLElement>();
  const logPaneFocus = useFocusWithin<HTMLElement>();
  const { progressPaneRef, progressScrollRef, agentFilterRef, logContentRef } =
    useReviewProgressKeyboard({
      onViewResults,
      onBack,
      onCancel: isRunning ? onCancel : undefined,
      cancelDisabled,
      hasError,
    });

  const errorGuidance = error ? classifyReviewStreamError(error, errorCode, transportFamily) : null;

  const agentOptions = agents.map((agent) => ({
    id: agent.id,
    name: agent.meta.name,
    badgeLabel: agent.meta.badgeLabel,
    badgeVariant: agent.meta.badgeVariant,
  }));

  const partialFailure = getPartialFailureWarning(agents, error ?? null, lensStats);
  const liveness = useStreamLiveness({ events, isRunning });

  return (
    <ReviewClockProvider running={isRunning}>
      <div className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-4 max-md:overflow-y-auto md:flex-row md:overflow-hidden">
        <Panel
          ref={progressPaneRef}
          as="section"
          {...progressPaneFocus.props}
          aria-label="Progress"
          data-pane="progress"
          focused={progressPaneFocus.focusWithin}
          tone={PANEL_TONE_BY_LIVENESS[isRunning ? liveness.state : "flowing"]}
          className="flex w-full flex-col max-md:shrink-0 md:min-h-0 md:w-1/3"
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
                onReconnect={reviewId && onRetry ? () => onRetry(reviewId) : undefined}
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
              />
            ) : null}

            {contextSnapshot && !isRunning ? (
              <ContextSnapshotPreview snapshot={contextSnapshot} />
            ) : null}
          </ScrollArea>

          <div className="shrink-0 px-4">
            <ReviewMetricsFooter metrics={metrics} startTime={startTime} />

            {(onViewResults || (isRunning && onCancel)) && !error && (
              <div className="flex flex-wrap gap-3 pb-4">
                {isRunning && onCancel && (
                  <Button variant="secondary" bracket disabled={cancelDisabled} onClick={onCancel}>
                    {REVIEW_PROGRESS_CONTROLS.cancel.label}
                  </Button>
                )}
                {onViewResults && (
                  <Button variant="primary" bracket onClick={onViewResults}>
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
          className="flex w-full flex-col max-md:shrink-0 md:min-h-0 md:flex-1"
        >
          <Panel.Label variant="border" aria-hidden="true">
            Live Activity Log
          </Panel.Label>

          <div
            ref={agentFilterRef}
            className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3"
          >
            <AgentFilterBar agents={agentOptions} active={agentFilter} onChange={setAgentFilter} />
            <span className="shrink-0 text-2xs text-muted-foreground font-mono max-sm:hidden">
              tail -f agent.log
            </span>
          </div>

          <div ref={logContentRef} className="flex flex-1 min-h-0 flex-col">
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
                onBack={onBack}
                onRetry={
                  errorGuidance.kind === "transport" && reviewId && onRetry
                    ? () => onRetry(reviewId)
                    : undefined
                }
              />
            )}
            <ActivityLog
              events={events}
              sourceFilter={agentFilter}
              streamState={isRunning ? liveness.state : null}
              agents={agents}
              startTime={startTime}
              lastEventAt={liveness.lastEventAt}
              // Below md the page scroller owns the whole stack: the log opts out of
              // scrolling on both axes (one axis left non-visible forces the other back
              // to auto) and grows with its content, floored at the height that keeps
              // the pane reading as a log when the run has barely started.
              className="flex-1 min-h-0 px-2 pb-2 max-md:min-h-[45dvh] max-md:flex-none max-md:overflow-x-visible max-md:overflow-y-visible"
            />
          </div>
        </Panel>
      </div>
    </ReviewClockProvider>
  );
}
