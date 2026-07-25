import { Button } from "@/components/ui/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateMessage,
} from "@/components/ui/empty-state";

export default function EmptyStateVariants() {
  return (
    <div className="flex flex-col gap-8">
      <EmptyState variant="centered" size="lg">
        <EmptyStateIcon className="font-mono leading-none">∅</EmptyStateIcon>
        <EmptyStateMessage>No results match your search</EmptyStateMessage>
        <EmptyStateDescription>Try adjusting your filters or search terms.</EmptyStateDescription>
        <EmptyStateActions>
          <Button variant="secondary" size="sm" bracket>
            CLEAR FILTERS
          </Button>
        </EmptyStateActions>
      </EmptyState>
      <EmptyState variant="centered" size="sm">
        <EmptyStateMessage>Nothing here yet</EmptyStateMessage>
        <EmptyStateDescription>Items will appear once added.</EmptyStateDescription>
      </EmptyState>
      <div className="border border-border font-mono text-xs">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-foreground">src/review/pipeline.ts</span>
          <span className="text-muted-foreground">+42 -7</span>
        </div>
        <EmptyState variant="inline" size="sm">
          <EmptyStateMessage>No comments yet on this file.</EmptyStateMessage>
        </EmptyState>
      </div>
    </div>
  );
}
