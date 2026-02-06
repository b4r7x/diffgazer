import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/utils/cn';
import { PanelHeader } from '@/components/ui/containers';
import { ProgressList, type ProgressStepData } from '@/components/ui/progress';
import { ActivityLog, type LogEntryData } from './activity-log';
import { AgentBoard } from './agent-board';
import { ContextSnapshotPreview } from './context-snapshot-preview';
import { ReviewMetricsFooter } from './review-metrics-footer';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { useReviewProgressKeyboard } from '../hooks/use-review-progress-keyboard';
import type { AgentState } from '@stargazer/schemas/events';
import type { ReviewContextResponse } from '@stargazer/api/types';
import type { ReviewProgressMetrics } from '../types';

export interface ReviewProgressData {
  steps: ProgressStepData[];
  entries: LogEntryData[];
  agents: AgentState[];
  metrics: ReviewProgressMetrics;
  startTime?: Date;
  contextSnapshot?: ReviewContextResponse | null;
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
  badgeVariant?: string;
}

function AgentFilterBar({ agents, active, onChange }: { agents: AgentOption[]; active: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex items-center gap-2 pb-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'text-[10px] font-mono px-2 py-1 border',
          active === null ? 'border-tui-blue text-tui-blue' : 'border-tui-border text-gray-500'
        )}
      >
        All
      </button>
      {agents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          onClick={() => onChange(agent.name)}
          className={cn(
            'text-[10px] font-mono px-2 py-1 border',
            active === agent.name ? 'border-tui-violet text-tui-violet' : 'border-tui-border text-gray-500'
          )}
        >
          <Badge variant={(agent.badgeVariant as BadgeProps['variant']) ?? 'info'} size="sm" className="mr-1">
            {agent.badgeLabel}
          </Badge>
          <span>{agent.name}</span>
        </button>
      ))}
    </div>
  );
}

function ErrorDisplay({ error, isApiKeyError, onCancel }: { error: string; isApiKeyError: boolean; onCancel?: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center p-6 max-w-md">
        <div className="text-tui-red text-lg font-bold mb-2">
          {isApiKeyError ? 'API Key Error' : 'Error'}
        </div>
        <div className="text-gray-400 font-mono text-sm mb-2">{error}</div>
        {isApiKeyError && (
          <div className="text-gray-500 text-sm mb-4">
            Your API key may be invalid or expired.
          </div>
        )}
        <div className={cn('flex gap-3 justify-center', !isApiKeyError && 'mt-4')}>
          <Button
            variant="secondary"
            bracket
            onClick={onCancel}
          >
            Back to Home
          </Button>
          {isApiKeyError && (
            <Button
              variant="outline"
              bracket
              className="border-tui-yellow text-tui-yellow hover:bg-tui-yellow/10"
              onClick={() => navigate({ to: '/settings/providers' })}
            >
              Configure Provider
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
  onViewResults,
  onCancel,
}: ReviewProgressViewProps) {
  const { steps, entries, agents, metrics, startTime, contextSnapshot } = data;
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const hasAutoExpandedReview = useRef(false);

  const { focusPane } = useReviewProgressKeyboard({ onViewResults, onCancel });

  // Auto-expand review step once when it becomes active with substeps
  useEffect(() => {
    if (hasAutoExpandedReview.current) return;
    const reviewStep = steps.find(s => s.id === 'review');
    if (reviewStep?.status === 'active' && reviewStep.substeps && reviewStep.substeps.length > 0) {
      setExpandedStepId('review');
      hasAutoExpandedReview.current = true;
    }
  }, [steps]);

  const isApiKeyError = error && /api.?key/i.test(error);

  // Calculate expanded IDs array for ProgressList (single-expand behavior)
  const expandedIds = expandedStepId ? [expandedStepId] : [];

  // Handle step toggle (single-expand: toggle off if same, otherwise switch)
  const handleStepToggle = (id: string) => {
    setExpandedStepId(prev => prev === id ? null : id);
  };

  const agentOptions = agents.map((agent) => ({
    id: agent.id,
    name: agent.meta.name,
    badgeLabel: agent.meta.badgeLabel,
    badgeVariant: agent.meta.badgeVariant,
  }));

  const failedAgents = agents.filter((agent) => agent.status === "error");
  const hasPartialFailure = failedAgents.length > 0;
  const failedAgentNames = failedAgents.map((agent) => agent.meta.name).join(", ");

  const filteredEntries = agentFilter ? entries.filter((entry) => entry.source === agentFilter) : entries;

  return (
    <div className="flex flex-1 overflow-hidden px-4">
      {/* Left Panel - Progress Overview */}
      <div
        className={cn(
          'w-1/3 flex flex-col border-r border-tui-border pr-6 min-h-0 overflow-y-auto scrollbar-hide',
          focusPane === 'progress' && 'ring-1 ring-tui-blue ring-inset'
        )}
      >
        <div className="flex-1 overflow-y-auto scrollbar-hide pr-2">
          <div className="mb-8 pt-2">
            <PanelHeader variant="section">Progress Overview</PanelHeader>
            <ProgressList
              steps={steps}
              expandedIds={expandedIds}
              onToggle={handleStepToggle}
            />
          </div>

          <AgentBoard agents={agents} />

          {contextSnapshot && !isRunning && (
            <ContextSnapshotPreview snapshot={contextSnapshot} />
          )}
        </div>

        <ReviewMetricsFooter metrics={metrics} startTime={startTime} isRunning={isRunning} />
      </div>

      {/* Right Panel - Activity Log */}
      <div
        className={cn(
          'w-2/3 flex flex-col pl-6 overflow-hidden',
          focusPane === 'log' && 'ring-1 ring-tui-blue ring-inset'
        )}
      >
        <div className="flex justify-between items-end mb-2 pt-2 border-b border-tui-border pb-2">
          <PanelHeader variant="section" className="mb-0">Live Activity Log</PanelHeader>
          <span className="text-[10px] text-gray-600 font-mono">tail -f agent.log</span>
        </div>

        <AgentFilterBar agents={agentOptions} active={agentFilter} onChange={setAgentFilter} />

        {hasPartialFailure && !error && (
          <div className="pb-2">
            <Callout variant="warning" title="Partial Analysis">
              {failedAgents.length} agent{failedAgents.length === 1 ? "" : "s"} failed (likely rate limited): {failedAgentNames}. Results may be incomplete.
            </Callout>
          </div>
        )}

        {error ? (
          <ErrorDisplay error={error} isApiKeyError={!!isApiKeyError} onCancel={onCancel} />
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
