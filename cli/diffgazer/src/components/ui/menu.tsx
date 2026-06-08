import { moveHighlight } from "@diffgazer/keys";
import { Box, Text, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { collectChildItems } from "../../lib/list-navigation";
import type { CliColorTokens } from "../../theme/palettes";
import { useTheme } from "../../theme/provider";

export interface MenuProps {
  highlightedId?: string | null;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  onClose?: () => void;
  variant?: "default" | "hub";
  wrap?: boolean;
  isActive?: boolean;
  children: ReactNode;
}

export interface MenuItemProps {
  id: string;
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

function MenuItem({
  id,
  disabled = false,
  variant = "default",
  hotkey,
  value,
  children,
}: MenuItemProps) {
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

function MenuRoot({
  highlightedId: controlledHighlightedId = null,
  onSelect,
  onHighlightChange,
  onClose,
  variant = "default",
  wrap = true,
  isActive = true,
  children,
}: MenuProps) {
  const { tokens } = useTheme();
  const items = collectChildItems(children, extractMenuItem);
  const selectableItems = items.filter((item) => !item.disabled);
  const [internalHighlightedId, setInternalHighlightedId] = useState<string | null>(null);
  const uncontrolledHighlightedId =
    internalHighlightedId !== null &&
    selectableItems.some((item) => item.id === internalHighlightedId)
      ? internalHighlightedId
      : (selectableItems[0]?.id ?? "");
  const currentHighlightedId = controlledHighlightedId ?? uncontrolledHighlightedId;

  function moveBy(direction: 1 | -1) {
    const result = moveHighlight(items, currentHighlightedId, direction, wrap);
    if (!result) return;
    setInternalHighlightedId(result.id);
    onHighlightChange?.(result.id);
  }

  function selectItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || item.disabled) return;
    onSelect?.(id);
  }

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
        selectItem(currentHighlightedId);
        return;
      }
      if (key.escape) {
        onClose?.();
        return;
      }
      if (input.length === 1) {
        for (const item of selectableItems) {
          if (item.hotkey != null && String(item.hotkey) === input) {
            selectItem(item.id);
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
