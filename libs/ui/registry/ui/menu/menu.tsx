"use client";

import {
  Children,
  type ComponentPropsWithRef,
  type ElementType,
  isValidElement,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useRef,
} from "react";
import { getEncodedListboxItemId, type ListboxMetadataItem, useListbox } from "@/hooks/use-listbox";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { type CustomActivator, MenuContext, type MenuContextValue } from "./menu-context";
import { MenuItem } from "./menu-item";
import { MenuItemCheckbox } from "./menu-item-checkbox";
import { MenuItemRadio } from "./menu-item-radio";
import { MenuSubContent, MenuSubTrigger } from "./menu-sub";

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

const MENU_ITEM_TYPES: ElementType[] = [MenuItem, MenuItemCheckbox, MenuItemRadio, MenuSubTrigger];

function collectMenuItems<TId extends string = string>(
  children: ReactNode,
): ListboxMetadataItem<TId>[] {
  const items: ListboxMetadataItem<TId>[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<{ id?: string; disabled?: boolean; children?: ReactNode }>(child)) return;

    if (MENU_ITEM_TYPES.includes(child.type as ElementType)) {
      if (typeof child.props.id === "string") {
        items.push({ id: child.props.id as TId, disabled: child.props.disabled });
      }
      return;
    }

    if (child.type === MenuSubContent) return;

    items.push(...collectMenuItems<TId>(child.props.children));
  });

  return items;
}

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
  const menuRef = useRef<HTMLDivElement>(null);
  const customActivators = useRef<Map<string, CustomActivator>>(new Map());
  const selectionEnabled = controlledSelectedId !== undefined || defaultSelectedId !== null;
  const itemRole = selectionEnabled ? "menuitemradio" : "menuitem";
  const items = useMemo(() => collectMenuItems<TId>(children), [children]);

  const registerActivator = useCallback((id: string, handler: CustomActivator) => {
    customActivators.current.set(id, handler);
  }, []);

  const unregisterActivator = useCallback((id: string) => {
    customActivators.current.delete(id);
  }, []);

  const { selectedId, highlighted, handleItemActivate, handleItemHighlight, getContainerProps } =
    useListbox<TId>({
      selectedId: selectionEnabled ? controlledSelectedId : null,
      defaultSelectedId: selectionEnabled ? defaultSelectedId : null,
      highlighted: controlledHighlighted,
      defaultHighlighted,
      onSelect,
      onHighlightChange,
      wrap,
      idPrefix,
      onKeyDown: (e: KeyboardEvent) => {
        if ((e.key === "Enter" || e.key === " ") && highlighted !== null) {
          const handler = customActivators.current.get(highlighted);
          if (handler) {
            e.preventDefault();
            handler();
            return;
          }
        }
        if (e.key === "ArrowRight") {
          const container = menuRef.current;
          const activeId = container?.getAttribute("aria-activedescendant");
          if (activeId) {
            const activeEl = container?.ownerDocument.getElementById(activeId);
            if (activeEl?.getAttribute("aria-haspopup") === "menu") {
              e.preventDefault();
              activeEl.click();
              return;
            }
          }
        }
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

  const wrappedActivate = useCallback(
    (id: string) => {
      const handler = customActivators.current.get(id);
      if (handler) {
        handleItemHighlight(id as TId);
        handler();
        return;
      }
      handleItemActivate(id as TId);
    },
    [handleItemActivate, handleItemHighlight],
  );

  // Public TId narrows the API; internal context stays string-keyed because the
  // DOM uses data-value strings and child MenuItem ids are opaque to TS.
  const contextValue: MenuContextValue = useMemo(
    () => ({
      selectedId,
      highlighted,
      activate: wrappedActivate,
      highlight: handleItemHighlight as (id: string) => void,
      variant,
      idPrefix,
      itemRole,
      registerActivator,
      unregisterActivator,
    }),
    [
      selectedId,
      highlighted,
      wrappedActivate,
      handleItemHighlight,
      variant,
      idPrefix,
      itemRole,
      registerActivator,
      unregisterActivator,
    ],
  );

  return (
    <MenuContext value={contextValue}>
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: getContainerProps applies role="menu"/"listbox" dynamically, which Biome cannot resolve; aria-label is valid for those roles. */}
      <div
        {...rootProps}
        {...getContainerProps(composeRefs(menuRef, ref))}
        aria-label={ariaLabel}
        className={cn("w-full relative outline-none", className)}
      >
        {children}
      </div>
    </MenuContext>
  );
}
