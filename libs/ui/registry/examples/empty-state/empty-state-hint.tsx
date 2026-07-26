import { EmptyState } from "@/components/ui/empty-state";
import { Kbd } from "@/components/ui/kbd";

export default function EmptyStateHintExample() {
  return (
    <div className="flex flex-col gap-8">
      <EmptyState variant="centered" size="md">
        <EmptyState.Message>No runs match this search</EmptyState.Message>
        <EmptyState.Hint>
          <Kbd size="sm">Esc</Kbd> clear search
        </EmptyState.Hint>
      </EmptyState>
      {/* The inline variant is a ROW, so a Message + Hint pair needs flex-col
          on the root instance to stack. */}
      <EmptyState variant="inline" size="sm" className="flex-col border border-border">
        <EmptyState.Message>No comments on this file</EmptyState.Message>
        <EmptyState.Hint>
          <Kbd size="sm">c</Kbd> start a thread
        </EmptyState.Hint>
      </EmptyState>
    </div>
  );
}
