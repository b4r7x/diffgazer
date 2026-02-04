import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { cn } from '@/lib/utils';
import { PanelHeader, ProgressList, ActivityLog, Timer, MetricItem } from '@/components/ui';
import { useScope, useKey } from '@/hooks/keyboard';
import { usePageFooter } from '@/hooks/use-page-footer';
import type { ProgressStepData, LogEntryData } from '@/components/ui';
import type { ReviewProgressMetrics } from '../types';

export interface ReviewProgressViewProps {
  mode: 'unstaged' | 'staged' | 'files';
  steps: ProgressStepData[];
  entries: LogEntryData[];
  metrics: ReviewProgressMetrics;
  isRunning: boolean;
  error?: string | null;
  startTime?: Date;
  onViewResults?: () => void;
  onCancel?: () => void;
}

export function ReviewProgressView({
  mode: _mode,
  steps,
  entries,
  metrics,
  isRunning,
  error,
  startTime,
  onViewResults,
  onCancel,
}: ReviewProgressViewProps) {
  const navigate = useNavigate();
  const [focusPane, setFocusPane] = useState<'progress' | 'log'>('progress');
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const hasAutoExpandedTriage = useRef(false);

  // Auto-expand triage step once when it becomes active with substeps
  useEffect(() => {
    if (hasAutoExpandedTriage.current) return;
    const triageStep = steps.find(s => s.id === 'triage');
    if (triageStep?.status === 'active' && triageStep.substeps && triageStep.substeps.length > 0) {
      setExpandedStepId('triage');
      hasAutoExpandedTriage.current = true;
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

  // Footer shortcuts - memoized to prevent infinite rerender
  const shortcuts = useMemo(() => [
    { key: '←/→', label: 'Pane' },
    { key: '↑/↓', label: 'Navigate' },
    { key: 'Enter', label: 'View Results' },
  ], []);

  const rightShortcuts = useMemo(() => [
    { key: 'Esc', label: 'Cancel' },
  ], []);

  usePageFooter({ shortcuts, rightShortcuts });

  return (
    <div className="flex flex-1 overflow-hidden px-4">
      {/* Left Panel - Progress Overview */}
      <div
        className={cn(
          'w-1/3 flex flex-col border-r border-tui-border pr-6',
          focusPane === 'progress' && 'ring-1 ring-tui-blue ring-inset'
        )}
      >
        <div className="mb-8 pt-2">
          <PanelHeader variant="section">Progress Overview</PanelHeader>
          <ProgressList
            steps={steps}
            expandedIds={expandedIds}
            onToggle={handleStepToggle}
          />
        </div>

        {/* Metrics at bottom */}
        <div className="mt-auto mb-6">
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
            entries={entries}
            showCursor={isRunning}
            autoScroll={true}
            className="flex-1"
          />
        )}
      </div>
    </div>
  );
}
