import { pluralize } from "@diffgazer/core/strings";
import type { KeyboardEventHandler, Ref } from "react";

export interface NewEntriesRowProps {
  count: number;
  onJump: () => void;
  ref?: Ref<HTMLButtonElement>;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
}

/**
 * Jump-to-latest rule row, shown between the log and the tail row while the
 * reader is back in the history and events keep arriving. Deliberately not a
 * live region: the log's announcement channel already narrates arrivals.
 */
export function NewEntriesRow({ count, onJump, ref, onKeyDown }: NewEntriesRowProps) {
  const shownCount =
    count > 999 ? "999+ new entries" : pluralize(count, "new entry", "new entries");
  return (
    <button
      ref={ref}
      type="button"
      onClick={onJump}
      onKeyDown={onKeyDown}
      aria-label={`Jump to ${shownCount}`}
      className="w-full shrink-0 border-border border-t px-2 py-1 text-center font-mono text-muted-foreground text-sm hover:text-foreground"
    >
      {`─── ↓ ${shownCount} · End ───`}
    </button>
  );
}
