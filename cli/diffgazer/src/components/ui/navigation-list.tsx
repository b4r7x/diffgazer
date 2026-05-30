import { createContext, useState, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../theme/theme-context";
import type { CliColorTokens } from "../../theme/palettes";
import { collectChildItems } from "../../lib/list-navigation";
import { moveHighlight } from "../../lib/highlight-navigation";

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

interface CollectedItem {
  id: string;
  disabled: boolean;
}

function extractNavigationListItem(element: ReactElement): CollectedItem | null {
  if (element.type !== NavigationListItem) return null;
  const props = element.props as NavigationListItemProps;
  return { id: props.id, disabled: props.disabled ?? false };
}

function getItemPrefix(isSelected: boolean, isHighlighted: boolean): string {
  if (isSelected) return "| ";
  if (isHighlighted) return "> ";
  return "  ";
}

function NavigationListTitle({ children }: NavigationListTitleProps) {
  const ctx = useNavigationListContext();
  return (
    <Text color={ctx.tokens.fg} bold>
      {children}
    </Text>
  );
}

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

  const prefix = getItemPrefix(isSelected, isHighlighted);

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

  function moveBy(direction: 1 | -1) {
    const result = moveHighlight(selectableItems, currentHighlightedId, direction, wrap);
    if (!result) return;
    setInternalIndex(result.index);
    onHighlightChange?.(result.id);
  }

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        moveBy(-1);
        return;
      }
      if (key.downArrow) {
        moveBy(1);
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

export const NavigationList = Object.assign(NavigationListRoot, {
  Item: NavigationListItem,
  Title: NavigationListTitle,
});
