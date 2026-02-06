import { useState, useRef, useEffect } from "react";
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
  const pendingCallbackRef = useRef<{ type: "focus"; index: number } | { type: "boundary"; direction: "up" | "down" } | null>(null);

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
          pendingCallbackRef.current = { type: "focus", index: lastIndex };
          return lastIndex;
        }
        pendingCallbackRef.current = { type: "boundary", direction: "up" };
        return prev;
      }
      const next = findNextIndex(prev, -1);
      pendingCallbackRef.current = { type: "focus", index: next };
      return next;
    });
  };

  const moveDown = () => {
    if (itemCount === 0) return;
    setFocusedIndex((prev) => {
      if (prev === itemCount - 1) {
        if (wrap) {
          let firstIndex = 0;
          while (firstIndex < itemCount - 1 && getDisabled(firstIndex)) firstIndex++;
          pendingCallbackRef.current = { type: "focus", index: firstIndex };
          return firstIndex;
        }
        pendingCallbackRef.current = { type: "boundary", direction: "down" };
        return prev;
      }
      const next = findNextIndex(prev, 1);
      pendingCallbackRef.current = { type: "focus", index: next };
      return next;
    });
  };

  useEffect(() => {
    const pending = pendingCallbackRef.current;
    if (!pending) return;
    pendingCallbackRef.current = null;
    if (pending.type === "focus") {
      onFocus?.(pending.index);
    } else {
      onBoundaryReached?.(pending.direction);
    }
  });

  useKeys(upKeys, moveUp, { enabled: enabled && itemCount > 0 });
  useKeys(downKeys, moveDown, { enabled: enabled && itemCount > 0 });

  return { focusedIndex, setFocusedIndex };
}
