import { Box, Text, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { createContext, useContext } from "react";
import { useListNavigation } from "../../hooks/use-list-navigation";
import { useListNavigationInput } from "../../hooks/use-list-navigation-input";
import { collectChildItems } from "../../lib/collect-child-items";
import { type RowTone, rowTone } from "../../theme/chrome";
import type { CliColorTokens } from "../../theme/palettes";
import { useTheme } from "../../theme/provider";
import { Rule } from "./rule";

export interface MenuProps<Id extends string = string> {
  highlightedId?: Id | null;
  onSelect?: (id: Id) => void;
  onHighlightChange?: (id: Id) => void;
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
  /** Semantic colour for `value`. Ignored while the row is highlighted, where the fill owns contrast. */
  valueColor?: string;
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
    throw new Error("Menu.Item must be used within a Menu");
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

function getMenuLabelColor({
  disabled,
  isHighlighted,
  variant,
  tone,
  tokens,
}: {
  disabled: boolean;
  isHighlighted: boolean;
  variant: NonNullable<MenuItemProps["variant"]>;
  tone: RowTone;
  tokens: CliColorTokens;
}): string {
  if (disabled) return tokens.muted;
  if (variant === "danger" && !isHighlighted) return tokens.error;
  return tone.primary;
}

function MenuItem<Id extends string = string>({
  id,
  disabled = false,
  variant = "default",
  hotkey,
  value,
  valueColor,
  children,
}: MenuItemProps<Id>) {
  const ctx = useMenuContext();
  const isHighlighted = !disabled && ctx.highlightedId === id;
  const isHub = ctx.menuVariant === "hub";

  const tone = rowTone(ctx.tokens, {
    isHighlighted,
    fill: variant === "danger" ? ctx.tokens.error : undefined,
  });
  const labelColor = getMenuLabelColor({
    disabled,
    isHighlighted,
    variant,
    tone,
    tokens: ctx.tokens,
  });
  // A disabled row keeps the hotkey column so labels stay aligned, but blanks
  // the key itself rather than advertising a shortcut that does nothing.
  const hotkeyLabel = hotkey == null ? null : `${hotkey}. `;

  return (
    <Box
      width="100%"
      justifyContent={isHub ? "space-between" : undefined}
      backgroundColor={tone.background}
    >
      <Text color={labelColor} bold={isHighlighted}>
        {!isHub && (isHighlighted ? "> " : "  ")}
        {hotkeyLabel && (
          <Text color={tone.secondary}>
            {disabled ? " ".repeat(hotkeyLabel.length) : hotkeyLabel}
          </Text>
        )}
        {children}
      </Text>
      {isHub && value != null && (
        <Text color={isHighlighted ? tone.secondary : (valueColor ?? tone.secondary)}>
          {" "}
          {value}
        </Text>
      )}
    </Box>
  );
}

function MenuDivider() {
  return <Rule />;
}

function MenuRoot<Id extends string = string>({
  highlightedId: controlledHighlightedId = null,
  onSelect,
  onHighlightChange,
  variant = "default",
  wrap = true,
  isActive = true,
  children,
}: MenuProps<Id>) {
  const { tokens } = useTheme();
  const items = collectChildItems(children, extractMenuItem);
  const navigation = useListNavigation({
    items,
    highlightedId: controlledHighlightedId,
    onHighlightChange: (id) => onHighlightChange?.(id as Id),
    wrap,
  });

  useListNavigationInput({
    navigation,
    isActive,
    onActivate: (item) => onSelect?.(item.id as Id),
  });

  useInput(
    (input) => {
      // j/k move the highlight in every vertical list, so a menu row can never
      // claim them as a hotkey and have one keypress both move and activate.
      if (input.length !== 1 || input === "j" || input === "k") return;
      for (const item of items) {
        if (item.hotkey == null || String(item.hotkey) !== input) continue;
        if (!navigation.findSelectableItem(item.id)) continue;
        onSelect?.(item.id as Id);
        return;
      }
    },
    { isActive },
  );

  return (
    <MenuContext
      value={{
        highlightedId: navigation.currentHighlightedId,
        menuVariant: variant,
        tokens,
      }}
    >
      <Box flexDirection="column" width="100%">
        {children}
      </Box>
    </MenuContext>
  );
}

export const Menu = Object.assign(MenuRoot, {
  Item: MenuItem,
  Divider: MenuDivider,
});
