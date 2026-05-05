import { useState, Children } from "react";
import type { ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../theme/theme-context.js";

export interface ScrollAreaProps {
  height: number;
  isActive?: boolean;
  children: ReactNode;
}

export function ScrollArea({
  height,
  isActive = false,
  children,
}: ScrollAreaProps) {
  const { tokens } = useTheme();
  const [scrollOffset, setScrollOffset] = useState(0);

  const childArray = Children.toArray(children);
  const totalItems = childArray.length;
  const maxOffset = Math.max(0, totalItems - height);

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setScrollOffset((prev) => Math.min(maxOffset, prev + 1));
      } else if (key.pageUp) {
        setScrollOffset((prev) => Math.max(0, prev - height));
      } else if (key.pageDown) {
        setScrollOffset((prev) => Math.min(maxOffset, prev + height));
      } else if (key.home) {
        setScrollOffset(0);
      } else if (key.end) {
        setScrollOffset(maxOffset);
      }
    },
    { isActive },
  );

  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset < maxOffset;
  const visibleChildren = childArray.slice(scrollOffset, scrollOffset + height);

  return (
    <Box flexDirection="column">
      {canScrollUp ? (
        <Text color={tokens.muted}>{"\u25B2"}</Text>
      ) : null}
      <Box flexDirection="column" height={height} overflow="hidden">
        {visibleChildren}
      </Box>
      {canScrollDown ? (
        <Text color={tokens.muted}>{"\u25BC"}</Text>
      ) : null}
    </Box>
  );
}
