import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { getPartialFailureWarning } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
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
import { cn } from "@diffgazer/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ProgressList } from "@/components/shared/progress/list";
import { useReviewProgressKeyboard } from "../hooks/use-progress-keyboard";
import { ActivityLog, type LogEntryData } from "./activity-log";
import { AgentBoard } from "./agent-board";
import { ContextSnapshotPreview } from "./context-snapshot-preview";
import { ReviewMetricsFooter } from "./metrics-footer";

export interface ReviewProgressData {
  steps: ProgressStepData[];
  entries: LogEntryData[];
  agents: AgentState[];
  metrics: ReviewProgressMetrics;
  startTime?: Date;
  contextSnapshot?: ReviewContextResponse | null;
  notices: string[];
}

export interface ReviewProgressViewProps {
  data: ReviewProgressData;
  isRunning: boolean;
  error?: string | null;
  onViewResults?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
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
      <ToggleGroupItem value="all" className="min-h-0 min-w-0 px-2 py-1 text-2xs">
        All
      </ToggleGroupItem>
      {agents.map((agent) => (
        <ToggleGroupItem
          key={agent.id}
          value={agent.name}
          className="min-h-0 min-w-0 px-2 py-1 text-2xs"
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
  isApiKeyError,
  onBack,
}: {
  error: string;
  isApiKeyError: boolean;
  onBack?: () => void;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center">
      <div role="alert" aria-live="assertive" className="text-center p-6 max-w-md">
        <div className="text-error-text text-lg font-bold mb-2">
          {isApiKeyError ? "API Key Error" : "Error"}
        </div>
        <div className="text-muted-foreground font-mono text-sm mb-2">{error}</div>
        {isApiKeyError && (
          <div className="text-muted-foreground text-sm mb-4">
            Your API key may be invalid or expired.
          </div>
        )}
        <div className={cn("flex gap-3 justify-center", !isApiKeyError && "mt-4")}>
          <Button variant="secondary" bracket onClick={onBack}>
            Back to Home
          </Button>
          {isApiKeyError && (
            <Button
              variant="outline"
              bracket
              className="border-warning text-warning-text hover:bg-warning/10"
              onClick={() => navigate({ to: "/settings/providers" })}
            >
              Configure Provider
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const API_KEY_ERROR_PATTERN = /api.?key/i;

export function ReviewProgressView({
  data,
  isRunning,
  error,
  onViewResults,
  onCancel,
  onBack,
}: ReviewProgressViewProps) {
  const { steps, entries, agents, metrics, startTime, contextSnapshot, notices } = data;
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
    hasError,
  });

  const isApiKeyError = error ? API_KEY_ERROR_PATTERN.test(error) : false;

  const agentOptions = agents.map((agent) => ({
    id: agent.id,
    name: agent.meta.name,
    badgeLabel: agent.meta.badgeLabel,
    badgeVariant: agent.meta.badgeVariant,
  }));

  const partialFailure = getPartialFailureWarning(agents, error ?? null);

  const filteredEntries = agentFilter
    ? entries.filter((entry) => entry.source === agentFilter)
    : entries;

  return (
    <div className="flex flex-1 gap-4 overflow-hidden px-4 pt-4 pb-4">
      <Panel
        ref={progressPaneRef}
        as="section"
        aria-label="Progress"
        data-pane="progress"
        data-focused={focusPane === "progress" || undefined}
        className="w-1/3 flex flex-col min-h-0 border border-border data-[focused]:border-info"
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
                <Button variant="secondary" bracket onClick={onCancel}>
                  Cancel
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
        className="flex-1 flex flex-col min-h-0 border border-border data-[focused]:border-info"
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

          {error ? (
            <ErrorDisplay error={error} isApiKeyError={isApiKeyError} onBack={onBack} />
          ) : (
            <ActivityLog
              entries={filteredEntries}
              showCursor={isRunning}
              autoScroll={true}
              className="flex-1 min-h-0 px-2 pb-2"
            />
          )}
        </div>
      </Panel>
    </div>
  );
}
