// import * as React from 'react';
import { cn } from '../lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Spinner } from './ui/spinner';
import type { AgentState } from '@repo/schemas';

export interface AgentActivityPanelProps {
    agents: AgentState[];
    currentAction?: string;
    className?: string;
}

export function AgentActivityPanel({ agents, className }: AgentActivityPanelProps) {
    // Compute summary
    const completedAgents = agents.filter(a => a.status === 'complete').length;
    const totalIssues = agents.reduce((acc, curr) => acc + (curr.issueCount || 0), 0);
    const isAllComplete = completedAgents === agents.length;

    return (
        <Card className={cn('flex flex-col h-full rounded-none border-x-0 border-y-0 sm:border md:rounded-xl', className)}>
            <CardHeader className="pb-3 border-b border-border bg-muted/20">
                <CardTitle className="text-base font-medium flex items-center">
                    Agent Activity
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 p-0 overflow-y-auto">
                <div className="flex flex-col">
                    {agents.map((agent) => (
                        <div
                            key={agent.id}
                            className={cn(
                                "flex flex-col p-4 border-b border-border/50 last:border-0",
                                agent.status === 'running' && "bg-primary/5"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-5 flex justify-center">
                                        {agent.status === 'running' && <Spinner size="sm" />}
                                        {agent.status === 'complete' && <span className="text-green-400">✓</span>}
                                        {agent.status === 'queued' && <span className="text-muted-foreground">○</span>}
                                    </div>
                                    <span className="font-medium flex items-center space-x-2">
                                        <span>{agent.meta.emoji}</span>
                                        <span>{agent.meta.name}</span>
                                    </span>
                                </div>
                                {agent.issueCount !== undefined && agent.issueCount > 0 && (
                                    <span className="text-xs text-muted-foreground">{agent.issueCount} issues</span>
                                )}
                            </div>

                            {agent.status === 'running' && agent.currentAction && (
                                <div className="mt-2 pl-8 text-sm text-muted-foreground flex items-center space-x-2">
                                    <span className="text-xs">└─</span>
                                    <span className="animate-pulse">{agent.currentAction}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>

            <div className="border-t border-border bg-muted/20 p-4">
                {isAllComplete ? (
                    <div className="space-y-1">
                        <div className="font-medium text-green-400">Review complete</div>
                        <div className="text-sm text-muted-foreground">{agents.length} agents • {totalIssues} issues</div>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <div className="font-medium text-primary">Review in progress...</div>
                        <div className="text-sm text-muted-foreground">{completedAgents}/{agents.length} agents completed</div>
                    </div>
                )}
            </div>
        </Card>
    );
}
