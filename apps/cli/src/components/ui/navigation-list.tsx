import {
  createContext,
  useContext,
  Children,
  isValidElement,
  Fragment,
  type ReactNode,
  type ReactElement,
} from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../hooks/use-theme.js";
import { findNextEnabled, findPrevEnabled } from "../../lib/list-navigation.js";

interface NavigationListItemData {
  id: string;
  disabled: boolean;
  index: number;
}

interface NavigationListContextValue {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onActivate?: (id: string) => void;
  isFocused: boolean;
  items: NavigationListItemData[];
}

interface NavigationListItemProps {
  id: string;
  disabled?: boolean;
  badge?: ReactNode;
  statusIndicator?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}

interface NavigationListRootProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onActivate?: (id: string) => void;
  isActive?: boolean;
  isFocused?: boolean;
  children: ReactNode;
  onBoundaryReached?: (direction: "up" | "down") => void;
}

const NavigationListContext = createContext<NavigationListContextValue | null>(null);

function useNavigationListContext(): NavigationListContextValue {
  const context = useContext(NavigationListContext);
  if (!context) {
    throw new Error("NavigationListItem must be used within NavigationList");
  }
  return context;
}

function extractListItems(node: ReactNode): NavigationListItemData[] {
  const items: NavigationListItemData[] = [];
  let itemIndex = 0;

  function walk(n: ReactNode): void {
    Children.forEach(n, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        walk((child.props as { children?: ReactNode }).children);
      } else if (child.type === NavigationListItem) {
        const props = child.props as NavigationListItemProps;
        items.push({
          id: props.id,
          disabled: props.disabled ?? false,
          index: itemIndex++,
        });
      }
    });
  }

  walk(node);
  return items;
}

export function NavigationListItem({
  id,
  disabled = false,
  badge,
  statusIndicator,
  subtitle,
  children,
}: NavigationListItemProps): ReactElement | null {
  const { selectedId, isFocused, items } = useNavigationListContext();
  const { colors } = useTheme();

  const itemData = items.find((item) => item.id === id);
  if (!itemData) return null;

  const isSelected = selectedId === id;
  const showHighlight = isSelected && isFocused;

  const bgColor = showHighlight ? colors.ui.text : undefined;
  const textColor = showHighlight ? "black" : colors.ui.text;
  const mutedColor = showHighlight ? "black" : colors.ui.textMuted;

  return (
    <Box
      flexDirection="row"
      paddingX={1}
      borderStyle={showHighlight ? undefined : "single"}
      borderColor={showHighlight ? undefined : colors.ui.border}
      borderLeft={false}
      borderRight={false}
      borderTop={false}
    >
      {/* Selection indicator bar */}
      <Text color={showHighlight ? colors.ui.info : colors.ui.border}>
        {showHighlight ? "▌" : "│"}
      </Text>
      <Box flexDirection="column" flexGrow={1} paddingLeft={1}>
        {/* Main row: label + status indicator */}
        <Box justifyContent="space-between">
          <Text
            backgroundColor={bgColor}
            color={disabled ? colors.ui.textMuted : textColor}
            bold={showHighlight}
            dimColor={disabled}
          >
            {showHighlight ? "▌ " : "  "}
            {children}
          </Text>
          {statusIndicator && (
            <Text color={showHighlight ? "black" : colors.ui.warning} bold>
              {statusIndicator}
            </Text>
          )}
        </Box>
        {/* Subtitle row: badge + subtitle */}
        {(badge || subtitle) && (
          <Box gap={1} paddingLeft={2}>
            {badge}
            {subtitle && <Text color={mutedColor}>{subtitle}</Text>}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export function NavigationList({
  selectedId,
  onSelect,
  onActivate,
  isActive = true,
  isFocused = true,
  children,
  onBoundaryReached,
}: NavigationListRootProps): ReactElement {
  const items = extractListItems(children);

  const currentIndex = items.findIndex((item) => item.id === selectedId);

  useInput(
    (input, key) => {
      if (!isActive) return;

      // j/k or arrow navigation
      if (key.upArrow || input === "k") {
        if (currentIndex <= 0) {
          onBoundaryReached?.("up");
          return;
        }
        const newIndex = findPrevEnabled(items, currentIndex);
        if (newIndex !== -1) {
          const item = items[newIndex];
          if (item) onSelect(item.id);
        }
      }

      if (key.downArrow || input === "j") {
        if (currentIndex >= items.length - 1) {
          onBoundaryReached?.("down");
          return;
        }
        const newIndex = findNextEnabled(items, currentIndex);
        if (newIndex !== -1) {
          const item = items[newIndex];
          if (item) onSelect(item.id);
        }
      }

      // Enter to activate
      if (key.return) {
        const item = items[currentIndex];
        if (item && !item.disabled) {
          onActivate?.(item.id);
        }
      }
    },
    { isActive }
  );

  const contextValue: NavigationListContextValue = {
    selectedId,
    onSelect,
    onActivate,
    isFocused,
    items,
  };

  return (
    <NavigationListContext.Provider value={contextValue}>
      <Box flexDirection="column">{children}</Box>
    </NavigationListContext.Provider>
  );
}

export type {
  NavigationListRootProps,
  NavigationListItemProps,
  NavigationListItemData,
};
