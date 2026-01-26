import { cn } from "@/lib/utils"

// Placeholder for AgentMeta if not found import from @repo/core.
// Assuming minimal shape.
export interface AgentMeta {
    id: string
    name: string
    description?: string
}

interface AgentStatusProps {
    status: "queued" | "running" | "complete" | "error"
    agent: AgentMeta
    currentAction?: string
    issueCount?: number
}

export function AgentStatus({
    status,
    agent,
    currentAction,
    issueCount,
}: AgentStatusProps) {
    return (
        <div className={cn("flex items-start gap-3 rounded-lg border p-4 shadow-sm bg-card",
            status === "running" && "border-primary/50"
        )}>
            <div className="mt-0.5 shrink-0">
                {status === "queued" && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 text-muted-foreground"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                )}
                {status === "running" && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 animate-spin text-primary"
                    >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                )}
                {status === "complete" && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 text-green-500"
                    >
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                )}
                {status === "error" && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5 text-destructive"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="15" x2="9" y1="9" y2="15" />
                        <line x1="9" x2="15" y1="9" y2="15" />
                    </svg>
                )}
            </div>
            <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{agent.name}</p>
                    {issueCount !== undefined && issueCount > 0 && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                            {issueCount} issues
                        </span>
                    )}
                </div>
                {status === "running" && currentAction && (
                    <p className="text-xs text-muted-foreground animate-pulse">
                        {currentAction}...
                    </p>
                )}
                {status === "error" && (
                    <p className="text-xs text-destructive">Analysis failed</p>
                )}
                {status === "queued" && (
                    <p className="text-xs text-muted-foreground">Waiting to start...</p>
                )}
                {status === "complete" && (
                    <p className="text-xs text-muted-foreground">Analysis complete</p>
                )}
            </div>
        </div>
    )
}
