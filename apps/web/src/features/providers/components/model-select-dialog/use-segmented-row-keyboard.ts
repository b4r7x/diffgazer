import { useKey } from "@diffgazer/keys";
import type { KeyboardEvent as ReactKeyboardEvent, RefCallback } from "react";

interface UseSegmentedRowKeyboardOptions {
  /** Whether this row currently owns the vertical keys: the dialog is open and focus is in the row. */
  inRow: boolean;
  /** Whether the letter accelerator is live; the search box keeps letters for typing. */
  acceleratorEnabled: boolean;
  accelerator: string;
  cycle: () => void;
  focusZoneAbove: () => void;
  focusZoneBelow: () => void;
  registerButton: (index: number, node: HTMLButtonElement | null) => void;
  focusAtIndex: (index: number) => void;
}

interface UseSegmentedRowKeyboardResult {
  getButtonProps: (index: number) => {
    ref: RefCallback<HTMLButtonElement>;
    onFocus: () => void;
  };
  handleKeyDown: (event: ReactKeyboardEvent) => void;
}

/**
 * One segmented row of the model dialog — the tier filters, the billing pools.
 * It owns the row's letter accelerator, the vertical moves out of it, and the
 * button ref/focus mirror; the neighbours above and below are injected, because
 * they are the only thing that differs between the rows.
 */
export function useSegmentedRowKeyboard({
  inRow,
  acceleratorEnabled,
  accelerator,
  cycle,
  focusZoneAbove,
  focusZoneBelow,
  registerButton,
  focusAtIndex,
}: UseSegmentedRowKeyboardOptions): UseSegmentedRowKeyboardResult {
  // The footer teaches arrows only, but j/k stays the vim alias the shared
  // Help table promises, so j/k must move through the row exactly like the
  // arrow keys.
  useKey(["ArrowUp", "k"], focusZoneAbove, { enabled: inRow, preventDefault: true });
  useKey(["ArrowDown", "j"], focusZoneBelow, { enabled: inRow, preventDefault: true });
  useKey(accelerator, cycle, { enabled: acceleratorEnabled });

  const getButtonProps = (index: number) => ({
    ref: (node: HTMLButtonElement | null) => registerButton(index, node),
    onFocus: () => focusAtIndex(index),
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
    }
  };

  return { getButtonProps, handleKeyDown };
}
