"use client";

import { Children, isValidElement, type ComponentPropsWithRef, type ReactNode, type KeyboardEvent, useId, useMemo, useRef } from "react";
import { type ListboxMetadataItem, getEncodedListboxItemId, useListbox } from "@/hooks/use-listbox";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { NavigationListContext, type NavigationListIndicator } from "./navigation-list-context";
import { NavigationListItem } from "./navigation-list-item";

function collectNavigationListItems(children: ReactNode): ListboxMetadataItem[] {
  const items: ListboxMetadataItem[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<{ id?: string; disabled?: boolean; children?: ReactNode }>(child)) return;

    if (child.type === NavigationListItem && typeof child.props.id === "string") {
      items.push({ id: child.props.id, disabled: child.props.disabled });
      return;
    }

    // Always collect items from groups regardless of expanded state.
    // Collapsed groups hide children from the DOM, so useNavigation's
    // DOM queries naturally exclude them from keyboard navigation.
    // The metadata list is only used for active-descendant resolution
    // and initial highlight — both safe with a superset.
    if (child.props.children) {
      items.push(...collectNavigationListItems(child.props.children));
    }
  });

  return items;
}

export interface NavigationListProps
  extends Omit<ComponentPropsWithRef<"div">, "children" | "onKeyDown" | "onSelect"> {
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  highlighted?: string | null;
  defaultHighlighted?: string | null;
  onSelect?: (id: string) => void;
  onEnter?: (id: string, event: globalThis.KeyboardEvent) => void;
  onHighlightChange?: (id: string | null) => void;
  onNavigationBoundaryReached?: (
    direction: "previous" | "next",
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
  indicator?: NavigationListIndicator;
  focused?: boolean;
  wrap?: boolean;
  autoFocus?: boolean;
  children: ReactNode;
  onKeyDown?: (event: KeyboardEvent) => void;
}

export function NavigationList({
  selectedId: controlledSelectedId,
  defaultSelectedId = null,
  highlighted: controlledHighlighted,
  defaultHighlighted = null,
  onSelect,
  onEnter,
  onHighlightChange,
  onNavigationBoundaryReached,
  indicator = "bar",
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
  const items = useMemo(() => collectNavigationListItems(children), [children]);

  const {
    selectedId,
    highlighted,
    handleItemActivate,
    handleItemHighlight,
    getContainerProps,
  } = useListbox({
    selectedId: controlledSelectedId,
    defaultSelectedId,
    highlighted: controlledHighlighted,
    defaultHighlighted,
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
      highlighted,
      activate: handleItemActivate,
      highlight: handleItemHighlight,
      focusContainer: () => containerRef.current?.focus(),
      focused,
      idPrefix,
      indicator,
    }),
    [selectedId, highlighted, handleItemActivate, handleItemHighlight, focused, idPrefix, indicator],
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
