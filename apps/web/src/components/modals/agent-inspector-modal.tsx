'use client';

import * as React from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useScope, useKey } from '@/hooks/keyboard';

type TabId = 'summary' | 'evidence' | 'trace';

interface EvidenceLine {
  number: number;
  content: string;
  severity?: 'critical' | 'warning';
}

interface EvidenceFile {
  file: string;
  lines: EvidenceLine[];
}

interface AgentInspectorIssue {
  title: string;
  summary?: string;
  evidence?: EvidenceFile[];
  trace?: string[];
}

export interface AgentInspectorModalProps {
  isOpen: boolean;
  issue: AgentInspectorIssue;
  onClose: () => void;
}

export function AgentInspectorModal({ isOpen, issue, onClose }: AgentInspectorModalProps) {
  const [activeTab, setActiveTab] = React.useState<TabId>('evidence');
  const [expandedFiles, setExpandedFiles] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (isOpen && issue.evidence && issue.evidence.length > 0) {
      setExpandedFiles(new Set([issue.evidence[0].file]));
    }
  }, [isOpen, issue.evidence]);

  useScope('agent-inspector');
  useKey('Tab', () => {
    setActiveTab((prev) => {
      if (prev === 'summary') return 'evidence';
      if (prev === 'evidence') return 'trace';
      return 'summary';
    });
  }, { enabled: isOpen });

  const toggleFile = (file: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'summary', label: 'Summary' },
    { id: 'evidence', label: 'Evidence' },
    { id: 'trace', label: 'Trace' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={issue.title}>
      <div className="flex flex-col h-full max-h-[calc(90vh-8rem)]">
        {/* Tabs */}
        <div className="flex justify-center items-center py-2 border-b-2 border-[--tui-border] bg-[--tui-bg] shrink-0">
          <div className="flex gap-8 text-sm tracking-wider font-medium">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant="tab"
                data-active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  activeTab === tab.id && 'text-[--tui-violet]'
                )}
              >
                {activeTab === tab.id ? `[${tab.label}]` : tab.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0c10] scrollbar-thin">
          {activeTab === 'summary' && (
            <div className="text-[--tui-fg] text-sm leading-relaxed">
              {issue.summary || 'No summary available.'}
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="space-y-3">
              {(!issue.evidence || issue.evidence.length === 0) ? (
                <div className="text-gray-500 text-sm">No evidence available.</div>
              ) : (
                issue.evidence.map((file) => {
                  const isExpanded = expandedFiles.has(file.file);
                  const hasCritical = file.lines.some((l) => l.severity === 'critical');
                  const hasWarning = file.lines.some((l) => l.severity === 'warning');
                  const lineRange = file.lines.length > 0
                    ? `Lines ${file.lines[0].number}-${file.lines[file.lines.length - 1].number}`
                    : '';

                  return (
                    <div
                      key={file.file}
                      className={cn(
                        'flex flex-col border',
                        isExpanded && hasCritical
                          ? 'border-[--tui-blue] shadow-[0_0_15px_rgba(88,166,255,0.1)]'
                          : 'border-[--tui-border] hover:border-gray-500'
                      )}
                    >
                      <button
                        onClick={() => toggleFile(file.file)}
                        className={cn(
                          'p-2 flex justify-between items-center select-none w-full text-left',
                          isExpanded ? 'bg-[--tui-selection] border-b border-[--tui-border]' : 'bg-[--tui-bg]'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-sm transition-transform duration-200',
                              isExpanded ? 'text-[--tui-blue]' : 'text-gray-500'
                            )}
                          >
                            {isExpanded ? '\u25BC' : '\u25B6'}
                          </span>
                          <span
                            className={cn(
                              'font-bold text-sm',
                              isExpanded ? 'text-[--tui-fg]' : 'text-gray-400'
                            )}
                          >
                            {file.file}
                          </span>
                          {lineRange && (
                            <span className="text-[10px] text-gray-500 font-mono ml-2 border border-gray-700 px-1 rounded">
                              {lineRange}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {hasCritical && (
                            <span className="text-[10px] text-[--tui-red] font-bold uppercase tracking-wide flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-[--tui-red] rounded-full animate-pulse" />
                              Critical
                            </span>
                          )}
                          {!hasCritical && hasWarning && (
                            <span className="text-[10px] text-[--tui-yellow] font-bold uppercase tracking-wide">
                              Warning
                            </span>
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="bg-black/50 overflow-x-auto font-mono text-xs">
                          <div className="flex flex-col w-full">
                            {file.lines.map((line) => (
                              <div
                                key={line.number}
                                className={cn(
                                  'flex',
                                  line.severity === 'critical'
                                    ? 'bg-[--tui-red]/10 border-l-2 border-[--tui-red]'
                                    : line.severity === 'warning'
                                    ? 'bg-[--tui-yellow]/10 border-l-2 border-[--tui-yellow]'
                                    : 'hover:bg-[--tui-selection]/50'
                                )}
                              >
                                <div
                                  className={cn(
                                    'w-10 text-right pr-3 border-r select-none py-0.5',
                                    line.severity === 'critical'
                                      ? 'text-[--tui-red] border-[--tui-red]/30 font-bold'
                                      : line.severity === 'warning'
                                      ? 'text-[--tui-yellow] border-[--tui-yellow]/30 font-bold'
                                      : 'text-gray-600 border-gray-800'
                                  )}
                                >
                                  {line.number}
                                </div>
                                <pre className="pl-3 py-0.5 text-[--tui-fg] whitespace-pre overflow-x-auto">
                                  {line.content}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'trace' && (
            <div className="space-y-2">
              {(!issue.trace || issue.trace.length === 0) ? (
                <div className="text-gray-500 text-sm">No trace available.</div>
              ) : (
                issue.trace.map((step, index) => (
                  <div
                    key={index}
                    className="flex gap-3 text-sm font-mono"
                  >
                    <span className="text-gray-600 select-none">{String(index + 1).padStart(2, '0')}.</span>
                    <span className="text-[--tui-fg]">{step}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[--tui-fg] text-black px-4 py-2 font-bold text-xs shrink-0 flex justify-between items-center border-t-2 border-[--tui-border] select-none">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1">
              <span className="bg-black/10 px-1 rounded">Tab</span> Switch Tab
            </span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <span className="bg-black/10 px-1 rounded">j</span>/<span className="bg-black/10 px-1 rounded">k</span> Scroll
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <span className="bg-black/10 px-1 rounded">Esc</span> Close
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
