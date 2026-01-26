
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { ReviewHistoryMetadata } from '@repo/schemas';
import { format } from 'date-fns';

export interface HistoryListProps {
    items: ReviewHistoryMetadata[];
    onSelect?: (id: string) => void;
    className?: string;
}

export function HistoryList({ items, onSelect, className }: HistoryListProps) {
    if (items.length === 0) {
        return (
            <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground space-y-4", className)}>
                <span className="text-4xl">📜</span>
                <div className="text-center">
                    <p className="font-medium">No review history yet</p>
                    <p className="text-sm">Start a review to see it here</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col max-w-2xl mx-auto py-8 w-full", className)}>
            <h2 className="text-2xl font-bold mb-6 px-4">Review History</h2>
            <div className="border rounded-xl bg-background overflow-hidden">
                {items.map((review) => (
                    <div
                        key={review.id}
                        className={cn(
                            "flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer",
                        )}
                        onClick={() => onSelect?.(review.id)}
                    >
                        <div className="space-y-1 mb-2 sm:mb-0">
                            <div className="font-medium flex items-center gap-2">
                                <span>{review.projectPath}</span>
                                {review.branch && (
                                    <Badge variant="outline" className="text-xs h-5">{review.branch}</Badge>
                                )}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <span>{format(new Date(review.createdAt), 'PPpp')}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex flex-col items-end">
                                <span className="text-foreground font-medium">{review.issueCount} issues</span>
                            </div>
                            <div className="text-muted-foreground/30">
                                →
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
