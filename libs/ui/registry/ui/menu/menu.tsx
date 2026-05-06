"use client";

import {
  type ReactNode,
  type KeyboardEvent,
  type Ref,
  useId,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { useListbox } from "@/hooks/use-listbox";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { MenuContext, type MenuContextValue } from "./menu-context";

export interface MenuProps {
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  highlightedId?: string | null;
  defaultHighlightedId?: string | null;
  onSelect?: (id: string) => void;
  onHighlightChange?: (value: string) => void;
  onClose?: () => void;
  variant?: "default" | "hub";
  wrap?: boolean;
  className?: string;
  "aria-label"?: string;
  children: ReactNode;
  autoFocus?: boolean;
  onKeyDown?: (event: KeyboardEvent) => void;
  ref?: Ref<HTMLDivElement>;
}

export function Menu({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  highlightedId: controlledHighlightedId,
  defaultHighlightedId = null,
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
}: MenuProps) {
  const idPrefix = useId();
  const localRef = useRef<HTMLDivElement>(null);
  const itemRole = controlledSelectedId !== undefined || defaultSelectedId !== null ? "menuitemradio" : "menuitem";

  const {
    selectedId,
    highlightedId,
    handleItemActivate,
    handleItemHighlight,
    getContainerProps,
  } = useListbox({
    selectedId: controlledSelectedId,
    defaultSelectedId,
    highlightedId: controlledHighlightedId,
    defaultHighlightedId,
    onSelect,
    onHighlightChange,
    wrap,
    idPrefix,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
      onKeyDown?.(e);
    },
    role: "menu",
    itemRole,
    typeahead: true,
  });

  useEffect(() => {
    if (!autoFocus) return;
    const frame = requestAnimationFrame(() => {
      const el = localRef.current;
      if (el && !el.contains(document.activeElement)) {
        el.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [autoFocus]);

  const contextValue: MenuContextValue = useMemo(
    () => ({
      selectedId,
      highlightedId,
      activate: handleItemActivate,
      highlight: handleItemHighlight,
      variant,
      idPrefix,
      itemRole,
    }),
    [selectedId, highlightedId, handleItemActivate, handleItemHighlight, variant, idPrefix, itemRole],
  );

  return (
    <MenuContext value={contextValue}>
      <div
        {...getContainerProps(composeRefs(localRef, ref))}
        aria-label={ariaLabel}
        className={cn("w-full relative outline-none", className)}
      >
        {children}
      </div>
    </MenuContext>
  );
}
