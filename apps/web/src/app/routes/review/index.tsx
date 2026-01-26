import * as React from 'react';
import { useSearch } from '@tanstack/react-router';
import { ReviewScreen } from '@/features/review/components/review-screen';
import { useTriageStream } from '@/features/review/hooks/use-triage-stream';
import { useGitStatus } from '@/features/review/hooks/use-git-status';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle } from 'lucide-react';

export default function ReviewPage() {
    const search = useSearch({ from: '/review/' }) as { scope?: string; focus?: string };
    const { state, start, stop, selectIssue } = useTriageStream();
    const { status, hasUnstaged, hasStaged, isLoading: isLoadingGit } = useGitStatus();

    // Auto-start if not running and we have git status? 
    // Or wait for user confirmation?
    // Let's auto-start if not previously completed or errored to match "immediate feedback" feel,
    // or provide a "Start Review" button if we want to be explicit.
    // The design often implies "Review" button clicked -> Nav to page -> Start.

    // We'll use a ref to track if we started
    const startedRef = React.useRef(false);

    React.useEffect(() => {
        if (!startedRef.current && (hasUnstaged || hasStaged) && !state.isStreaming && !state.error && state.issues.length === 0) {
            startedRef.current = true;
            start({
                scope: search.scope || (hasStaged ? 'staged' : 'unstaged'),
                focus: search.focus ? [search.focus] : undefined
            });
        }
    }, [hasUnstaged, hasStaged, search.scope, search.focus, start, state.isStreaming, state.error, state.issues.length]);

    // Handle initial loading
    if (isLoadingGit) {
        return (
            <div className="flex h-full items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (!hasUnstaged && !hasStaged && !state.isStreaming && state.issues.length === 0) {
        // No changes to review
        return (
            <div className="flex flex-col h-full items-center justify-center space-y-4">
                <div className="text-4xl">✨</div>
                <h2 className="text-xl font-semibold">Nothing to Review</h2>
                <p className="text-muted-foreground">Your working directory is clean.</p>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
                </div>
            </div>
        );
    }

    if (state.error) {
        return (
            <div className="flex flex-col h-full items-center justify-center space-y-4">
                <div className="text-destructive text-4xl"><AlertCircle /></div>
                <h2 className="text-xl font-semibold text-destructive">Review Failed</h2>
                <p className="text-muted-foreground">{state.error}</p>
                <Button onClick={() => start({ scope: search.scope || 'unstaged' })}>Retry</Button>
            </div>
        );
    }

    return (
        <ReviewScreen
            issues={state.issues}
            agents={state.agents}
            selectedIssueId={state.selectedIssueId}
            onSelectIssue={selectIssue}
            onApplyPatch={(id) => {
                // TODO: Implement patch application
            }}
            onExplain={(id) => {
                // TODO: Implement explanation
            }}
        />
    );
}
