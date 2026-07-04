"use client";

import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { getEncodedListboxItemId, type ListboxMetadataItem, useListbox } from "@/hooks/use-listbox";
import { useSelectableCollection } from "@/lib/selectable-collection";
import { cn } from "@/lib/utils";
import { type CustomActivator, MenuContext, type MenuContextValue } from "./menu-context";

/**
 * @typeParam TId - Convenience assertion for the id union surfaced through
 * `selectedId`/`onSelect`/`onHighlightChange`. Ids originate from `Menu.Item`
 * children props and are asserted to `TId`, not validated; activating an
 * unregistered id warns in development (see the dev guard in `wrappedActivate`).
 */
export interface MenuProps<TId extends string = string>
  extends Omit<ComponentPropsWithRef<"div">, "aria-label" | "children" | "onKeyDown" | "onSelect"> {
  /**
   * Controlled selected item id. Pair with onSelect. Switches item role to "menuitemradio" with
   * aria-checked.
   */
  selectedId?: TId | null;
  /**
   * Initial selected id for uncontrolled mode. Setting this to a non-null value enables
   * selection semantics.
   */
  defaultSelectedId?: TId | null;
  /** Controlled highlighted (focused) item id. Pair with onHighlightChange. */
  highlighted?: TId | null;
  /** Initial highlighted id for uncontrolled mode. */
  defaultHighlighted?: TId | null;
  /** Fired when an item is activated by click, Enter, or Space. */
  onSelect?: (id: TId) => void;
  /** Fired when the highlighted item changes via arrow keys, typeahead, or mouse. */
  onHighlightChange?: (value: TId | null) => void;
  /** Fired when Escape or Tab is pressed. */
  onClose?: () => void;
  /**
   * Visual layout. `detail` renders taller, divider-separated rows with a right-aligned value
   * column, for menus where each item carries a status or summary value.
   */
  variant?: "default" | "detail";
  /** When true, arrow navigation wraps from last item to first and vice versa. */
  wrap?: boolean;
  /** MenuItem and MenuDivider children. */
  children: ReactNode;
  /** Auto-focus the menu container on mount so arrow keys work without an explicit click. */
  autoFocus?: boolean;
  /** Accessible name for the menu container. */
  "aria-label"?: string;
  /** Called after the built-in menu key handling runs. */
  onKeyDown?: (event: KeyboardEvent) => void;
}

/**
 * Terminal-styled selection list with keyboard navigation, highlighting and optional hotkey
 * indicators.
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
  const menuRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(menuRef, ref);
  const customActivators = useRef<Map<string, CustomActivator>>(new Map());
  const selectionEnabled = controlledSelectedId !== undefined || defaultSelectedId !== null;
  const itemRole = selectionEnabled ? "menuitemradio" : "menuitem";

  const { items: registeredItems, registerItem, unregisterItem } = useSelectableCollection(menuRef);
  const items = useMemo<ListboxMetadataItem<TId>[]>(
    () => registeredItems.map((item) => ({ id: item.value as TId, disabled: item.disabled })),
    [registeredItems],
  );

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
        if (e.key === "Escape" && onClose) {
          // Consume the Escape so a menu inside a native <dialog> closes only the
          // menu instead of also firing the dialog's cancel event.
          e.preventDefault();
          onClose();
        }
        if (e.key === "Tab") onClose?.();
        onKeyDown?.(e);
      },
      role: "menu",
      itemRole,
      typeahead: true,
      autoFocus,
      items,
      getItemId: getEncodedListboxItemId,
      ref: composedRef,
    });

  const wrappedActivate = useCallback(
    (id: string) => {
      const handler = customActivators.current.get(id);
      if (handler) {
        handleItemHighlight(id as TId);
        handler();
        return;
      }
      if (process.env.NODE_ENV !== "production" && !items.some((item) => item.id === id)) {
        console.warn(
          `Menu: activated item id "${id}" is not registered. Render it through <Menu.Item> so it is collected.`,
        );
      }
      handleItemActivate(id as TId);
    },
    [handleItemActivate, handleItemHighlight, items],
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
      registerItem,
      unregisterItem,
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
      registerItem,
      unregisterItem,
      registerActivator,
      unregisterActivator,
    ],
  );

  return (
    <MenuContext value={contextValue}>
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: getContainerProps applies role="menu"/"listbox" dynamically, which Biome cannot resolve; aria-label is valid for those roles. */}
      <div
        {...rootProps}
        {...getContainerProps()}
        data-slot="menu"
        aria-label={ariaLabel}
        className={cn("w-full relative outline-none", className)}
      >
        {children}
      </div>
    </MenuContext>
  );
}
