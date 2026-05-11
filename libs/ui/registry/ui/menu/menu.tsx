"use client";

import {
  type ReactNode,
  type KeyboardEvent,
  type ComponentPropsWithRef,
  useId,
  useMemo,
} from "react";
import { collectListboxItems, getEncodedListboxItemId, useListbox } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { MenuContext, type MenuContextValue } from "./menu-context";
import { MenuItem } from "./menu-item";

export interface MenuProps
  extends Omit<ComponentPropsWithRef<"div">, "children" | "onKeyDown" | "onSelect"> {
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  highlighted?: string | null;
  defaultHighlighted?: string | null;
  onSelect?: (id: string) => void;
  onHighlightChange?: (value: string) => void;
  onClose?: () => void;
  variant?: "default" | "hub";
  wrap?: boolean;
  children: ReactNode;
  autoFocus?: boolean;
  onKeyDown?: (event: KeyboardEvent) => void;
}

export function Menu({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  highlighted: controlledHighlighted,
  defaultHighlighted = null,
  onSelect,
  onHighlightChange,
  onClose,
  variant = "default",
  wrap = true,
  className,
  "aria-label": ariaLabel,
  autoFocus,
  children,
  onKeyDown,
  ref,
  ...rootProps
}: MenuProps) {
  const idPrefix = useId();
  const selectionEnabled = controlledSelectedId !== undefined || defaultSelectedId !== null;
  const itemRole = selectionEnabled ? "menuitemradio" : "menuitem";
  const items = useMemo(() => collectListboxItems(children, MenuItem), [children]);

  const {
    selectedId,
    highlighted,
    handleItemActivate,
    handleItemHighlight,
    getContainerProps,
  } = useListbox({
    selectedId: selectionEnabled ? controlledSelectedId : null,
    defaultSelectedId: selectionEnabled ? defaultSelectedId : null,
    highlighted: controlledHighlighted,
    defaultHighlighted,
    onSelect,
    onHighlightChange,
    wrap,
    idPrefix,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "Tab") onClose?.();
      onKeyDown?.(e);
    },
    role: "menu",
    itemRole,
    typeahead: true,
    autoFocus,
    items,
    getItemId: getEncodedListboxItemId,
  });

  const contextValue: MenuContextValue = useMemo(
    () => ({
      selectedId,
      highlighted,
      activate: handleItemActivate,
      highlight: handleItemHighlight,
      variant,
      idPrefix,
      itemRole,
    }),
    [selectedId, highlighted, handleItemActivate, handleItemHighlight, variant, idPrefix, itemRole],
  );

  return (
    <MenuContext value={contextValue}>
      <div
        {...rootProps}
        {...getContainerProps(ref)}
        aria-label={ariaLabel}
        className={cn("w-full relative outline-none", className)}
      >
        {children}
      </div>
    </MenuContext>
  );
}
