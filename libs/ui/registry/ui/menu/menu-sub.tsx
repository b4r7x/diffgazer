"use client";

import {
  createContext,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useIsMobile, usePointerCoarse } from "@/hooks/use-is-mobile";
import { collectListboxItems, getEncodedListboxItemId } from "@/hooks/use-listbox";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { cn } from "@/lib/utils";
import { FloatingPanel } from "../floating-panel/floating-panel";
import { Chevron } from "../icons/chevron";
import { OVERLAY_SURFACE } from "../shared/overlay-surface";
import { Menu as MenuRoot } from "./menu";
import { useMenuContext } from "./menu-context";
import { MenuGroup } from "./menu-group";
import { MenuItem } from "./menu-item";
import { MenuItemCheckbox } from "./menu-item-checkbox";
import { DefaultItemLayout } from "./menu-item-layouts";
import { MenuItemRadio } from "./menu-item-radio";
import { getItemState, menuItemBase } from "./menu-item-variants";

/** How a submenu presents itself. */
export type MenuSubMode = "flyout" | "stack" | "auto";

/** Context value shared by menu sub. */
interface MenuSubContextValue {
  /** Controlled open state for the submenu. */
  open: boolean;
  /** Fired when the submenu open state changes. */
  onOpenChange: (next: boolean) => void;
  /** Ref for the trigger element. */
  triggerRef: RefObject<HTMLDivElement | null>;
  /** DOM id for trigger item. */
  triggerItemId: string | null;
  /** Updates trigger item id. */
  setTriggerItemId: (id: string | null) => void;
  /** Resolved presentation for this submenu. */
  resolvedMode: "flyout" | "stack";
  /** Sub-trigger item id and label, published by the trigger for the back row. */
  triggerInfoRef: RefObject<{ id: string; label: ReactNode } | null>;
}

const MenuSubContext = createContext<MenuSubContextValue | undefined>(undefined);

function useMenuSubContext(): MenuSubContextValue {
  const ctx = useContext(MenuSubContext);
  if (ctx === undefined) {
    throw new Error("MenuSub parts must be used within a MenuSub");
  }
  return ctx;
}

/** Props for menu sub. */
export interface MenuSubProps {
  /** Controlled open state for the submenu. */
  open?: boolean;
  /** Initial open state for uncontrolled mode. */
  defaultOpen?: boolean;
  /** Fired when the submenu open state changes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Presentation. `"flyout"` opens a side-anchored panel; `"stack"` drills down
   * inside the parent panel with a back row. `"auto"` (default) picks `stack`
   * on touch or on a narrow viewport, where a side flyout has nowhere to go and
   * ends up shifted back over the rows it came from.
   */
  mode?: MenuSubMode;
  /** MenuSubTrigger and MenuSubContent children. */
  children: ReactNode;
}

/** Width below which a side-anchored submenu cannot clear its own parent panel. */
const STACK_VIEWPORT_BREAKPOINT = 640;

function resolveSubMode(mode: MenuSubMode, cramped: boolean): "flyout" | "stack" {
  if (mode !== "auto") return mode;
  return cramped ? "stack" : "flyout";
}

/** Submenu container (manages open state) */
export function MenuSub({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange: onOpenChangeProp,
  mode = "auto",
  children,
}: MenuSubProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [triggerItemId, setTriggerItemId] = useState<string | null>(null);
  const triggerInfoRef = useRef<{ id: string; label: ReactNode } | null>(null);
  // Both signals are resolved before the submenu ever opens, so touch and narrow
  // viewports never see a flyout frame. No new observers, no measurement pass.
  const coarsePointer = usePointerCoarse(triggerRef);
  const narrowViewport = useIsMobile(STACK_VIEWPORT_BREAKPOINT, triggerRef);
  const resolvedMode = resolveSubMode(mode, coarsePointer || narrowViewport);

  const [openState, setOpenState] = useControllableState<boolean>({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChangeProp,
  });

  const ctx = useMemo<MenuSubContextValue>(
    () => ({
      open: openState,
      onOpenChange: setOpenState,
      triggerRef,
      triggerItemId,
      setTriggerItemId,
      resolvedMode,
      triggerInfoRef,
    }),
    [openState, setOpenState, triggerItemId, resolvedMode],
  );

  return <MenuSubContext value={ctx}>{children}</MenuSubContext>;
}

/** Props for menu sub trigger. */
export interface MenuSubTriggerProps {
  /** Stable identifier for the submenu trigger item. */
  id: string;
  /** Disables the submenu trigger. */
  disabled?: boolean;
  /** Trigger label. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
}

/** Trigger item that opens the submenu. */
export function MenuSubTrigger({
  id,
  disabled = false,
  children,
  className,
  ref,
}: MenuSubTriggerProps) {
  const {
    highlighted,
    highlight,
    idPrefix,
    registerItem,
    unregisterItem,
    registerActivator,
    unregisterActivator,
  } = useMenuContext();
  const { open, onOpenChange, triggerRef, setTriggerItemId, triggerInfoRef, resolvedMode } =
    useMenuSubContext();
  const registrationId = useId();
  const composedRef = useComposedRefs(triggerRef, ref);

  const isFocused = highlighted === id;
  const itemId = getEncodedListboxItemId(idPrefix, id);
  const state = getItemState({ disabled, isFocused, isSelected: false });

  useLayoutEffect(() => {
    registerItem(registrationId, id, disabled, triggerRef.current);
    return () => unregisterItem(registrationId);
  }, [registerItem, unregisterItem, registrationId, id, disabled, triggerRef]);

  // Publish the trigger's DOM id so MenuSubContent can label itself by its
  // trigger (aria-labelledby) instead of a generic name.
  useLayoutEffect(() => {
    setTriggerItemId(itemId);
    return () => setTriggerItemId(null);
  }, [setTriggerItemId, itemId]);

  // Published through a ref, not state: the label is arbitrary JSX whose
  // identity changes every render, so storing it in state would loop.
  useLayoutEffect(() => {
    triggerInfoRef.current = { id, label: children };
  }, [triggerInfoRef, id, children]);

  useEffect(() => {
    const openSubmenu = () => {
      if (!disabled) onOpenChange(true);
    };
    registerActivator(id, openSubmenu);
    return () => unregisterActivator(id);
  }, [id, disabled, onOpenChange, registerActivator, unregisterActivator]);

  // Close an open submenu when the parent menu's highlight moves off this
  // trigger — this also enforces one open submenu per level, since opening a
  // sibling highlights that sibling and unhighlights this one. In stack mode the
  // highlight deliberately moves INTO the submenu, so the parent stack enforces
  // the one-open rule instead.
  useEffect(() => {
    if (resolvedMode === "stack") return;
    if (open && highlighted !== null && highlighted !== id) onOpenChange(false);
  }, [resolvedMode, open, highlighted, id, onOpenChange]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || disabled) return;
    onOpenChange(!open);
  };

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || disabled) return;
    highlight(id);
  };

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (disabled) event.preventDefault();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: arrow/Enter open-submenu handling is centralized on the menu container, not on this item.
    <div
      ref={composedRef}
      id={itemId}
      // APG: a submenu trigger is always a menuitem, never menuitemradio. Pinning
      // the role keeps it from inheriting the menu-wide selection itemRole, which
      // would render menuitemradio without the required aria-checked.
      role="menuitem"
      tabIndex={-1}
      data-slot="menu-sub-trigger"
      data-diffgazer-navigation-item="true"
      data-value={id}
      data-highlighted={isFocused ? "" : undefined}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-disabled={disabled || undefined}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onFocus={handleFocus}
      className={cn(menuItemBase({ menuVariant: "default", state }), className)}
    >
      <DefaultItemLayout isFocused={isFocused} isSelected={false} isDanger={false}>
        {children}
      </DefaultItemLayout>
      <Chevron size="sm" className="ml-auto" />
    </div>
  );
}

/** Props for menu sub content. */
export interface MenuSubContentProps {
  /** Menu items rendered inside the submenu floating panel. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Offset from the trigger edge in pixels. */
  sideOffset?: number;
  /** Accessible name for the menu container (role="menu"). */
  "aria-label"?: string;
  /** ID of the element that labels this component. */
  "aria-labelledby"?: string;
}

/** Floating panel for submenu content. */
export function MenuSubContent({
  children,
  className,
  sideOffset = 0,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: MenuSubContentProps) {
  const { open, onOpenChange, triggerRef, triggerItemId, resolvedMode, triggerInfoRef } =
    useMenuSubContext();
  const parentMenu = useMenuContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const isStack = resolvedMode === "stack";
  const { pushSub, popSub, activeSub, stackContainer } = parentMenu;
  const highlightRef = useRef(parentMenu.highlight);
  highlightRef.current = parentMenu.highlight;
  const triggerId = triggerInfoRef.current?.id ?? null;
  const isPushed = isStack && triggerId !== null && activeSub?.id === triggerId;
  const firstStackItemId =
    collectListboxItems(children, {
      itemTypes: [MenuItem, MenuItemCheckbox, MenuItemRadio],
      containerTypes: [MenuGroup],
    }).find((item) => !item.disabled)?.id ?? null;

  // The drill-down stack lives on the parent Menu, so publishing this submenu
  // into it is synchronisation with an external store, not derived state. The
  // cleanup pops only our own entry, so a sibling push is never clobbered.
  useEffect(() => {
    if (!isStack || !open) return;
    const info = triggerInfoRef.current;
    if (info === null) return;
    pushSub(info);
    // The trigger row is now hidden, so the highlight has to follow the user
    // into the submenu rather than point at an element that no longer exists.
    // Read through the ref: the highlight setter's identity changes with the
    // highlight itself, and depending on it would re-push on every move.
    if (firstStackItemId !== null) highlightRef.current(firstStackItemId);
    return () => popSub(info.id);
  }, [isStack, open, pushSub, popSub, triggerInfoRef, firstStackItemId]);

  // The parent pops for the back row, ArrowLeft, Escape and sibling pushes, so
  // losing the entry has to release this submenu's own open state too.
  useEffect(() => {
    if (!isPushed) return;
    return () => onOpenChange(false);
  }, [isPushed, onOpenChange]);

  const returnFocusToParent = () => {
    onOpenChange(false);
    const container = triggerRef.current?.closest('[role="menu"]') as HTMLElement | null;
    if (container) {
      container.focus({ preventScroll: true });
    }
    parentMenu.highlight(triggerRef.current?.getAttribute("data-value") ?? "");
  };

  const dismissSubmenu = () => {
    onOpenChange(false);
  };

  // Default overlay dismissal: an outside pointerdown (not on the trigger or the
  // submenu itself) closes the submenu, matching Select's FloatingPanel wiring.
  useOutsideClick(contentRef, dismissSubmenu, open, [triggerRef]);

  const handleSubmenuKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.stopPropagation();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      returnFocusToParent();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      returnFocusToParent();
      return;
    }
    if (event.key === "Escape") {
      // preventDefault so a submenu open inside a native <dialog> consumes the
      // Escape instead of also firing the dialog's cancel event.
      event.preventDefault();
      event.stopPropagation();
      returnFocusToParent();
      return;
    }
  };

  // Label the submenu by its trigger; consumer aria-label/aria-labelledby wins.
  const resolvedAriaLabelledBy =
    ariaLabelledBy ?? (ariaLabel ? undefined : (triggerItemId ?? undefined));

  if (isStack) {
    // Drill-down: the items portal into the parent panel's stack region, so they
    // inherit its surface, width and left edge verbatim and stay inside the one
    // role="menu" container — no second menu, no nested roles, no new chrome.
    if (!isPushed || stackContainer === null) return null;
    return createPortal(children, stackContainer);
  }

  return (
    <FloatingPanel
      open={open}
      triggerRef={triggerRef as RefObject<HTMLElement | null>}
      side="right"
      align="start"
      sideOffset={sideOffset}
      role="presentation"
      className={cn("min-w-[8rem]", OVERLAY_SURFACE, className)}
    >
      <MenuRoot
        ref={contentRef}
        aria-label={ariaLabel}
        aria-labelledby={resolvedAriaLabelledBy}
        autoFocus={open}
        onClose={dismissSubmenu}
        onSelect={parentMenu.notifySelect}
        onKeyDown={handleSubmenuKeyDown}
      >
        {children}
      </MenuRoot>
    </FloatingPanel>
  );
}
