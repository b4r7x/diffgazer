import { Box, Text, useInput } from "ink";
import type { ReactNode } from "react";
import { Children, useState } from "react";
import { useTheme } from "../../theme/provider";

export interface ScrollAreaProps {
  height: number;
  isActive?: boolean;
  autoTail?: boolean;
  children: ReactNode;
}

export function ScrollArea({
  height,
  isActive = false,
  autoTail = false,
  children,
}: ScrollAreaProps) {
  const { tokens } = useTheme();
  const [scrollOffset, setScrollOffset] = useState(0);
  const [prevTotal, setPrevTotal] = useState(0);
  const [userScrolled, setUserScrolled] = useState(false);

  const childArray = Children.toArray(children);
  const totalItems = childArray.length;
  const maxOffset = Math.max(0, totalItems - height);
  const clampedOffset = Math.min(scrollOffset, maxOffset);

  if (clampedOffset !== scrollOffset) {
    setScrollOffset(clampedOffset);
  }

  if (totalItems !== prevTotal) {
    setPrevTotal(totalItems);
    if (autoTail && totalItems > prevTotal && !userScrolled) {
      setScrollOffset(maxOffset);
    }
  }

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setUserScrolled(true);
        setScrollOffset(Math.max(0, clampedOffset - 1));
      } else if (key.downArrow) {
        const next = Math.min(maxOffset, clampedOffset + 1);
        setUserScrolled(next < maxOffset);
        setScrollOffset(next);
      } else if (key.pageUp) {
        setUserScrolled(true);
        setScrollOffset(Math.max(0, clampedOffset - height));
      } else if (key.pageDown) {
        const next = Math.min(maxOffset, clampedOffset + height);
        setUserScrolled(next < maxOffset);
        setScrollOffset(next);
      } else if (key.home) {
        setUserScrolled(true);
        setScrollOffset(0);
      } else if (key.end) {
        setUserScrolled(false);
        setScrollOffset(maxOffset);
      }
    },
    { isActive },
  );

  const canScrollUp = clampedOffset > 0;
  const canScrollDown = clampedOffset < maxOffset;
  const visibleChildren = childArray.slice(clampedOffset, clampedOffset + height);

  return (
    <Box flexDirection="column">
      {canScrollUp ? <Text color={tokens.muted}>{"\u25B2"}</Text> : null}
      <Box flexDirection="column" height={height} overflow="hidden">
        {visibleChildren}
      </Box>
      {canScrollDown ? <Text color={tokens.muted}>{"\u25BC"}</Text> : null}
    </Box>
  );
}
