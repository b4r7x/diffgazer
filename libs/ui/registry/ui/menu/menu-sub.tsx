"use client";

import { cva, type VariantProps } from "class-variance-authority";
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
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useControllableState } from "@/hooks/use-controllable-state";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { useOutsideClick } from "@/hooks/use-outside-click";
import { cn } from "@/lib/utils";
import { FloatingPanel } from "../floating-panel/floating-panel";
import { Menu as MenuRoot } from "./menu";
import { useMenuContext } from "./menu-context";

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
  /** MenuSubTrigger and MenuSubContent children. */
  children: ReactNode;
}

/** Submenu container (manages open state) */
export function MenuSub({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange: onOpenChangeProp,
  children,
}: MenuSubProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [triggerItemId, setTriggerItemId] = useState<string | null>(null);

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
    }),
    [openState, setOpenState, triggerItemId],
  );

  return <MenuSubContext value={ctx}>{children}</MenuSubContext>;
}

const SUB_CHEVRON = "▶";
const INDICATOR_ACTIVE = "▌";
const INDICATOR_IDLE = ">";

/** menu sub trigger base API. */
export const menuSubTriggerBase = cva(
  "cursor-pointer w-full transition-colors px-4 py-3 flex items-center font-mono duration-75",
  {
    variants: {
      state: {
        normal: "hover:bg-secondary group",
        focused: "font-bold bg-primary text-primary-foreground",
      },
    },
    defaultVariants: { state: "normal" },
  },
);

/** Props for menu sub trigger variant. */
export type MenuSubTriggerVariantProps = VariantProps<typeof menuSubTriggerBase>;

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
  const { open, onOpenChange, triggerRef, setTriggerItemId } = useMenuSubContext();
  const registrationId = useId();
  const composedRef = useComposedRefs(triggerRef, ref);

  const isFocused = highlighted === id;
  const itemId = getEncodedListboxItemId(idPrefix, id);
  const state = isFocused ? "focused" : "normal";

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

  useEffect(() => {
    const openSubmenu = () => {
      if (!disabled) onOpenChange(true);
    };
    registerActivator(id, openSubmenu);
    return () => unregisterActivator(id);
  }, [id, disabled, onOpenChange, registerActivator, unregisterActivator]);

  // Close an open submenu when the parent menu's highlight moves off this
  // trigger — this also enforces one open submenu per level, since opening a
  // sibling highlights that sibling and unhighlights this one (F-341).
  useEffect(() => {
    if (open && highlighted !== null && highlighted !== id) onOpenChange(false);
  }, [open, highlighted, id, onOpenChange]);

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
      className={cn(menuSubTriggerBase({ state }), className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pr-4 shrink-0 inline-flex w-5 items-center justify-center self-center leading-none relative -top-[2px]",
          isFocused
            ? undefined
            : "transition-opacity opacity-0 group-hover:opacity-100 text-foreground",
        )}
      >
        {isFocused ? INDICATOR_ACTIVE : INDICATOR_IDLE}
      </span>
      <span className={cn("tracking-wide flex-1", !isFocused && "group-hover:text-foreground")}>
        {children}
      </span>
      <span aria-hidden="true" className="ml-2 shrink-0 text-xs">
        {SUB_CHEVRON}
      </span>
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
  const { open, onOpenChange, triggerRef, triggerItemId } = useMenuSubContext();
  const parentMenu = useMenuContext();
  const contentRef = useRef<HTMLDivElement>(null);

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
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      returnFocusToParent();
      return;
    }
    if (event.key === "Escape") {
      // preventDefault so a submenu open inside a native <dialog> consumes the
      // Escape instead of also firing the dialog's cancel (F-207).
      event.preventDefault();
      event.stopPropagation();
      returnFocusToParent();
      return;
    }
  };

  // Label the submenu by its trigger; consumer aria-label/aria-labelledby wins.
  const resolvedAriaLabelledBy =
    ariaLabelledBy ?? (ariaLabel ? undefined : (triggerItemId ?? undefined));

  return (
    <FloatingPanel
      open={open}
      triggerRef={triggerRef as RefObject<HTMLElement | null>}
      side="right"
      align="start"
      sideOffset={sideOffset}
      role="presentation"
      className={cn("min-w-[8rem] border border-border bg-background shadow-md", className)}
    >
      <MenuRoot
        ref={contentRef}
        aria-label={ariaLabel}
        aria-labelledby={resolvedAriaLabelledBy}
        autoFocus={open}
        onClose={dismissSubmenu}
        onKeyDown={handleSubmenuKeyDown}
      >
        {children}
      </MenuRoot>
    </FloatingPanel>
  );
}
