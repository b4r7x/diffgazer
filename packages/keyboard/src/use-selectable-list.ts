import { useRef, useState, type RefObject } from "react";
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
  targetRef?: RefObject<HTMLElement | null>;
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
  targetRef,
}: UseSelectableListOptions): UseSelectableListReturn {
  const [focusedIndex, setFocusedIndexState] = useState(initialIndex);
  const focusedIndexRef = useRef(initialIndex);

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
    const prev = focusedIndexRef.current;
    if (prev === 0) {
      if (wrap) {
        let lastIndex = itemCount - 1;
        while (lastIndex > 0 && getDisabled(lastIndex)) lastIndex--;
        focusedIndexRef.current = lastIndex;
        setFocusedIndexState(lastIndex);
        onFocus?.(lastIndex);
        return;
      }
      onBoundaryReached?.("up");
      return;
    }

    const next = findNextIndex(prev, -1);
    focusedIndexRef.current = next;
    setFocusedIndexState(next);
    onFocus?.(next);
  };

  const moveDown = () => {
    if (itemCount === 0) return;
    const prev = focusedIndexRef.current;
    if (prev === itemCount - 1) {
      if (wrap) {
        let firstIndex = 0;
        while (firstIndex < itemCount - 1 && getDisabled(firstIndex)) firstIndex++;
        focusedIndexRef.current = firstIndex;
        setFocusedIndexState(firstIndex);
        onFocus?.(firstIndex);
        return;
      }
      onBoundaryReached?.("down");
      return;
    }

    const next = findNextIndex(prev, 1);
    focusedIndexRef.current = next;
    setFocusedIndexState(next);
    onFocus?.(next);
  };

  const setFocusedIndex = (index: number) => {
    focusedIndexRef.current = index;
    setFocusedIndexState(index);
  };

  const keyOptions = {
    enabled: enabled && itemCount > 0,
    targetRef,
    requireFocusWithin: Boolean(targetRef),
  } as const;

  useKeys(upKeys, moveUp, keyOptions);
  useKeys(downKeys, moveDown, keyOptions);

  return { focusedIndex, setFocusedIndex };
}
