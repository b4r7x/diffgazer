import { useState } from "react";
import { useKeys } from "./use-keys";

interface UseSelectableListOptions {
  itemCount: number;
  getDisabled?: (index: number) => boolean;
  wrap?: boolean;
  onBoundaryReached?: (direction: "up" | "down") => void;
  onFocus?: (index: number) => void;
  enabled?: boolean;
  initialIndex?: number;
  upKeys?: readonly string[];
  downKeys?: readonly string[];
}

interface UseSelectableListReturn {
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
}

const DEFAULT_UP_KEYS = ["ArrowUp", "k"] as const;
const DEFAULT_DOWN_KEYS = ["ArrowDown", "j"] as const;

export function useSelectableList({
  itemCount,
  getDisabled = () => false,
  wrap = true,
  onBoundaryReached,
  onFocus,
  enabled = true,
  initialIndex = 0,
  upKeys = DEFAULT_UP_KEYS,
  downKeys = DEFAULT_DOWN_KEYS,
}: UseSelectableListOptions): UseSelectableListReturn {
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);

  const findNextIndex = (start: number, direction: 1 | -1): number => {
    let index = start + direction;
    while (index >= 0 && index < itemCount) {
      if (!getDisabled(index)) return index;
      index += direction;
    }
    return start;
  };

  const moveUp = () => {
    if (itemCount === 0) return;
    setFocusedIndex((prev) => {
      if (prev === 0) {
        if (wrap) {
          let lastIndex = itemCount - 1;
          while (lastIndex > 0 && getDisabled(lastIndex)) lastIndex--;
          onFocus?.(lastIndex);
          return lastIndex;
        }
        onBoundaryReached?.("up");
        return prev;
      }
      const newIndex = findNextIndex(prev, -1);
      onFocus?.(newIndex);
      return newIndex;
    });
  };

  const moveDown = () => {
    if (itemCount === 0) return;
    setFocusedIndex((prev) => {
      if (prev === itemCount - 1) {
        if (wrap) {
          let firstIndex = 0;
          while (firstIndex < itemCount - 1 && getDisabled(firstIndex)) firstIndex++;
          onFocus?.(firstIndex);
          return firstIndex;
        }
        onBoundaryReached?.("down");
        return prev;
      }
      const newIndex = findNextIndex(prev, 1);
      onFocus?.(newIndex);
      return newIndex;
    });
  };

  useKeys(upKeys, moveUp, { enabled: enabled && itemCount > 0 });
  useKeys(downKeys, moveDown, { enabled: enabled && itemCount > 0 });

  return { focusedIndex, setFocusedIndex };
}
