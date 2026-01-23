import { useState, useCallback, useRef, useEffect } from "react";
import { useStdout, useInput } from "ink";

// Default terminal height when stdout dimensions are unavailable.

const DEFAULT_TERMINAL_HEIGHT = 24;

interface UseScrollOptions {
  contentHeight: number;
  reservedLines?: number;
  enabled?: boolean;
}

interface UseScrollReturn {
  scrollOffset: number;
  visibleHeight: number;
  maxScroll: number;
  isScrollable: boolean;
  scrollToBottom: () => void;
}

export function useScroll(options: UseScrollOptions): UseScrollReturn {
  const { contentHeight, reservedLines = 4, enabled = true } = options;
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? DEFAULT_TERMINAL_HEIGHT;
  const visibleHeight = Math.max(5, terminalHeight - reservedLines);
  const maxScroll = Math.max(0, contentHeight - visibleHeight);
  const maxScrollRef = useRef(maxScroll);
  maxScrollRef.current = maxScroll;

  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    setScrollOffset((o) => Math.min(o, maxScroll));
  }, [maxScroll]);

  useInput((input, key) => {
    if (!enabled) return;
    const max = maxScrollRef.current;
    if (key.upArrow) setScrollOffset((o) => Math.max(0, o - 1));
    if (key.downArrow) setScrollOffset((o) => Math.min(max, o + 1));
    if (key.pageUp)
      setScrollOffset((o) => Math.max(0, o - (visibleHeight - 2)));
    if (key.pageDown)
      setScrollOffset((o) => Math.min(max, o + (visibleHeight - 2)));
    if (input === "g") setScrollOffset(0);
    if (input === "G") setScrollOffset(max);
  });

  const scrollToBottom = useCallback(
    () => setScrollOffset(maxScrollRef.current),
    [],
  );

  return {
    scrollOffset,
    visibleHeight,
    maxScroll,
    isScrollable: contentHeight > visibleHeight,
    scrollToBottom,
  };
}
