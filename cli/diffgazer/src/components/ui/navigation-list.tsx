import { Box, Text } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext } from "react";
import { type ListNavigationItem, useListNavigation } from "../../hooks/use-list-navigation";
import { useListNavigationInput } from "../../hooks/use-list-navigation-input";
import { collectChildItems } from "../../lib/collect-child-items";
import { type RowTone, rowTone, selectionHue } from "../../theme/chrome";
import type { CliColorTokens } from "../../theme/palettes";
import { useTheme } from "../../theme/provider";

export interface NavigationListProps {
  selectedId?: string | null;
  highlightedId?: string | null;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  wrap?: boolean;
  isActive?: boolean;
  navigationItems?: ListNavigationItem[];
  children: ReactNode;
}

interface NavigationListItemState {
  isHighlighted: boolean;
  tone: RowTone;
}

interface NavigationListItemProps {
  id: string;
  disabled?: boolean;
  /**
   * Pass a function to colour the row against the highlight fill — the
   * highlighted row of a focused list is a full-width selection bar, so row
   * text has to switch to the background token to stay readable. The row tone
   * is already resolved against the list's active state.
   */
  children: ReactNode | ((state: NavigationListItemState) => ReactNode);
}

interface NavigationListTitleProps {
  children: string;
}

interface NavigationListContextValue {
  highlightedId: string;
  selectedId: string | null;
  isActive: boolean;
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

function NavigationListItem({ id, disabled = false, children }: NavigationListItemProps) {
  const ctx = useNavigationListContext();
  const isHighlighted = ctx.highlightedId === id;
  const isSelected = ctx.selectedId === id;
  const tone = rowTone(ctx.tokens, { isHighlighted, isActive: ctx.isActive });
  const content = typeof children === "function" ? children({ isHighlighted, tone }) : children;

  if (disabled) {
    return (
      <Box>
        <Text>{"  "}</Text>
        <Box>{content}</Box>
      </Box>
    );
  }

  const markerColor = isSelected && !isHighlighted ? selectionHue(ctx.tokens) : tone.primary;

  return (
    <Box width="100%" backgroundColor={tone.background}>
      <Text color={markerColor} bold={isHighlighted || isSelected}>
        {getItemPrefix(isSelected, isHighlighted)}
      </Text>
      <Box>{content}</Box>
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
  navigationItems,
  children,
}: NavigationListProps) {
  const { tokens } = useTheme();
  const renderedItems = collectChildItems(children, extractNavigationListItem);
  const items = navigationItems ?? renderedItems;
  const navigation = useListNavigation({
    items,
    highlightedId: controlledHighlightedId,
    onHighlightChange,
    wrap,
  });

  useListNavigationInput({
    navigation,
    isActive,
    onActivate: (item) => onSelect?.(item.id),
  });

  return (
    <NavigationListContext
      value={{
        highlightedId: navigation.currentHighlightedId,
        selectedId,
        isActive,
        tokens,
      }}
    >
      <Box flexDirection="column" width="100%">
        {children}
      </Box>
    </NavigationListContext>
  );
}

export const NavigationList = Object.assign(NavigationListRoot, {
  Item: NavigationListItem,
  Title: NavigationListTitle,
});
