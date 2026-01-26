import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { SeverityBadge } from "./severity-badge"
import { cn } from "@/lib/utils"

export interface Issue {
    id: string
    title: string
    description: string
    severity: "blocker" | "high" | "medium" | "low" | "nit"
    file: string
    line?: number
    patch?: string
}

interface IssueCardProps {
    issue: Issue
    expanded?: boolean
    onToggle?: () => void
    className?: string
}

export function IssueCard({ issue, expanded, onToggle, className }: IssueCardProps) {
    return (
        <Card
            className={cn("cursor-pointer transition-colors hover:bg-accent/50", expanded && "bg-accent/50", className)}
            onClick={onToggle}
        >
            <CardHeader className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-base font-medium leading-none">
                            {issue.title}
                        </CardTitle>
                        <CardDescription className="text-xs font-mono">
                            {issue.file}{issue.line ? `:${issue.line}` : ''}
                        </CardDescription>
                    </div>
                    <SeverityBadge severity={issue.severity} />
                </div>
            </CardHeader>
            {expanded && (
                <CardContent className="p-4 pt-0 text-sm space-y-4">
                    <p className="text-muted-foreground">{issue.description}</p>
                    {issue.patch && (
                        <div className="rounded-md bg-muted p-2 font-mono text-xs overflow-x-auto">
                            <pre>{issue.patch}</pre>
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    )
}
