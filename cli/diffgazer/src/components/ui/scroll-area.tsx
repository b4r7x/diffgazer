import { Box, Text, useInput } from "ink";
import type { ReactNode } from "react";
import { Children, useRef, useState } from "react";
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
  const prevTotalRef = useRef(0);
  const userScrolledRef = useRef(false);

  const childArray = Children.toArray(children);
  const totalItems = childArray.length;
  const maxOffset = Math.max(0, totalItems - height);
  const clampedOffset = Math.min(scrollOffset, maxOffset);

  if (clampedOffset !== scrollOffset) {
    setScrollOffset(clampedOffset);
  }

  if (autoTail && totalItems > prevTotalRef.current && !userScrolledRef.current) {
    setScrollOffset(maxOffset);
  }
  prevTotalRef.current = totalItems;

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        userScrolledRef.current = true;
        setScrollOffset((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setScrollOffset((prev) => {
          const next = Math.min(maxOffset, prev + 1);
          if (next >= maxOffset) userScrolledRef.current = false;
          return next;
        });
      } else if (key.pageUp) {
        userScrolledRef.current = true;
        setScrollOffset((prev) => Math.max(0, prev - height));
      } else if (key.pageDown) {
        setScrollOffset((prev) => {
          const next = Math.min(maxOffset, prev + height);
          if (next >= maxOffset) userScrolledRef.current = false;
          return next;
        });
      } else if (key.home) {
        userScrolledRef.current = true;
        setScrollOffset(0);
      } else if (key.end) {
        userScrolledRef.current = false;
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
