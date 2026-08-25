import { cva } from "class-variance-authority";

export type ItemState =
  | "normal"
  | "focused"
  | "selected"
  | "hovered"
  | "disabled"
  | "disabledFocused";

export function getItemState(options: {
  disabled: boolean;
  isFocused: boolean;
  isSelected: boolean;
  isHovered: boolean;
}): ItemState {
  const { disabled, isFocused, isSelected, isHovered } = options;
  if (disabled && isFocused) return "disabledFocused";
  if (disabled) return "disabled";
  if (isFocused) return "focused";
  if (isSelected) return "selected";
  if (isHovered) return "hovered";
  return "normal";
}

export const menuItemBase = cva("cursor-pointer w-full transition-colors", {
  variants: {
    menuVariant: {
      default: "px-4 py-3 flex items-center font-mono duration-75",
      // No per-row rule: a hairline under every row reads as a data table.
      // The right-aligned dim value column carries the rhythm instead, and
      // MenuDivider still draws real group boundaries.
      detail: "px-4 py-4 flex justify-between items-center text-sm",
    },
    // No CSS :hover anywhere in here: hover is JS state (data-hovered, set by
    // real pointer travel in useMenuItemInteractions and cleared by navigation
    // keys), so a stationary cursor can never keep a stale affordance on a row
    // the keyboard has left. The keyboard cursor (focused) always outranks it.
    state: {
      normal: "",
      focused: "font-bold",
      selected: "font-bold",
      hovered: "bg-secondary text-foreground",
      disabled: "opacity-50 cursor-not-allowed",
      disabledFocused: "opacity-60 cursor-not-allowed bg-secondary text-foreground",
    },
    colorVariant: {
      default: "",
      danger: "",
    },
  },
  compoundVariants: [
    {
      colorVariant: "danger",
      state: "focused",
      class: "bg-error text-error-foreground",
    },
    { colorVariant: "default", state: "focused", class: "bg-primary text-primary-foreground" },
    {
      colorVariant: "danger",
      state: "selected",
      class: "bg-error text-error-foreground",
    },
    { colorVariant: "default", state: "selected", class: "bg-primary text-primary-foreground" },
    { colorVariant: "danger", state: "normal", menuVariant: "default", class: "text-error" },
    // Hover is subordinate: danger rows keep their palette under it.
    { colorVariant: "danger", state: "hovered", menuVariant: "default", class: "text-error" },
  ],
  defaultVariants: { menuVariant: "default", state: "normal", colorVariant: "default" },
});

export const menuItemIndicator = cva(
  "pr-4 shrink-0 inline-flex items-center justify-center self-center leading-none font-mono text-xs",
  {
    variants: {
      idle: {
        true: "opacity-60",
        false: "",
      },
    },
    defaultVariants: { idle: false },
  },
);

export const menuItemValue = cva("font-mono text-xs", {
  variants: {
    valueVariant: {
      default: "",
      success: "",
      "success-badge": "border px-2 py-0.5 rounded",
      muted: "",
    },
    active: {
      true: "uppercase tracking-wide",
      false: "",
    },
  },
  compoundVariants: [
    { valueVariant: "default", active: false, class: "text-muted-foreground" },
    { valueVariant: "success", active: false, class: "text-success" },
    {
      valueVariant: "success-badge",
      active: false,
      class: "text-success border-success/30 bg-success/10",
    },
    { valueVariant: "muted", active: false, class: "text-muted-foreground/60" },
    { valueVariant: "default", active: true, class: "text-current" },
    { valueVariant: "success", active: true, class: "text-current" },
    { valueVariant: "muted", active: true, class: "text-current" },
    {
      valueVariant: "success-badge",
      active: true,
      class: "border-success bg-success text-success-foreground",
    },
  ],
  defaultVariants: { valueVariant: "default", active: false },
});
