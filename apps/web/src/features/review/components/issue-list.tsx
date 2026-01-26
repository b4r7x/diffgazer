// import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { TriageIssue } from '@repo/schemas';

export interface IssueListProps {
    issues: TriageIssue[];
    selectedId?: string;
    onSelect: (id: string) => void;
    className?: string;
}

export function IssueList({ issues, selectedId, onSelect, className }: IssueListProps) {
    if (issues.length === 0) {
        return (
            <div className={cn("flex flex-col items-center justify-center p-8 text-center h-full text-muted-foreground", className)}>
                <span className="text-4xl mb-2">✨</span>
                <p>No issues found. Great job!</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col h-full overflow-y-auto bg-background", className)}>
            {issues.map((issue) => (
                <button
                    key={issue.id}
                    onClick={() => onSelect(issue.id)}
                    className={cn(
                        "flex flex-col items-start w-full p-4 border-b border-border/50 transition-colors hover:bg-muted/50 text-left focus:outline-none focus:bg-muted/50",
                        selectedId === issue.id && "bg-muted/30 border-l-4 border-l-primary pl-3" // border-l adds 4px, reduce padding to keep alignment? actually simple pl-3 is fine
                    )}
                >
                    <div className="flex w-full items-start justify-between mb-1">
                        <span className="font-medium text-sm line-clamp-1 mr-2">{issue.title}</span>
                        <Badge variant={issue.severity} className="shrink-0 scale-90 uppercase">
                            {issue.severity}
                        </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate w-full">
                        {issue.file}:{issue.line_start}
                    </div>
                </button>
            ))}
        </div>
    );
}
