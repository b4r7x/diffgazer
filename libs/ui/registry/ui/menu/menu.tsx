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

export interface MenuProps<TId extends string = string>
  extends Omit<ComponentPropsWithRef<"div">, "children" | "onKeyDown" | "onSelect"> {
  selectedId?: TId | null;
  defaultSelectedId?: TId | null;
  highlighted?: TId | null;
  defaultHighlighted?: TId | null;
  onSelect?: (id: TId) => void;
  onHighlightChange?: (value: TId | null) => void;
  onClose?: () => void;
  variant?: "default" | "hub";
  wrap?: boolean;
  children: ReactNode;
  autoFocus?: boolean;
  onKeyDown?: (event: KeyboardEvent) => void;
}

/**
 * Listbox-style menu with arrow-key navigation, typeahead, and Enter/Space
 * activation. Use `MenuItem` for entries and `MenuDivider` to separate
 * groups. Pair `selectedId` / `defaultSelectedId` with `onSelect` to mark a
 * single item as active (role becomes `menuitemradio`); omit it for a plain
 * action menu.
 *
 * @example
 * ```tsx
 * <Menu aria-label="File actions" onSelect={(id) => runAction(id)}>
 *   <Menu.Item id="new">New file</Menu.Item>
 *   <Menu.Item id="open">Open...</Menu.Item>
 *   <Menu.Item id="save">Save</Menu.Item>
 *   <Menu.Divider />
 *   <Menu.Item id="delete" variant="danger">Delete</Menu.Item>
 * </Menu>
 * ```
 *
 * @example
 * ```tsx
 * const [branch, setBranch] = useState("main");
 * <Menu
 *   aria-label="Branch"
 *   selectedId={branch}
 *   onSelect={setBranch}
 * >
 *   <Menu.Item id="main">main</Menu.Item>
 *   <Menu.Item id="develop">develop</Menu.Item>
 * </Menu>
 * ```
 */
export function Menu<TId extends string = string>({
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
}: MenuProps<TId>) {
  const idPrefix = useId();
  const selectionEnabled = controlledSelectedId !== undefined || defaultSelectedId !== null;
  const itemRole = selectionEnabled ? "menuitemradio" : "menuitem";
  const items = useMemo(() => collectListboxItems<TId>(children, MenuItem), [children]);

  const {
    selectedId,
    highlighted,
    handleItemActivate,
    handleItemHighlight,
    getContainerProps,
  } = useListbox<TId>({
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

  // Public TId narrows the API; internal context stays string-keyed because the
  // DOM uses data-value strings and child MenuItem ids are opaque to TS.
  const contextValue: MenuContextValue = useMemo(
    () => ({
      selectedId,
      highlighted,
      activate: handleItemActivate as (id: string) => void,
      highlight: handleItemHighlight as (id: string) => void,
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
