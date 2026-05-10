"use client";

import { Children, isValidElement, type ComponentPropsWithRef, type ReactNode, type KeyboardEvent, useId, useMemo, useRef } from "react";
import { getEncodedListboxItemId, useListbox } from "@/hooks/use-listbox";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { NavigationListContext } from "./navigation-list-context";
import { NavigationListItem } from "./navigation-list-item";

export interface NavigationListProps
  extends Omit<ComponentPropsWithRef<"div">, "children" | "onKeyDown" | "onSelect"> {
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  highlightedId?: string | null;
  defaultHighlightedId?: string | null;
  onSelect?: (id: string) => void;
  onEnter?: (id: string, event: globalThis.KeyboardEvent) => void;
  onHighlightChange?: (id: string) => void;
  onNavigationBoundaryReached?: (direction: "previous" | "next") => void;
  focused?: boolean;
  wrap?: boolean;
  autoFocus?: boolean;
  children: ReactNode;
  onKeyDown?: (event: KeyboardEvent) => void;
}

interface NavigationListItemElementProps {
  id?: string;
  disabled?: boolean;
  children?: ReactNode;
}

function collectNavigationItems(children: ReactNode): Array<{ id: string; disabled?: boolean }> {
  const items: Array<{ id: string; disabled?: boolean }> = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<NavigationListItemElementProps>(child)) return;
    if (child.type === NavigationListItem && typeof child.props.id === "string") {
      items.push({ id: child.props.id, disabled: child.props.disabled });
      return;
    }
    items.push(...collectNavigationItems(child.props.children));
  });

  return items;
}

export function NavigationList({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  highlightedId: controlledHighlightedId,
  defaultHighlightedId = null,
  onSelect,
  onEnter,
  onHighlightChange,
  onNavigationBoundaryReached,
  focused = true,
  wrap = true,
  autoFocus = false,
  className,
  children,
  onKeyDown,
  "aria-label": ariaLabel,
  ref,
  ...rootProps
}: NavigationListProps) {
  const idPrefix = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const items = useMemo(() => collectNavigationItems(children), [children]);

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
    onEnter,
    onHighlightChange,
    onNavigationBoundaryReached,
    wrap,
    idPrefix,
    autoFocus,
    onKeyDown,
    typeahead: true,
    items,
    getItemId: getEncodedListboxItemId,
  });

  const contextValue = useMemo(
    () => ({
      selectedId,
      highlightedId,
      activate: handleItemActivate,
      highlight: handleItemHighlight,
      focusContainer: () => containerRef.current?.focus(),
      focused,
      idPrefix,
    }),
    [selectedId, highlightedId, handleItemActivate, handleItemHighlight, focused, idPrefix],
  );

  return (
    <NavigationListContext value={contextValue}>
      <div
        {...rootProps}
        {...getContainerProps(composeRefs(containerRef, ref))}
        aria-label={ariaLabel}
        aria-orientation="vertical"
        className={cn("w-full outline-none", className)}
      >
        {children}
      </div>
    </NavigationListContext>
  );
}
