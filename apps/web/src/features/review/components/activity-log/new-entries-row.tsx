import { pluralize } from "@diffgazer/core/strings";

export interface NewEntriesRowProps {
  count: number;
  onJump: () => void;
}

/**
 * Jump-to-latest rule row, shown between the log and the tail row while the
 * reader is back in the history and events keep arriving. Deliberately not a
 * live region: the log's announcement channel already narrates arrivals.
 */
export function NewEntriesRow({ count, onJump }: NewEntriesRowProps) {
  const shownCount =
    count > 999 ? "999+ new entries" : pluralize(count, "new entry", "new entries");
  return (
    <button
      type="button"
      onClick={onJump}
      aria-label={`Jump to ${shownCount}`}
      className="w-full shrink-0 border-border border-t px-2 py-1 text-center font-mono text-muted-foreground text-sm hover:text-foreground"
    >
      {`─── ↓ ${shownCount} · End ───`}
    </button>
  );
}
