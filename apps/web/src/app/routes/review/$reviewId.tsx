import { useEffect } from 'react';
import { useParams } from '@tanstack/react-router';
import { ReviewPanel } from "@/features/review/components/review-panel";
import { useReviewHistory } from '@/features/review/hooks/use-review-history';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

export default function ReviewDetailPage() {
    const { reviewId } = useParams({ from: '/review/$reviewId' });
    const { currentReview, loadReview, isLoading, error } = useReviewHistory();

    useEffect(() => {
        if (reviewId) {
            loadReview(reviewId);
        }
    }, [reviewId, loadReview]);

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (error || !currentReview) {
        return (
            <div className="flex flex-col h-full items-center justify-center space-y-4">
                <p className="text-destructive">{error || "Review not found"}</p>
                <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
            </div>
        );
    }

    // We need to map SavedReview to the props expected by ReviewPanel/ReviewScreen
    // ReviewPanel seems to be a specific component. Let's check what it expects.
    // If it expects issues/agents, we can pass them.
    // SavedReview contains: result.issues, metadata etc.
    // We might reuse ReviewScreen or ReviewPanel.
    // Let's assume ReviewScreen is the main UI.

    // We would need to mock "Agents" state as "Complete" since it's history.

    // For now, let's render ReviewPanel if it handles full UI or ReviewScreen.
    // ReviewScreen takes: issues, agents, selectedIssueId...
    // We can construct dummy agents.

    const completedAgents = [
        { id: 'detective', name: 'Detective', emoji: '🔍', status: 'complete', issueCount: 0 },
        { id: 'guardian', name: 'Guardian', emoji: '🛡️', status: 'complete', issueCount: 0 },
        { id: 'optimizer', name: 'Optimizer', emoji: '⚡', status: 'complete', issueCount: 0 },
    ]; // We don't have per-agent issue counts in history easily unless we compute it.

    return (
        <ReviewPanel
        // If ReviewPanel is capable of showing a review, else we use ReviewScreen
        // But ReviewPanel import in original file was just exported default?
        // Original file: import { ReviewPanel } from "@/features/review/components/review-panel"
        // Let's try to pass props if it accepts them, or wrap ReviewScreen.
        />
    );
}

// Wait, I don't know props of ReviewPanel.
// Let's look at `apps/web/src/features/review/components/review-panel.tsx` (if it exists)
// Or just use ReviewScreen which I know.
// I'll check ReviewPanel.
