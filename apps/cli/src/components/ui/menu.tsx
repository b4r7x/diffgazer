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
import { findNextEnabled, findPrevEnabled } from "@repo/core";
import { Separator } from "./separator.js";
import type { MenuItemData } from "@repo/schemas/ui";

export type { MenuItemData };

// Internal context type with required disabled field
interface InternalMenuItemData {
  id: string;
  disabled: boolean;
  index: number;
}

interface MenuContextValue {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: MenuItemData) => void;
  items: InternalMenuItemData[];
  variant: "default" | "hub";
  lastIndex: number;
  width: number;
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
  variant?: "default" | "hub";
  width?: number;
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

function isMenuItemProps(props: unknown): props is MenuItemProps {
  return typeof props === "object" && props !== null && "id" in props && typeof (props as MenuItemProps).id === "string";
}

function extractMenuItems(node: ReactNode): InternalMenuItemData[] {
  const items: InternalMenuItemData[] = [];
  let itemIndex = 0;

  function walk(n: ReactNode): void {
    Children.forEach(n, (child) => {
      if (!isValidElement(child)) return;
      if (child.type === Fragment) {
        walk((child.props as { children?: ReactNode }).children);
      } else if (child.type === MenuItem || isMenuItemProps(child.props)) {
        // Support both direct MenuItem and wrapper components with MenuItem-like props
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
  const { selectedIndex, items, variant: menuVariant, lastIndex, width: menuWidth } = useMenuContext();
  const { colors } = useTheme();

  const itemData = items.find((item) => item.id === id);
  if (!itemData) return null;

  const isSelected = itemData.index === selectedIndex;
  const isDanger = variant === "danger";
  const isHub = menuVariant === "hub";
  const isLast = itemData.index === lastIndex;

  function getTextColor(): string | undefined {
    if (disabled) return colors.ui.textMuted;
    if (isSelected) return "black";
    if (isDanger) return colors.ui.error;
    return colors.ui.text;
  }

  function getValueColor(): string {
    if (isSelected) return "black";
    if (valueVariant === "success") return colors.ui.success;
    return colors.ui.textMuted;
  }

  const bgColor = isSelected ? (isDanger ? colors.ui.error : colors.ui.info) : undefined;

  if (isHub) {
    return (
      <Box flexDirection="column">
        <Box paddingX={2} paddingY={1}>
          <Text backgroundColor={bgColor} color={getTextColor()} dimColor={disabled}>
            <Text color={isSelected ? "black" : colors.ui.info}>
              {isSelected ? "▌" : " "}
            </Text>
            <Text> {children}</Text>
          </Text>
          <Box flexGrow={1} />
          {value && (
            <Text color={getValueColor()}>{value}</Text>
          )}
        </Box>
        {!isLast && (
          <Box paddingX={2}>
            <Separator width={Math.max(1, menuWidth - 4)} />
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box paddingX={2}>
      <Box width={menuWidth - 4}>
        <Text backgroundColor={bgColor} color={getTextColor()} dimColor={disabled}>
          <Text color={isSelected ? "black" : colors.ui.info}>
            {isSelected ? "▌" : " "}
          </Text>
          {hotkey !== undefined && (
            <Text color={isSelected ? "black" : colors.ui.info}> [{hotkey}] </Text>
          )}
          <Text>{children}</Text>
        </Text>
        <Box flexGrow={1} />
        {value && (
          <Text backgroundColor={bgColor} color={getValueColor()}>{value}</Text>
        )}
      </Box>
    </Box>
  );
}

export function MenuDivider({ label }: MenuDividerProps): ReactElement {
  const { colors } = useTheme();
  const { width } = useMenuContext();
  const separatorWidth = Math.max(1, width - 2); // Account for paddingX

  return (
    <Box paddingX={1} paddingY={0}>
      {label ? (
        <Text color={colors.ui.border}>── {label} ──</Text>
      ) : (
        <Separator width={separatorWidth} />
      )}
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
  variant = "default",
  width = 60,
  children,
}: MenuRootProps): ReactElement {
  const items = extractMenuItems(children);
  const lastIndex = items.length - 1;

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
    variant,
    lastIndex,
    width,
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
};
