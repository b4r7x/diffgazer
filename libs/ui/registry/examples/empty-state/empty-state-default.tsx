import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateMessage,
} from "@/components/ui/empty-state"

export default function EmptyStateDefault() {
  return (
    <EmptyState>
      <EmptyStateMessage>No reviews found</EmptyStateMessage>
      <EmptyStateDescription>Start a new review to see results here.</EmptyStateDescription>
    </EmptyState>
  )
}
