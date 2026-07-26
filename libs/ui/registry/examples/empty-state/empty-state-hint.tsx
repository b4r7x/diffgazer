import { EmptyState, EmptyStateHint, EmptyStateMessage } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";

export default function EmptyStateHintExample() {
  return (
    <div className="flex flex-col gap-8">
      <EmptyState variant="centered" size="md">
        <EmptyStateMessage>No runs match this search</EmptyStateMessage>
        <EmptyStateHint>
          <Kbd size="sm">Esc</Kbd> clear search
        </EmptyStateHint>
      </EmptyState>
      {/* The inline variant is a ROW, so a Message + Hint pair needs flex-col
          on the root instance to stack. */}
      <EmptyState variant="inline" size="sm" className="flex-col border border-border">
        <EmptyStateMessage>No comments on this file</EmptyStateMessage>
        <EmptyStateHint>
          <Kbd size="sm">c</Kbd> start a thread
        </EmptyStateHint>
      </EmptyState>
    </div>
  );
}
