import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import {
  classifyReviewStreamError,
  getPartialFailureWarning,
  type ReviewEvent,
  type ReviewStreamErrorGuidance,
} from "@diffgazer/core/review";
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
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ProgressList } from "@/components/shared/progress/list";
import {
  REVIEW_PROGRESS_CONTROLS,
  useReviewProgressKeyboard,
} from "../hooks/use-progress-keyboard";
import { ActivityLog } from "./activity-log/log";
import { AgentBoard } from "./agent-board";
import { ContextSnapshotPreview } from "./context-snapshot-preview";
import { ReviewMetricsFooter } from "./metrics-footer";

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
  reviewId?: string | null;
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
          <Badge variant={agent.badgeVariant ?? "info"} size="sm" className="mr-1">
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
  const isApiKeyError = guidance.kind === "api-key";

  return (
    <div className="shrink-0 px-4 pb-3">
      <div
        role="alert"
        aria-live="assertive"
        className="rounded-md border border-error/40 bg-error/5 p-4 text-center"
      >
        <div className="text-error-text mb-2 text-lg font-bold">{guidance.title}</div>
        <div className="text-muted-foreground font-mono text-sm mb-2">{error}</div>
        <div className="text-muted-foreground mb-4 text-sm">{guidance.guidance}</div>
        <div className="flex flex-wrap justify-center gap-3">
          {onBack && (
            <Button variant="secondary" bracket onClick={onBack}>
              Back to Home
            </Button>
          )}
          {isApiKeyError && (
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
      </div>
    </div>
  );
}

export function ReviewProgressView({
  data,
  isRunning,
  error,
  errorCode,
  reviewId,
  onRetry,
  onViewResults,
  onCancel,
  onBack,
  cancelDisabled = false,
}: ReviewProgressViewProps) {
  const { steps, events, agents, lensStats, metrics, startTime, contextSnapshot, notices } = data;
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const hasError = Boolean(error);

  const {
    focusPane,
    progressPaneRef,
    progressScrollRef,
    logPaneRef,
    agentFilterRef,
    logContentRef,
  } = useReviewProgressKeyboard({
    onViewResults,
    onBack,
    onCancel: isRunning ? onCancel : undefined,
    cancelDisabled,
    hasError,
  });

  const errorGuidance = error ? classifyReviewStreamError(error, errorCode) : null;

  const agentOptions = agents.map((agent) => ({
    id: agent.id,
    name: agent.meta.name,
    badgeLabel: agent.meta.badgeLabel,
    badgeVariant: agent.meta.badgeVariant,
  }));

  const partialFailure = getPartialFailureWarning(agents, error ?? null, lensStats);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden px-4 pt-4 pb-4 md:flex-row">
      <Panel
        ref={progressPaneRef}
        as="section"
        aria-label="Progress"
        data-pane="progress"
        data-focused={focusPane === "progress" || undefined}
        className="flex min-h-0 w-full basis-1/2 flex-col border border-border data-[focused]:border-info md:w-1/3 md:basis-auto"
      >
        <Panel.Label variant="border" aria-hidden="true">
          Progress
        </Panel.Label>

        <div
          ref={progressScrollRef}
          tabIndex={-1}
          className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 pt-4 focus:outline-none"
        >
          <ProgressList steps={steps} className="mb-8" />

          <AgentBoard agents={agents} />

          {contextSnapshot && !isRunning && <ContextSnapshotPreview snapshot={contextSnapshot} />}
        </div>

        <div className="shrink-0 px-4">
          <ReviewMetricsFooter metrics={metrics} startTime={startTime} isRunning={isRunning} />

          {(onViewResults || (isRunning && onCancel)) && !error && (
            <div className="flex flex-wrap gap-3 pb-4">
              {isRunning && onCancel && (
                <Button variant="secondary" bracket disabled={cancelDisabled} onClick={onCancel}>
                  {REVIEW_PROGRESS_CONTROLS.cancel.label}
                </Button>
              )}
              {onViewResults && (
                <Button variant="outline" bracket onClick={onViewResults}>
                  View Results
                </Button>
              )}
            </div>
          )}
        </div>
      </Panel>

      <Panel
        ref={logPaneRef}
        as="section"
        aria-label="Live Activity Log"
        data-pane="log"
        data-focused={focusPane === "log" || focusPane === "filters" || undefined}
        className="flex min-h-0 w-full basis-1/2 flex-col border border-border data-[focused]:border-info md:w-auto md:basis-auto md:flex-1"
      >
        <Panel.Label variant="border" aria-hidden="true">
          Live Activity Log
        </Panel.Label>

        <div ref={agentFilterRef} className="flex items-start justify-between gap-3 px-4 pt-3">
          <AgentFilterBar agents={agentOptions} active={agentFilter} onChange={setAgentFilter} />
          <span className="shrink-0 text-2xs text-muted-foreground font-mono">
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
            showCursor={isRunning}
            className="flex-1 min-h-0 px-2 pb-2"
          />
        </div>
      </Panel>
    </div>
  );
}
