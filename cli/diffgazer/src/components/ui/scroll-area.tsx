import { Box, type DOMElement, Text, useBoxMetrics, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { Children, cloneElement, Fragment, isValidElement, useRef, useState } from "react";
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

interface ScrollState {
  offset: number;
  rowCount: number;
  userScrolled: boolean;
  contentIdentity: unknown;
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
  const [scrollState, setScrollState] = useState<ScrollState>(() => ({
    offset: 0,
    rowCount: 0,
    userScrolled: false,
    contentIdentity,
  }));
  const staticContentRef = useRef<DOMElement>(null);
  const { height: measuredStaticRowCount } = useBoxMetrics(staticContentRef);

  const isWindowed = typeof children === "function";
  const rowCount = totalRows ?? measuredStaticRowCount;
  const maxOffset = Math.max(0, rowCount - height);

  const contentChanged = !Object.is(scrollState.contentIdentity, contentIdentity);
  let nextOffset = Math.min(scrollState.offset, maxOffset);
  if (contentChanged) {
    nextOffset = autoTail ? maxOffset : 0;
  } else if (autoTail && rowCount > scrollState.rowCount && !scrollState.userScrolled) {
    nextOffset = maxOffset;
  }
  const nextUserScrolled = contentChanged ? false : scrollState.userScrolled;

  if (
    contentChanged ||
    scrollState.rowCount !== rowCount ||
    scrollState.offset !== nextOffset ||
    scrollState.userScrolled !== nextUserScrolled
  ) {
    setScrollState({
      offset: nextOffset,
      rowCount,
      userScrolled: nextUserScrolled,
      contentIdentity,
    });
  }

  const clampedOffset = nextOffset;
  const updateScrollState = (offset: number, userScrolled = offset < maxOffset) => {
    setScrollState({ offset, rowCount, userScrolled, contentIdentity });
  };

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        const next = Math.max(0, clampedOffset - 1);
        updateScrollState(next);
      } else if (key.downArrow) {
        const next = Math.min(maxOffset, clampedOffset + 1);
        updateScrollState(next);
      } else if (key.pageUp) {
        const next = Math.max(0, clampedOffset - height);
        updateScrollState(next);
      } else if (key.pageDown) {
        const next = Math.min(maxOffset, clampedOffset + height);
        updateScrollState(next);
      } else if (key.home) {
        const next = 0;
        updateScrollState(next);
      } else if (key.end) {
        updateScrollState(maxOffset, false);
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
