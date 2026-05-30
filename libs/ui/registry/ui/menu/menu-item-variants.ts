import { cva } from "class-variance-authority";

export type ItemState = "normal" | "focused" | "selected" | "disabled" | "disabledFocused";

export function getItemState(options: { disabled: boolean; isFocused: boolean; isSelected: boolean }): ItemState {
  const { disabled, isFocused, isSelected } = options;
  if (disabled && isFocused) return "disabledFocused";
  if (disabled) return "disabled";
  if (isFocused) return "focused";
  if (isSelected) return "selected";
  return "normal";
}

export const menuItemBase = cva("cursor-pointer w-full transition-colors", {
  variants: {
    menuVariant: {
      default: "px-4 py-3 flex items-center font-mono duration-75",
      hub: "px-4 py-4 flex justify-between items-center text-sm border-b border-border last:border-b-0",
    },
    state: {
      normal: "hover:bg-secondary group",
      focused: "font-bold",
      selected: "font-bold group",
      disabled: "opacity-50 cursor-not-allowed",
      disabledFocused: "opacity-60 cursor-not-allowed bg-secondary text-foreground",
    },
    colorVariant: {
      default: "",
      danger: "",
    },
  },
  compoundVariants: [
    { state: "focused", menuVariant: "hub", class: "shadow-[inset_0_0_15px_rgba(0,0,0,0.1)]" },
    { state: "disabled", menuVariant: "default", class: "hover:bg-transparent" },
    { state: "disabledFocused", menuVariant: "hub", class: "shadow-[inset_0_0_15px_rgba(0,0,0,0.1)]" },
    { colorVariant: "danger", state: "focused", class: "bg-destructive text-destructive-foreground" },
    { colorVariant: "default", state: "focused", class: "bg-primary text-primary-foreground" },
    { colorVariant: "danger", state: "selected", class: "bg-destructive text-destructive-foreground" },
    { colorVariant: "default", state: "selected", class: "bg-primary text-primary-foreground" },
    { colorVariant: "danger", state: "normal", menuVariant: "default", class: "text-destructive" },
  ],
  defaultVariants: { menuVariant: "default", state: "normal", colorVariant: "default" },
});

export const menuItemIndicator = cva(
  "pr-4 shrink-0 inline-flex items-center justify-center self-center leading-none font-mono text-xs",
  {
    variants: {
      idle: {
        true: "transition-opacity opacity-60 group-hover:opacity-100",
        false: "",
      },
    },
    defaultVariants: { idle: false },
  },
);

export const menuItemLabel = cva("tracking-wide", {
  variants: {
    idle: {
      true: "group-hover:text-foreground",
      false: "",
    },
  },
  defaultVariants: { idle: false },
});

export const menuItemValue = cva("font-mono text-xs", {
  variants: {
    valueVariant: {
      default: "",
      success: "",
      "success-badge": "border px-2 py-0.5 rounded",
      muted: "",
    },
    focused: {
      true: "uppercase tracking-wide",
      false: "",
    },
    active: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    { valueVariant: "default", active: false, class: "text-muted-foreground" },
    { valueVariant: "success", active: false, class: "text-success" },
    { valueVariant: "success-badge", active: false, class: "text-success border-success/30 bg-success/10" },
    { valueVariant: "muted", active: false, class: "text-muted-foreground/60" },
    { valueVariant: "default", active: true, class: "text-current" },
    { valueVariant: "success", active: true, class: "text-current" },
    { valueVariant: "muted", active: true, class: "text-current" },
    { valueVariant: "success-badge", active: true, class: "border-success bg-success text-success-foreground" },
  ],
  defaultVariants: { valueVariant: "default", focused: false, active: false },
});
