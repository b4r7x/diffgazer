import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useReviewHistory } from '@/features/review/hooks/use-review-history';
import { HistoryList } from '@/features/history/components/history-list';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

export default function ReviewHistoryPage() {
    const navigate = useNavigate();
    const { reviews, isLoading, error, refresh } = useReviewHistory();

    useEffect(() => {
        refresh();
    }, [refresh]);

    if (isLoading && !reviews.length) {
        return (
            <div className="flex h-full items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full flex-col items-center justify-center space-y-4">
                <p className="text-destructive">Failed to load history</p>
                <Button onClick={refresh}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="container py-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold">Review History</h1>
                <Button variant="outline" onClick={refresh} disabled={isLoading}>
                    Refresh
                </Button>
            </div>

            <HistoryList
                items={reviews}
                onSelect={(id) => navigate({ to: '/review/$reviewId', params: { reviewId: id } })}
            />
        </div>
    );
}
