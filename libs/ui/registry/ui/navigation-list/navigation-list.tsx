"use client";

import { type ReactNode, type KeyboardEvent, type Ref, useId, useMemo } from "react";
import { useListbox } from "@/hooks/use-listbox";
import { cn } from "@/lib/utils";
import { NavigationListContext } from "./navigation-list-context";

export interface NavigationListProps {
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  highlightedId?: string | null;
  defaultHighlightedId?: string | null;
  onSelect?: (id: string) => void;
  onHighlightChange?: (id: string) => void;
  focused?: boolean;
  wrap?: boolean;
  className?: string;
  children: ReactNode;
  onKeyDown?: (event: KeyboardEvent) => void;
  "aria-label"?: string;
  ref?: Ref<HTMLDivElement>;
}

export function NavigationList({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  highlightedId: controlledHighlightedId,
  defaultHighlightedId = null,
  onSelect,
  onHighlightChange,
  focused = true,
  wrap = true,
  className,
  children,
  onKeyDown,
  "aria-label": ariaLabel,
  ref,
}: NavigationListProps) {
  const idPrefix = useId();

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
    onKeyDown,
    typeahead: true,
  });

  const contextValue = useMemo(
    () => ({
      selectedId,
      highlightedId,
      activate: handleItemActivate,
      highlight: handleItemHighlight,
      focused,
      idPrefix,
    }),
    [selectedId, highlightedId, handleItemActivate, handleItemHighlight, focused, idPrefix],
  );

  return (
    <NavigationListContext value={contextValue}>
      <div
        {...getContainerProps(ref)}
        aria-label={ariaLabel}
        aria-orientation="vertical"
        className={cn("w-full outline-none", className)}
      >
        {children}
      </div>
    </NavigationListContext>
  );
}
