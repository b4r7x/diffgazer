import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateMessage,
} from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"

export default function EmptyStateVariants() {
  return (
    <div className="flex flex-col gap-8">
      <EmptyState variant="centered" size="lg">
        <EmptyStateIcon>
          <span className="text-2xl">&#128269;</span>
        </EmptyStateIcon>
        <EmptyStateMessage>No results match your search</EmptyStateMessage>
        <EmptyStateDescription>Try adjusting your filters or search terms.</EmptyStateDescription>
        <EmptyStateActions>
          <Button variant="secondary" size="sm">
            Clear Filters
          </Button>
        </EmptyStateActions>
      </EmptyState>
      <EmptyState variant="centered" size="sm">
        <EmptyStateMessage>Nothing here yet</EmptyStateMessage>
        <EmptyStateDescription>Items will appear once added.</EmptyStateDescription>
      </EmptyState>
      <div className="border border-border p-4">
        <EmptyState variant="inline">
          <EmptyStateMessage>No comments yet on this file.</EmptyStateMessage>
        </EmptyState>
      </div>
    </div>
  )
}
