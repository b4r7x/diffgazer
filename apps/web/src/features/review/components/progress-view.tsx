import type { ReviewContextResponse } from "@diffgazer/core/api/types";
import { getPartialFailureWarning } from "@diffgazer/core/review";
import type { AgentState } from "@diffgazer/core/schemas/events";
import type { BadgeVariant, ReviewProgressMetrics } from "@diffgazer/core/schemas/presentation";
import { Badge } from "@diffgazer/ui/components/badge";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { ToggleGroup, ToggleGroupItem } from "@diffgazer/ui/components/toggle-group";
import { cn } from "@diffgazer/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ProgressList, type ProgressStepData } from "@/components/shared/progress/list";
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
  onCancel,
}: {
  error: string;
  isApiKeyError: boolean;
  onCancel?: () => void;
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
          <Button variant="secondary" bracket onClick={onCancel}>
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

function isReviewStepReadyToExpand(steps: ProgressStepData[]): boolean {
  const reviewStep = steps.find((s) => s.id === "review");
  return reviewStep?.status === "active" && !!reviewStep.substeps && reviewStep.substeps.length > 0;
}

export function ReviewProgressView({
  data,
  isRunning,
  error,
  onViewResults,
  onCancel,
}: ReviewProgressViewProps) {
  const { steps, entries, agents, metrics, startTime, contextSnapshot, notices } = data;
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);

  const { focusPane } = useReviewProgressKeyboard({ onViewResults, onCancel });

  // Auto-expand the review step the first render it becomes expandable, derived
  // during render (no state-sync effect). The latch keeps a manual collapse from
  // being re-expanded on later renders.
  if (!hasAutoExpanded && isReviewStepReadyToExpand(steps)) {
    setHasAutoExpanded(true);
    setExpandedStepId("review");
  }

  const isApiKeyError = error ? API_KEY_ERROR_PATTERN.test(error) : false;

  const expandedIds = expandedStepId ? [expandedStepId] : [];

  const handleStepToggle = (id: string) => {
    setExpandedStepId((prev) => (prev === id ? null : id));
  };

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
    <div className="flex flex-1 overflow-hidden px-4">
      <div
        className={cn(
          "w-1/3 flex flex-col border-r border-border px-4 min-h-0 overflow-y-auto scrollbar-hide",
          focusPane === "progress" && "ring-1 ring-info ring-inset",
        )}
      >
        <div className="flex-1 overflow-y-auto scrollbar-hide pr-2">
          <div className="mb-8 pt-2">
            <SectionHeader variant="muted" className="mb-4">
              Progress Overview
            </SectionHeader>
            <ProgressList steps={steps} expandedIds={expandedIds} onToggle={handleStepToggle} />
          </div>

          <AgentBoard agents={agents} />

          {contextSnapshot && !isRunning && <ContextSnapshotPreview snapshot={contextSnapshot} />}
        </div>

        <ReviewMetricsFooter metrics={metrics} startTime={startTime} isRunning={isRunning} />

        {isRunning && onCancel && (
          <div className="shrink-0 flex flex-wrap gap-3 pb-4">
            <Button variant="secondary" bracket onClick={onCancel}>
              Cancel
            </Button>
            {onViewResults && (
              <Button variant="outline" bracket onClick={onViewResults}>
                View Results
              </Button>
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          "w-2/3 flex flex-col pl-6 overflow-hidden",
          focusPane === "log" && "ring-1 ring-info ring-inset",
        )}
      >
        <div className="flex justify-between items-end mb-2 pt-2 border-b border-border pb-2">
          <SectionHeader variant="muted" className="mb-0">
            Live Activity Log
          </SectionHeader>
          <span className="text-2xs text-muted-foreground font-mono">tail -f agent.log</span>
        </div>

        <AgentFilterBar agents={agentOptions} active={agentFilter} onChange={setAgentFilter} />

        {partialFailure.hasPartialFailure && (
          <div className="pb-2">
            <Callout tone="warning" live>
              <Callout.Title>Partial Analysis</Callout.Title>
              <Callout.Content>{partialFailure.message}</Callout.Content>
            </Callout>
          </div>
        )}

        {notices.length > 0 && (
          <output className="shrink-0 pb-2 text-sm text-warning-text">
            {notices.map((notice) => (
              <div key={notice}>{notice}</div>
            ))}
          </output>
        )}

        {error ? (
          <ErrorDisplay error={error} isApiKeyError={isApiKeyError} onCancel={onCancel} />
        ) : (
          <ActivityLog
            entries={filteredEntries}
            showCursor={isRunning}
            autoScroll={true}
            className="flex-1"
          />
        )}
      </div>
    </div>
  );
}
