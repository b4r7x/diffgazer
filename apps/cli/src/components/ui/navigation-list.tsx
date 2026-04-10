import { createContext, useState, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../theme/theme-context.js";
import type { CliColorTokens } from "../../theme/palettes.js";
import { clampIndex, collectChildItems } from "../../lib/list-navigation.js";

// --- Types ---

export interface NavigationListProps {
  selectedId?: string | null;
  highlightedId?: string | null;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  wrap?: boolean;
  isActive?: boolean;
  children: ReactNode;
}

export interface NavigationListItemProps {
  id: string;
  disabled?: boolean;
  children: ReactNode;
}

export interface NavigationListTitleProps {
  children: string;
}

export interface NavigationListBadgeProps {
  variant?: string;
  children: string;
}

export interface NavigationListStatusProps {
  children: string;
}

export interface NavigationListSubtitleProps {
  children: string;
}

// --- Context ---

interface NavigationListContextValue {
  highlightedId: string;
  selectedId: string | null;
  tokens: CliColorTokens;
}

const NavigationListContext = createContext<NavigationListContextValue | null>(null);

function useNavigationListContext(): NavigationListContextValue {
  const value = useContext(NavigationListContext);
  if (!value) {
    throw new Error("NavigationList.Item must be used within a NavigationList");
  }
  return value;
}

// --- Item collection ---

interface CollectedItem {
  id: string;
  disabled: boolean;
}

function extractNavigationListItem(element: ReactElement): CollectedItem | null {
  if (element.type !== NavigationListItem) return null;
  const props = element.props as NavigationListItemProps;
  return { id: props.id, disabled: props.disabled ?? false };
}

// --- Sub-components ---

function NavigationListTitle({ children }: NavigationListTitleProps) {
  const ctx = useNavigationListContext();
  return (
    <Text color={ctx.tokens.fg} bold>
      {children}
    </Text>
  );
}

function NavigationListBadge({ variant, children }: NavigationListBadgeProps) {
  const ctx = useNavigationListContext();

  const colorMap: Record<string, string> = {
    success: ctx.tokens.success,
    warning: ctx.tokens.warning,
    error: ctx.tokens.error,
    info: ctx.tokens.info,
  };

  const color = (variant && colorMap[variant]) ?? ctx.tokens.muted;

  return <Text color={color}>[{children}]</Text>;
}

function NavigationListStatus({ children }: NavigationListStatusProps) {
  const ctx = useNavigationListContext();
  return <Text color={ctx.tokens.muted}>{children}</Text>;
}

function NavigationListSubtitle({ children }: NavigationListSubtitleProps) {
  const ctx = useNavigationListContext();
  return <Text color={ctx.tokens.muted}>{children}</Text>;
}

// --- Item ---

function NavigationListItem({
  id,
  disabled = false,
  children,
}: NavigationListItemProps) {
  const ctx = useNavigationListContext();
  const isHighlighted = ctx.highlightedId === id;
  const isSelected = ctx.selectedId === id;

  if (disabled) {
    return (
      <Box>
        <Text dimColor>{"  "}</Text>
        <Box>{children}</Box>
      </Box>
    );
  }

  const prefix = isSelected ? "| " : isHighlighted ? "> " : "  ";

  return (
    <Box>
      <Text
        color={isHighlighted ? ctx.tokens.fg : undefined}
        backgroundColor={isHighlighted ? ctx.tokens.accent : undefined}
        bold={isHighlighted || isSelected}
      >
        {prefix}
      </Text>
      <Box>
        {children}
      </Box>
    </Box>
  );
}

// --- Root ---

function NavigationListRoot({
  selectedId = null,
  highlightedId: controlledHighlightedId = null,
  onSelect,
  onHighlightChange,
  wrap = true,
  isActive = true,
  children,
}: NavigationListProps) {
  const { tokens } = useTheme();
  const items = collectChildItems(children, extractNavigationListItem);
  const selectableItems = items.filter((item) => !item.disabled);

  const [internalIndex, setInternalIndex] = useState(0);

  const currentHighlightedId =
    controlledHighlightedId ??
    selectableItems[internalIndex]?.id ??
    "";

  function moveHighlight(direction: 1 | -1) {
    if (selectableItems.length === 0) return;

    const currentIdx = selectableItems.findIndex(
      (item) => item.id === currentHighlightedId,
    );
    const nextIdx = clampIndex(currentIdx, direction, selectableItems.length, wrap);

    const nextItem = selectableItems[nextIdx];
    if (!nextItem) return;

    setInternalIndex(nextIdx);
    onHighlightChange?.(nextItem.id);
  }

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        moveHighlight(-1);
        return;
      }
      if (key.downArrow) {
        moveHighlight(1);
        return;
      }
      if (key.return) {
        const item = selectableItems.find((i) => i.id === currentHighlightedId);
        if (item) {
          onSelect?.(item.id);
        }
        return;
      }
    },
    { isActive },
  );

  return (
    <NavigationListContext
      value={{
        highlightedId: currentHighlightedId,
        selectedId,
        tokens,
      }}
    >
      <Box flexDirection="column">{children}</Box>
    </NavigationListContext>
  );
}

// --- Compound export ---

export const NavigationList = Object.assign(NavigationListRoot, {
  Item: NavigationListItem,
  Title: NavigationListTitle,
  Badge: NavigationListBadge,
  Status: NavigationListStatus,
  Subtitle: NavigationListSubtitle,
});
