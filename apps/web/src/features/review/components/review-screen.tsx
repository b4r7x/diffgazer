// import * as React from 'react';
import { cn } from '@/lib/utils';
import { AgentActivityPanel } from '@/components/agent-activity-panel';
import { IssueList } from './issue-list';
import type { AgentState, TriageIssue } from '@repo/schemas';
import { IssueDetails } from './issue-details';
import { SplitPane } from '@/components/layout/split-pane';

export interface ReviewScreenProps {
    issues: TriageIssue[];
    agents: AgentState[];
    isReviewing?: boolean;
    selectedIssueId?: string;
    onSelectIssue: (id: string) => void;
    onApplyPatch?: (id: string) => void;
    onExplain?: (id: string) => void;
    className?: string;
}

export function ReviewScreen({
    issues,
    agents,
    isReviewing = true,
    selectedIssueId,
    onSelectIssue,
    onApplyPatch,
    onExplain,
    className,
}: ReviewScreenProps) {
    const selectedIssue = issues.find((i) => i.id === selectedIssueId) || null;
    const isAllComplete = agents.every((a) => a.status === 'complete');

    // Logic to hide agent panel if review is complete and not explicitly forcing view?
    // Requirements: "Agent panel hidden when review complete (unless isReviewing)"
    // Interpretation: "isReviewing" might mean active state. If not active, logic says hidden? 
    // Let's assume we show it if reviewing OR explicitly requested.
    // Actually, let's keep it visible on larger screens as a sidebar for context, 
    // or follow typical IDE layout (left sidebar, main content).
    // I'll put AgentPanel as left sidebar (collapsible in future, fixed for now).

    const showAgentPanel = isReviewing || !isAllComplete;

    return (
        <div className={cn("flex h-full w-full overflow-hidden bg-background", className)}>
            {/* Agent Panel Sidebar */}
            {showAgentPanel && (
                <div className="w-80 border-r border-border hidden md:flex flex-col shrink-0 bg-secondary/10">
                    <AgentActivityPanel agents={agents} className="h-full border-0 rounded-none bg-transparent" />
                </div>
            )}

            {/* Main Content: Split Pane of Issues | Details */}
            <div className="flex-1 overflow-hidden min-w-0">
                <SplitPane
                    leftWidth={30}
                    left={
                        <div className="h-full flex flex-col">
                            <div className="p-2 border-b border-border bg-muted/20 text-xs font-bold text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                                <span>Issues ({issues.length})</span>
                                {/* Filter/Sort controls could go here */}
                            </div>
                            <IssueList
                                issues={issues}
                                selectedId={selectedIssueId}
                                onSelect={onSelectIssue}
                            />
                        </div>
                    }
                    right={
                        <IssueDetails
                            issue={selectedIssue}
                            onApplyPatch={onApplyPatch}
                            onExplain={onExplain}
                        />
                    }
                    className="h-full"
                />
            </div>
        </div>
    );
}
