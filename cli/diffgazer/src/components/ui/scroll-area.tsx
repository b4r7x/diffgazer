import { Box, type DOMElement, Text, useBoxMetrics, useInput } from "ink";
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

interface BaseScrollAreaProps {
  height: number;
  isActive?: boolean;
  autoTail?: boolean;
  contentIdentity?: unknown;
}

export interface ScrollRange {
  start: number;
  end: number;
}

interface StaticScrollAreaProps extends BaseScrollAreaProps {
  children: ReactNode;
  totalRows?: never;
}

interface WindowedScrollAreaProps extends BaseScrollAreaProps {
  children: (range: ScrollRange) => ReactNode;
  totalRows: number;
}

export type ScrollAreaProps = StaticScrollAreaProps | WindowedScrollAreaProps;

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
  contentIdentity,
  children,
  totalRows,
}: ScrollAreaProps) {
  const { tokens } = useTheme();
  const [scrollOffset, setScrollOffset] = useState(0);
  const staticContentRef = useRef<DOMElement>(null);
  const { height: measuredStaticRowCount } = useBoxMetrics(staticContentRef);
  const previousRowCountRef = useRef(0);
  const previousContentIdentityRef = useRef(contentIdentity);
  const [userScrolled, setUserScrolled] = useState(false);

  const isWindowed = typeof children === "function";
  const rowCount = totalRows ?? measuredStaticRowCount;
  const maxOffset = Math.max(0, rowCount - height);
  const clampedOffset = Math.min(scrollOffset, maxOffset);

  useEffect(() => {
    setScrollOffset((currentOffset) => Math.min(currentOffset, maxOffset));
  }, [maxOffset]);

  useEffect(() => {
    const previousRowCount = previousRowCountRef.current;
    const contentChanged = !Object.is(previousContentIdentityRef.current, contentIdentity);
    previousRowCountRef.current = rowCount;
    previousContentIdentityRef.current = contentIdentity;

    if (contentChanged) {
      setUserScrolled(false);
      setScrollOffset(autoTail ? maxOffset : 0);
      return;
    }

    if (autoTail && rowCount > previousRowCount && !userScrolled) {
      setScrollOffset(maxOffset);
    }
  }, [autoTail, contentIdentity, rowCount, maxOffset, userScrolled]);

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        const next = Math.max(0, clampedOffset - 1);
        setUserScrolled(next < maxOffset);
        setScrollOffset(next);
      } else if (key.downArrow) {
        const next = Math.min(maxOffset, clampedOffset + 1);
        setUserScrolled(next < maxOffset);
        setScrollOffset(next);
      } else if (key.pageUp) {
        const next = Math.max(0, clampedOffset - height);
        setUserScrolled(next < maxOffset);
        setScrollOffset(next);
      } else if (key.pageDown) {
        const next = Math.min(maxOffset, clampedOffset + height);
        setUserScrolled(next < maxOffset);
        setScrollOffset(next);
      } else if (key.home) {
        const next = 0;
        setUserScrolled(next < maxOffset);
        setScrollOffset(next);
      } else if (key.end) {
        setUserScrolled(false);
        setScrollOffset(maxOffset);
      }
    },
    { isActive },
  );

  const canScrollUp = clampedOffset > 0;
  const canScrollDown = clampedOffset < maxOffset;
  const range = {
    start: clampedOffset,
    end: Math.min(rowCount, clampedOffset + height),
  };
  const visibleRows = isWindowed ? getScrollRows(children(range)) : null;

  return (
    <Box flexDirection="column">
      {canScrollUp ? <Text color={tokens.muted}>{"\u25B2"}</Text> : null}
      <Box flexDirection="column" height={height} overflow="hidden">
        {isWindowed ? (
          visibleRows
        ) : (
          <Box
            ref={staticContentRef}
            flexDirection="column"
            flexShrink={0}
            position="relative"
            top={-clampedOffset}
          >
            {children}
          </Box>
        )}
      </Box>
      {canScrollDown ? <Text color={tokens.muted}>{"\u25BC"}</Text> : null}
    </Box>
  );
}
