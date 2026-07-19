import { Box, Text, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext } from "react";
import { useListNavigation } from "../../hooks/use-list-navigation";
import { collectChildItems } from "../../lib/collect-child-items";
import type { CliColorTokens } from "../../theme/palettes";
import { useTheme } from "../../theme/provider";

export interface MenuProps<Id extends string = string> {
  highlightedId?: Id | null;
  onSelect?: (id: Id) => void;
  onHighlightChange?: (id: Id) => void;
  onClose?: () => void;
  variant?: "default" | "hub";
  wrap?: boolean;
  isActive?: boolean;
  children: ReactNode;
}

export interface MenuItemProps<Id extends string = string> {
  id: Id;
  disabled?: boolean;
  variant?: "default" | "danger";
  hotkey?: string | number;
  value?: string;
  children: string;
}

interface MenuContextValue {
  highlightedId: string;
  menuVariant: "default" | "hub";
  tokens: CliColorTokens;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext(): MenuContextValue {
  const value = useContext(MenuContext);
  if (!value) {
    throw new Error("Menu.Item/Menu.Divider must be used within a Menu");
  }
  return value;
}

interface CollectedItem {
  id: string;
  disabled: boolean;
  hotkey?: string | number;
}

function extractMenuItem(element: ReactElement): CollectedItem | null {
  if (element.type !== MenuItem) return null;
  const props = element.props as MenuItemProps;
  return { id: props.id, disabled: props.disabled ?? false, hotkey: props.hotkey };
}

function MenuItem<Id extends string = string>({
  id,
  disabled = false,
  variant = "default",
  hotkey,
  value,
  children,
}: MenuItemProps<Id>) {
  const ctx = useMenuContext();
  const isHighlighted = ctx.highlightedId === id;

  if (disabled) {
    return (
      <Box>
        {ctx.menuVariant === "default" && <Text dimColor> </Text>}
        <Text dimColor>{children}</Text>
      </Box>
    );
  }

  const color = variant === "danger" ? ctx.tokens.error : undefined;

  if (ctx.menuVariant === "hub") {
    return (
      <Box justifyContent="space-between">
        <Text
          color={isHighlighted ? ctx.tokens.fg : color}
          backgroundColor={isHighlighted ? ctx.tokens.accent : undefined}
          bold={isHighlighted}
        >
          {hotkey != null && <Text dimColor>{`${hotkey}. `}</Text>}
          {children}
        </Text>
        {value != null && <Text color={ctx.tokens.muted}> {value}</Text>}
      </Box>
    );
  }

  const prefix = isHighlighted ? "> " : "  ";

  return (
    <Box>
      <Text
        color={isHighlighted ? ctx.tokens.fg : color}
        backgroundColor={isHighlighted ? ctx.tokens.accent : undefined}
        bold={isHighlighted}
      >
        {prefix}
        {hotkey != null && <Text dimColor>{`${hotkey}. `}</Text>}
        {children}
      </Text>
    </Box>
  );
}

function MenuDivider() {
  const ctx = useMenuContext();
  return (
    <Box>
      {ctx.menuVariant === "default" && <Text dimColor> </Text>}
      <Text color={ctx.tokens.border}>{"─".repeat(20)}</Text>
    </Box>
  );
}

function MenuRoot<Id extends string = string>({
  highlightedId: controlledHighlightedId = null,
  onSelect,
  onHighlightChange,
  onClose,
  variant = "default",
  wrap = true,
  isActive = true,
  children,
}: MenuProps<Id>) {
  const { tokens } = useTheme();
  const items = collectChildItems(children, extractMenuItem);
  const { currentHighlightedId, moveBy, selectItem } = useListNavigation({
    items,
    highlightedId: controlledHighlightedId,
    onHighlightChange: (id) => onHighlightChange?.(id as Id),
    wrap,
  });

  useInput(
    (input, key) => {
      if (key.upArrow) {
        moveBy(-1);
        return;
      }
      if (key.downArrow) {
        moveBy(1);
        return;
      }
      if (key.return) {
        const item = selectItem(currentHighlightedId);
        if (item) {
          onSelect?.(item.id as Id);
        }
        return;
      }
      if (key.escape) {
        onClose?.();
        return;
      }
      if (input.length === 1) {
        for (const item of items) {
          if (item.hotkey != null && String(item.hotkey) === input && selectItem(item.id)) {
            onSelect?.(item.id as Id);
            return;
          }
        }
      }
    },
    { isActive },
  );

  return (
    <MenuContext
      value={{
        highlightedId: currentHighlightedId,
        menuVariant: variant,
        tokens,
      }}
    >
      <Box flexDirection="column">{children}</Box>
    </MenuContext>
  );
}

export const Menu = Object.assign(MenuRoot, {
  Item: MenuItem,
  Divider: MenuDivider,
});
