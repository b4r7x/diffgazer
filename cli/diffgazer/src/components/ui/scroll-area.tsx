import { Box, Text, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTheme } from "../../theme/provider";

export interface ScrollAreaProps {
  height: number;
  isActive?: boolean;
  autoTail?: boolean;
  children: ReactNode;
}

interface ColumnChildProps {
  children?: ReactNode;
  flexDirection?: string;
}

function isFlattenableColumnChild(child: ReactNode): child is ReactElement<ColumnChildProps> {
  if (!isValidElement<ColumnChildProps>(child)) return false;
  return child.type === Fragment || (child.type === Box && child.props.flexDirection === "column");
}

function getScrollRows(children: ReactNode, keyPath = ""): ReactNode[] {
  return Children.toArray(children).flatMap((child, index) => {
    if (isFlattenableColumnChild(child)) {
      return getScrollRows(child.props.children, `${keyPath}${index}.`);
    }
    if (!isValidElement(child)) return [child];
    return [cloneElement(child, { key: `${keyPath}${child.key ?? index}` })];
  });
}

export function ScrollArea({
  height,
  isActive = false,
  autoTail = false,
  children,
}: ScrollAreaProps) {
  const { tokens } = useTheme();
  const [scrollOffset, setScrollOffset] = useState(0);
  const previousRowCountRef = useRef(0);
  const [userScrolled, setUserScrolled] = useState(false);

  const rows = getScrollRows(children);
  const maxOffset = Math.max(0, rows.length - height);
  const clampedOffset = Math.min(scrollOffset, maxOffset);

  useEffect(() => {
    setScrollOffset((currentOffset) => Math.min(currentOffset, maxOffset));
  }, [maxOffset]);

  useEffect(() => {
    const previousRowCount = previousRowCountRef.current;
    previousRowCountRef.current = rows.length;

    if (autoTail && rows.length > previousRowCount && !userScrolled) {
      setScrollOffset(maxOffset);
    }
  }, [autoTail, rows.length, maxOffset, userScrolled]);

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
  const visibleRows = rows.slice(clampedOffset, clampedOffset + height);

  return (
    <Box flexDirection="column">
      {canScrollUp ? <Text color={tokens.muted}>{"\u25B2"}</Text> : null}
      <Box flexDirection="column" height={height} overflow="hidden">
        {visibleRows}
      </Box>
      {canScrollDown ? <Text color={tokens.muted}>{"\u25BC"}</Text> : null}
    </Box>
  );
}
