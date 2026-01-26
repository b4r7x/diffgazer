import { useState } from 'react'
import { ReviewHeader } from "./review-header"
import { AgentActivityPanel } from "../../agents/components/agent-activity-panel"
import { IssueList } from "./issue-list"
import { IssueDetails } from "./issue-details"
import { useTriageStream } from "../hooks/use-triage-stream"

export function ReviewPanel() {
    const { state } = useTriageStream()
    const { issues, agents } = state
    const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)

    // Map TriageIssue to Issue format for display
    const displayIssues = issues.map(issue => ({
        id: issue.id,
        title: issue.title,
        body: issue.rationale,
        severity: issue.severity as any,
        file_path: issue.file,
        line_start: issue.line_start ?? 0,
        line_end: issue.line_start ?? 0,
        suggested_patch: issue.suggested_patch ?? undefined,
        code_context: '',
    }))

    const selectedIssue = displayIssues.find(i => i.id === selectedIssueId)

    return (
        <div className="flex h-full flex-col bg-background">
            <ReviewHeader />
            <div className="flex-1 overflow-hidden">
                <div className="container mx-auto h-full p-6 space-y-6 overflow-y-auto">
                    {/* Agent Status */}
                    <AgentActivityPanel agents={agents} />

                    {/* Issues View - Two Pane */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[600px]">
                        <div className="md:col-span-5 h-full overflow-y-auto border rounded-xl p-4 bg-card">
                            <h3 className="font-semibold mb-4">Issues ({displayIssues.length})</h3>
                            <IssueList
                                issues={displayIssues}
                                selectedId={selectedIssueId ?? undefined}
                                onSelect={(id) => setSelectedIssueId(id)}
                            />
                        </div>
                        <div className="md:col-span-7 h-full overflow-hidden border rounded-xl bg-card">
                            {selectedIssue ? (
                                <IssueDetails issue={selectedIssue} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    Select an issue to view details
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
