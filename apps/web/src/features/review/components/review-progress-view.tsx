import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { PanelHeader } from '@/components/ui/containers';
import { ProgressList, type ProgressStepData } from '@/components/ui/progress';
import { ActivityLog, type LogEntryData } from '@/components/ui/activity-log';
import { Timer } from '@/components/ui/timer';
import { MetricItem } from '@/components/ui/metric-item';
import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { useScope, useKey } from '@/hooks/keyboard';
import { usePageFooter } from '@/hooks/use-page-footer';
import type { AgentState } from '@stargazer/schemas/events';
import type { ReviewContextResponse } from '@stargazer/api/types';
import type { ReviewProgressMetrics } from '../types';

const PROGRESS_SHORTCUTS = [
  { key: '←/→', label: 'Pane' },
  { key: '↑/↓', label: 'Navigate' },
  { key: 'Enter', label: 'View Results' },
];

const PROGRESS_RIGHT_SHORTCUTS = [
  { key: 'Esc', label: 'Cancel' },
];

const AGENT_STATUS_META = {
  queued: { label: "WAIT", variant: "neutral", bar: "bg-tui-border" },
  running: { label: "RUN", variant: "info", bar: "bg-tui-blue" },
  complete: { label: "DONE", variant: "success", bar: "bg-tui-green" },
  error: { label: "FAIL", variant: "error", bar: "bg-tui-red" },
} as const;

export interface ReviewProgressViewProps {
  mode: 'unstaged' | 'staged' | 'files';
  steps: ProgressStepData[];
  entries: LogEntryData[];
  agents?: AgentState[];
  metrics: ReviewProgressMetrics;
  isRunning: boolean;
  error?: string | null;
  startTime?: Date;
  contextSnapshot?: ReviewContextResponse | null;
  onViewResults?: () => void;
  onCancel?: () => void;
}

export function ReviewProgressView({
  mode: _mode,
  steps,
  entries,
  agents = [],
  metrics,
  isRunning,
  error,
  startTime,
  contextSnapshot,
  onViewResults,
  onCancel,
}: ReviewProgressViewProps) {
  const navigate = useNavigate();
  const [focusPane, setFocusPane] = useState<'progress' | 'log'>('progress');
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const hasAutoExpandedReview = useRef(false);

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

  // Keyboard scope
  useScope('review-progress');

  // Pane navigation with left/right arrows
  useKey('ArrowLeft', () => setFocusPane('progress'), { enabled: focusPane === 'log' });
  useKey('ArrowRight', () => setFocusPane('log'), { enabled: focusPane === 'progress' });

  // Action keys
  useKey('Enter', () => onViewResults?.(), { enabled: !!onViewResults });
  useKey('Escape', () => onCancel?.(), { enabled: !!onCancel });

  usePageFooter({ shortcuts: PROGRESS_SHORTCUTS, rightShortcuts: PROGRESS_RIGHT_SHORTCUTS });

  const agentOptions = useMemo(
    () => agents.map((agent) => ({
      id: agent.id,
      name: agent.meta.name,
      badgeLabel: agent.meta.badgeLabel,
      badgeVariant: agent.meta.badgeVariant,
    })),
    [agents]
  );

  const agentStatusMeta = AGENT_STATUS_META;

  const failedAgents = useMemo(
    () => agents.filter((agent) => agent.status === "error"),
    [agents]
  );

  const hasPartialFailure = failedAgents.length > 0;
  const failedAgentNames = useMemo(
    () => failedAgents.map((agent) => agent.meta.name).join(", "),
    [failedAgents]
  );

  const filteredEntries = useMemo(
    () => (agentFilter ? entries.filter((entry) => entry.source === agentFilter) : entries),
    [entries, agentFilter]
  );

  const contextPreview = useMemo(() => {
    if (!contextSnapshot) return null;
    const lines = contextSnapshot.text.split("\n");
    return {
      preview: lines.slice(0, 10).join("\n"),
      truncated: lines.length > 10,
    };
  }, [contextSnapshot]);

  const handleDownload = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

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

          {agents.length > 0 && (
            <div className="mb-8">
              <PanelHeader variant="section-bordered">Agent Board</PanelHeader>
              <div className="space-y-2">
                {agents.map((agent) => {
                  const status = agentStatusMeta[agent.status];
                  return (
                    <div key={agent.id} className="border border-tui-border bg-tui-selection/20 p-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={agent.meta.badgeVariant ?? "info"} size="sm">
                          {agent.meta.badgeLabel}
                        </Badge>
                        <span className="text-sm font-bold text-tui-fg">{agent.meta.name}</span>
                        <Badge variant={status.variant} size="sm" className="ml-auto">
                          {status.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {agent.currentAction ?? "Standing by"}
                      </div>
                      <div className="mt-2 h-1 w-full bg-tui-border">
                        <div
                          className={cn("h-1 transition-all", status.bar)}
                          style={{ width: `${Math.max(0, Math.min(100, agent.progress))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {contextSnapshot && !isRunning && (
            <div className="mb-8">
              <PanelHeader variant="section-bordered">Context Snapshot</PanelHeader>
              <div className="text-xs text-gray-500">
                {contextSnapshot.meta.charCount.toLocaleString()} chars
              </div>
              {contextPreview && (
                <pre className="mt-3 max-h-28 overflow-auto border border-tui-border bg-tui-selection/10 p-2 text-[10px] text-gray-500">
                  {contextPreview.preview}
                  {contextPreview.truncated ? "\n... (preview)" : ""}
                </pre>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => handleDownload("context.txt", contextSnapshot.text, "text/plain")}
                  className="px-3 py-1 border border-tui-border text-xs font-mono hover:bg-tui-selection/30"
                >
                  [ Download .txt ]
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload("context.md", contextSnapshot.markdown, "text/markdown")}
                  className="px-3 py-1 border border-tui-border text-xs font-mono hover:bg-tui-selection/30"
                >
                  [ Download .md ]
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleDownload("context.json", JSON.stringify(contextSnapshot.graph, null, 2), "application/json")
                  }
                  className="px-3 py-1 border border-tui-border text-xs font-mono hover:bg-tui-selection/30"
                >
                  [ Download .json ]
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Metrics footer */}
        <div className="shrink-0 pt-4 pb-6 border-t border-tui-border">
          <PanelHeader variant="section-bordered">Metrics</PanelHeader>
          <div className="space-y-3 pt-2">
            <MetricItem
              label="Files Processed"
              value={metrics.filesTotal > 0
                ? `${metrics.filesProcessed}/${metrics.filesTotal}`
                : `${metrics.filesProcessed}/...`
              }
            />
            <MetricItem
              label="Issues Found"
              value={metrics.issuesFound}
              variant={metrics.issuesFound > 0 ? 'warning' : 'default'}
            />
            <MetricItem
              label="Elapsed"
              value={<Timer startTime={startTime} running={isRunning} />}
              variant="info"
            />
          </div>
        </div>
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

        <div className="flex items-center gap-2 pb-2">
          <button
            type="button"
            onClick={() => setAgentFilter(null)}
            className={cn(
              'text-[10px] font-mono px-2 py-1 border',
              agentFilter === null ? 'border-tui-blue text-tui-blue' : 'border-tui-border text-gray-500'
            )}
          >
            All
          </button>
          {agentOptions.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => setAgentFilter(agent.name)}
              className={cn(
                'text-[10px] font-mono px-2 py-1 border',
                agentFilter === agent.name ? 'border-tui-violet text-tui-violet' : 'border-tui-border text-gray-500'
              )}
            >
              <Badge variant={agent.badgeVariant ?? 'info'} size="sm" className="mr-1">
                {agent.badgeLabel}
              </Badge>
              <span>{agent.name}</span>
            </button>
          ))}
        </div>

        {hasPartialFailure && !error && (
          <div className="pb-2">
            <Callout variant="warning" title="Partial Analysis">
              {failedAgents.length} agent{failedAgents.length === 1 ? "" : "s"} failed (likely rate limited): {failedAgentNames}. Results may be incomplete.
            </Callout>
          </div>
        )}

        {error ? (
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
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-tui-border text-sm font-mono hover:bg-tui-border/20"
                >
                  [ Back to Home ]
                </button>
                {isApiKeyError && (
                  <button
                    type="button"
                    onClick={() => navigate({ to: '/settings/providers' })}
                    className="px-4 py-2 border border-tui-yellow text-tui-yellow text-sm font-mono hover:bg-tui-yellow/10"
                  >
                    [ Configure Provider ]
                  </button>
                )}
              </div>
            </div>
          </div>
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
