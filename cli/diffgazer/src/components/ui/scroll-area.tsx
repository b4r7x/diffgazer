import { Box, type DOMElement, Text, useBoxMetrics, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { Children, cloneElement, Fragment, isValidElement, useRef, useState } from "react";
import { getListWindow } from "../../lib/list-window";
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
  paddingTop?: number;
}

interface ScrollState {
  selectedIndex: number;
  rowCount: number;
  userScrolled: boolean;
  contentIdentity: unknown;
  contentReference: unknown;
  isMeasuringContent: boolean;
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

function getLeadingPaddingRows(children: ReactNode): number {
  const childNodes = Children.toArray(children);
  if (childNodes.length !== 1) return 0;
  const child = childNodes[0];
  if (!isValidElement<ColumnChildProps>(child) || child.type !== Box) return 0;
  return typeof child.props.paddingTop === "number" ? child.props.paddingTop : 0;
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
    selectedIndex: 0,
    rowCount: 0,
    userScrolled: false,
    contentIdentity,
    contentReference: children,
    isMeasuringContent: false,
  }));
  const staticContentRef = useRef<DOMElement>(null);
  const { height: measuredStaticRowCount } = useBoxMetrics(staticContentRef);

  const isWindowed = typeof children === "function";
  const contentReferenceChanged = !isWindowed && !Object.is(scrollState.contentReference, children);
  const rowCount = totalRows ?? measuredStaticRowCount;
  const lastIndex = Math.max(rowCount - 1, 0);
  const isMeasuringContent = contentReferenceChanged || scrollState.isMeasuringContent;
  const nextIsMeasuringContent =
    contentReferenceChanged ||
    (scrollState.isMeasuringContent && measuredStaticRowCount === scrollState.rowCount);

  const contentChanged = !Object.is(scrollState.contentIdentity, contentIdentity);
  let nextSelectedIndex = Math.min(scrollState.selectedIndex, lastIndex);
  if (contentChanged) {
    nextSelectedIndex = autoTail ? lastIndex : 0;
  } else if (autoTail && rowCount > scrollState.rowCount && !scrollState.userScrolled) {
    nextSelectedIndex = lastIndex;
  }
  const nextUserScrolled = contentChanged ? false : scrollState.userScrolled;

  if (
    contentChanged ||
    scrollState.rowCount !== rowCount ||
    scrollState.selectedIndex !== nextSelectedIndex ||
    scrollState.userScrolled !== nextUserScrolled ||
    contentReferenceChanged ||
    scrollState.isMeasuringContent !== nextIsMeasuringContent
  ) {
    setScrollState({
      selectedIndex: nextSelectedIndex,
      rowCount,
      userScrolled: nextUserScrolled,
      contentIdentity,
      contentReference: children,
      isMeasuringContent: nextIsMeasuringContent,
    });
  }

  const leadingPaddingRows = isWindowed ? 0 : getLeadingPaddingRows(children);
  const selectedIndex = Math.min(
    nextSelectedIndex === 0 ? leadingPaddingRows : nextSelectedIndex,
    lastIndex,
  );
  const window = getListWindow({
    selectedIndex,
    total: rowCount,
    viewportRows: height,
  });
  const canNavigateUp = height <= 2 ? nextSelectedIndex > 0 : window.canScrollUp;
  const canNavigateDown = height <= 2 ? selectedIndex < lastIndex : window.canScrollDown;
  const updateScrollState = (nextIndex: number, userScrolled = nextIndex < lastIndex) => {
    setScrollState({
      selectedIndex: nextIndex,
      rowCount,
      userScrolled,
      contentIdentity,
      contentReference: children,
      isMeasuringContent,
    });
  };

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        if (!canNavigateUp) return;
        const next = Math.max(0, window.start - 1);
        updateScrollState(next);
      } else if (key.downArrow) {
        if (!canNavigateDown) return;
        const next = Math.min(lastIndex, window.end);
        updateScrollState(next);
      } else if (key.pageUp) {
        if (!canNavigateUp) return;
        const next = Math.max(0, selectedIndex - height);
        updateScrollState(next);
      } else if (key.pageDown) {
        if (!canNavigateDown) return;
        const next = Math.min(lastIndex, selectedIndex + height);
        updateScrollState(next);
      } else if (key.home) {
        if (!canNavigateUp) return;
        const next = 0;
        updateScrollState(next);
      } else if (key.end) {
        if (!canNavigateDown) return;
        updateScrollState(lastIndex, false);
      }
    },
    { isActive },
  );

  const visibleRowCount = window.end - window.start;
  const contentViewportRows = !isWindowed && rowCount === 0 ? height : visibleRowCount;
  const visibleRows = isWindowed ? getScrollRows(children(window)) : null;

  return (
    <Box flexDirection="column" height={height} overflow="hidden">
      {window.canScrollUp ? <Text color={tokens.muted}>{"\u25B2"}</Text> : null}
      <Box flexDirection="column" height={contentViewportRows} overflow="hidden">
        {isWindowed ? (
          visibleRows
        ) : (
          <Box
            ref={staticContentRef}
            flexDirection="column"
            flexShrink={0}
            minHeight={isMeasuringContent ? undefined : scrollState.rowCount}
            position="relative"
            top={-window.start}
          >
            {children}
          </Box>
        )}
      </Box>
      {window.canScrollDown ? <Text color={tokens.muted}>{"\u25BC"}</Text> : null}
    </Box>
  );
}
