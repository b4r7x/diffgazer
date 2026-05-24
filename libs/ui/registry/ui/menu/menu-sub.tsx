"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type FocusEvent,
  type ReactNode,
  type RefObject,
  type Ref,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { useControllableState } from "@/hooks/use-controllable-state";
import { getEncodedListboxItemId } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { composeRefs } from "@/lib/compose-refs";
import { FloatingPanel } from "../floating-panel/floating-panel";
import { useMenuContext } from "./menu-context";
import { Menu as MenuRoot } from "./menu";

// ---------------------------------------------------------------------------
// MenuSubContext
// ---------------------------------------------------------------------------

interface MenuSubContextValue {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  triggerRef: RefObject<HTMLDivElement | null>;
  triggerId: string;
}

const MenuSubContext = createContext<MenuSubContextValue | undefined>(undefined);

function useMenuSubContext(): MenuSubContextValue {
  const ctx = useContext(MenuSubContext);
  if (ctx === undefined) {
    throw new Error("MenuSub parts must be used within a MenuSub");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// MenuSub
// ---------------------------------------------------------------------------

export interface MenuSubProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function MenuSub({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange: onOpenChangeProp,
  children,
}: MenuSubProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();

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
      triggerId,
    }),
    [openState, setOpenState, triggerId],
  );

  return (
    <MenuSubContext value={ctx}>{children}</MenuSubContext>
  );
}

// ---------------------------------------------------------------------------
// MenuSubTrigger
// ---------------------------------------------------------------------------

const SUB_CHEVRON = "▶";
const INDICATOR_ACTIVE = "▌";
const INDICATOR_IDLE = ">";

export const menuSubTriggerBase = cva("cursor-pointer w-full transition-colors px-4 py-3 flex items-center font-mono duration-75", {
  variants: {
    state: {
      normal: "hover:bg-secondary group",
      focused: "font-bold bg-primary text-primary-foreground",
    },
  },
  defaultVariants: { state: "normal" },
});

export type MenuSubTriggerVariantProps = VariantProps<typeof menuSubTriggerBase>;

export interface MenuSubTriggerProps {
  id: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

export function MenuSubTrigger({
  id,
  disabled = false,
  children,
  className,
  ref,
}: MenuSubTriggerProps) {
  const { highlighted, highlight, idPrefix, itemRole, registerActivator, unregisterActivator } = useMenuContext();
  const { open, onOpenChange, triggerRef } = useMenuSubContext();

  useEffect(() => {
    const openSubmenu = () => {
      if (!disabled) onOpenChange(true);
    };
    registerActivator(id, openSubmenu);
    return () => unregisterActivator(id);
  }, [id, disabled, onOpenChange, registerActivator, unregisterActivator]);

  const isFocused = highlighted === id;
  const itemId = getEncodedListboxItemId(idPrefix, id);
  const state = isFocused ? "focused" : "normal";

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
    <div
      ref={composeRefs(triggerRef, ref)}
      id={itemId}
      role={itemRole}
      tabIndex={-1}
      data-diffgazer-navigation-item="true"
      data-value={id}
      data-active={isFocused || undefined}
      data-focus={isFocused || undefined}
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
          isFocused ? undefined : "transition-opacity opacity-0 group-hover:opacity-100 text-foreground",
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

// ---------------------------------------------------------------------------
// MenuSubContent
// ---------------------------------------------------------------------------

export interface MenuSubContentProps {
  children: ReactNode;
  className?: string;
  sideOffset?: number;
}

export function MenuSubContent({
  children,
  className,
  sideOffset = 0,
}: MenuSubContentProps) {
  const { open, onOpenChange, triggerRef } = useMenuSubContext();
  const parentMenu = useMenuContext();

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

  const handleSubmenuKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      returnFocusToParent();
      return;
    }
    if (event.key === "Escape") {
      event.stopPropagation();
      returnFocusToParent();
      return;
    }
  };

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
        aria-label="Submenu"
        autoFocus={open}
        onClose={dismissSubmenu}
        onKeyDown={handleSubmenuKeyDown}
      >
        {children}
      </MenuRoot>
    </FloatingPanel>
  );
}
