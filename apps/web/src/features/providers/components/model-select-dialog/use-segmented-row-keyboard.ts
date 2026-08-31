import { useKey } from "@diffgazer/keys";
import type { KeyboardEvent as ReactKeyboardEvent, RefCallback } from "react";

interface SegmentedRowGroup {
  /** The letter that cycles this group's value from anywhere but the search box. */
  accelerator: string;
  /** Whether the letter accelerator is live; the search box keeps letters for typing. */
  acceleratorEnabled: boolean;
  cycle: () => void;
  /** How many segments the group renders, which is what makes the row's flat index. */
  count: number;
}

interface UseSegmentedRowKeyboardOptions {
  /** Whether this row currently owns the vertical keys: the dialog is open and focus is in the row. */
  inRow: boolean;
  /** The groups sharing the row, in rendered order; their segments form one flat index. */
  groups: SegmentedRowGroup[];
  /** The flat index the row's focus sits on, which the horizontal keys move. */
  focusedIndex: number;
  focusZoneAbove: () => void;
  focusZoneBelow: () => void;
  registerButton: (flatIndex: number, node: HTMLButtonElement | null) => void;
  focusAtIndex: (flatIndex: number) => void;
}

interface UseSegmentedRowKeyboardResult {
  getButtonProps: (flatIndex: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  handleKeyDown: (event: ReactKeyboardEvent) => void;
}

/**
 * The model dialog's one segmented row — the billing pools beside the tier
 * filters. It owns each group's letter accelerator, the vertical moves out of
 * the row, the horizontal moves across every segment of it, and the button
 * ref/focus mirror; the neighbours above and below are injected, because they
 * are the only thing the dialog decides.
 *
 * Horizontal keys move focus alone: preventing the default before the segmented
 * primitive sees them keeps its selection-follows-focus navigation from firing,
 * so a segment is activated only by Space or Enter.
 */
export function useSegmentedRowKeyboard({
  inRow,
  groups,
  focusedIndex,
  focusZoneAbove,
  focusZoneBelow,
  registerButton,
  focusAtIndex,
}: UseSegmentedRowKeyboardOptions): UseSegmentedRowKeyboardResult {
  const segmentCount = groups.reduce((total, group) => total + group.count, 0);
  const acceleratorHandlers = Object.fromEntries(
    groups
      .filter((group) => group.acceleratorEnabled)
      .map((group) => [group.accelerator, group.cycle]),
  );

  // The footer teaches arrows only, but j/k stays the vim alias the shared
  // Help table promises, so j/k must move through the row exactly like the
  // arrow keys.
  useKey(["ArrowUp", "k"], focusZoneAbove, { enabled: inRow, preventDefault: true });
  useKey(["ArrowDown", "j"], focusZoneBelow, { enabled: inRow, preventDefault: true });
  useKey(acceleratorHandlers);

  const getButtonProps = (flatIndex: number) => ({
    ref: (node: HTMLButtonElement | null) => registerButton(flatIndex, node),
    onFocus: () => focusAtIndex(flatIndex),
  });

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "ArrowUp" || event.key === "k") {
      event.preventDefault();
      focusZoneAbove();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "j") {
      event.preventDefault();
      focusZoneBelow();
      return;
    }

    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextIndex = focusedIndex + (event.key === "ArrowRight" ? 1 : -1);
    // The row's outer edges do not wrap: the zones above and below own the
    // exits, so a horizontal key at an edge does nothing.
    if (nextIndex < 0 || nextIndex >= segmentCount) return;
    focusAtIndex(nextIndex);
  };

  return { getButtonProps, handleKeyDown };
}
