import { createContext, useState, useContext } from "react";
import type { ReactElement, ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import { useTheme } from "../../theme/theme-context.js";
import type { CliColorTokens } from "../../theme/palettes.js";
import { clampIndex, collectChildItems } from "../../lib/list-navigation.js";

// --- Types ---

export interface MenuProps {
  selectedId?: string | null;
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

export interface MenuDividerProps {}

// --- Context ---

interface MenuContextValue {
  highlightedId: string;
  selectedId: string | null;
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

// --- Item collection ---

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

// --- Components ---

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
  const isSelected = ctx.selectedId === id;

  if (disabled) {
    return (
      <Box>
        {ctx.menuVariant === "default" && <Text dimColor>  </Text>}
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
        {value != null && (
          <Text color={ctx.tokens.muted}> {value}</Text>
        )}
      </Box>
    );
  }

  // Default variant
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

function MenuDivider(_props: MenuDividerProps) {
  const ctx = useMenuContext();
  return (
    <Box>
      {ctx.menuVariant === "default" && <Text dimColor>  </Text>}
      <Text color={ctx.tokens.border}>{"─".repeat(20)}</Text>
    </Box>
  );
}

function MenuRoot({
  selectedId = null,
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

  const [internalIndex, setInternalIndex] = useState(0);

  // Resolve highlighted id: controlled takes priority
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

  function selectItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item || item.disabled) return;
    onSelect?.(id);
  }

  useInput(
    (input, key) => {
      if (key.upArrow) {
        moveHighlight(-1);
        return;
      }
      if (key.downArrow) {
        moveHighlight(1);
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

      // Hotkey matching
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
        selectedId: selectedId,
        menuVariant: variant,
        tokens,
      }}
    >
      <Box flexDirection="column">{children}</Box>
    </MenuContext>
  );
}

// --- Compound export ---

export const Menu = Object.assign(MenuRoot, {
  Item: MenuItem,
  Divider: MenuDivider,
});
