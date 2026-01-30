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

interface MenuItemData {
  id: string;
  disabled: boolean;
  index: number;
}

interface MenuContextValue {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: MenuItemData) => void;
  items: MenuItemData[];
}

interface MenuItemProps {
  id: string;
  disabled?: boolean;
  variant?: "default" | "danger";
  hotkey?: number | string;
  value?: ReactNode;
  valueVariant?: "default" | "success" | "muted";
  children: ReactNode;
}

interface MenuRootProps {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: MenuItemData) => void;
  isActive?: boolean;
  enableNumberJump?: boolean;
  children: ReactNode;
}

interface MenuDividerProps {
  label?: string;
}

interface MenuHeaderProps {
  children: ReactNode;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext(): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error("MenuItem must be used within Menu");
  }
  return context;
}

function extractMenuItems(node: ReactNode): MenuItemData[] {
  const items: MenuItemData[] = [];
  let itemIndex = 0;

  function walk(n: ReactNode): void {
    Children.forEach(n, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        walk((child.props as { children?: ReactNode }).children);
      } else if (child.type === MenuItem) {
        const props = child.props as MenuItemProps;
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

export function MenuItem({
  id,
  disabled = false,
  variant = "default",
  hotkey,
  value,
  valueVariant = "default",
  children,
}: MenuItemProps): ReactElement | null {
  const { selectedIndex, items } = useMenuContext();
  const { colors } = useTheme();

  const itemData = items.find((item) => item.id === id);
  if (!itemData) return null;

  const isSelected = itemData.index === selectedIndex;
  const isDanger = variant === "danger";

  const getTextColor = (): string | undefined => {
    if (disabled) return colors.ui.textMuted;
    if (isSelected) return "black";
    if (isDanger) return colors.ui.error;
    return colors.ui.text;
  };

  const getValueColor = (): string => {
    if (isSelected) return "black";
    if (valueVariant === "success") return colors.ui.success;
    if (valueVariant === "muted") return colors.ui.textMuted;
    return colors.ui.textMuted;
  };

  const bgColor = isSelected
    ? isDanger
      ? colors.ui.error
      : colors.ui.info
    : undefined;

  return (
    <Box paddingX={1}>
      <Text backgroundColor={bgColor} color={getTextColor()} dimColor={disabled}>
        <Text color={isSelected ? "black" : colors.ui.info}>
          {isSelected ? "▌" : " "}
        </Text>
        {hotkey !== undefined && (
          <Text color={isSelected ? "black" : colors.ui.info}> [{hotkey}] </Text>
        )}
        <Text>{children}</Text>
        {value && (
          <Text color={getValueColor()}> {value}</Text>
        )}
      </Text>
    </Box>
  );
}

export function MenuDivider({ label }: MenuDividerProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box paddingX={1} paddingY={0}>
      <Text color={colors.ui.border}>
        {label ? `── ${label} ──` : "────────────────"}
      </Text>
    </Box>
  );
}

export function MenuHeader({ children }: MenuHeaderProps): ReactElement {
  const { colors } = useTheme();

  return (
    <Box paddingX={1} marginBottom={0}>
      <Text color={colors.ui.info} bold>
        [{children}]
      </Text>
    </Box>
  );
}

export function Menu({
  selectedIndex,
  onSelect,
  onActivate,
  isActive = true,
  enableNumberJump = false,
  children,
}: MenuRootProps): ReactElement {
  const items = extractMenuItems(children);

  useInput(
    (input, key) => {
      if (!isActive) return;

      // j/k or arrow navigation
      if ((key.upArrow || input === "k") && selectedIndex > 0) {
        const newIndex = findPrevEnabled(items, selectedIndex);
        if (newIndex !== -1) onSelect(newIndex);
      }

      if ((key.downArrow || input === "j") && selectedIndex < items.length - 1) {
        const newIndex = findNextEnabled(items, selectedIndex);
        if (newIndex !== -1) onSelect(newIndex);
      }

      // Enter to activate
      if (key.return) {
        const item = items[selectedIndex];
        if (item && !item.disabled) {
          onActivate?.(item);
        }
      }

      // Number jump (1-9)
      if (enableNumberJump && /^[1-9]$/.test(input)) {
        const index = parseInt(input, 10) - 1;
        const item = items[index];
        if (item && !item.disabled) {
          onSelect(index);
          onActivate?.(item);
        }
      }
    },
    { isActive }
  );

  const contextValue: MenuContextValue = {
    selectedIndex,
    onSelect,
    onActivate,
    items,
  };

  return (
    <MenuContext.Provider value={contextValue}>
      <Box flexDirection="column">{children}</Box>
    </MenuContext.Provider>
  );
}

export type {
  MenuRootProps,
  MenuItemProps,
  MenuDividerProps,
  MenuHeaderProps,
  MenuItemData,
};
