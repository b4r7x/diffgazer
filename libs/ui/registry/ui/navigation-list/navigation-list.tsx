"use client";

import {
  Children,
  type ComponentPropsWithRef,
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
import {
  type GroupHeaderRegistration,
  NavigationListContext,
  type NavigationListIndicator,
} from "./navigation-list-context";
import { NavigationListGroup } from "./navigation-list-group";
import { NavigationListItem } from "./navigation-list-item";

function collectNavigationListItems(children: ReactNode): ListboxMetadataItem[] {
  const items: ListboxMetadataItem[] = [];

  Children.forEach(children, (child) => {
    if (
      !isValidElement<{
        id?: string;
        disabled?: boolean;
        children?: ReactNode;
        variant?: string;
        headerId?: string;
      }>(child)
    )
      return;

    if (child.type === NavigationListItem && typeof child.props.id === "string") {
      items.push({ id: child.props.id, disabled: child.props.disabled });
      return;
    }

    if (
      child.type === NavigationListGroup &&
      child.props.variant === "tree" &&
      typeof child.props.headerId === "string"
    ) {
      items.push({ id: child.props.headerId });
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
  const groupHeadersRef = useRef<Map<string, GroupHeaderRegistration>>(new Map());
  const items = useMemo(() => collectNavigationListItems(children), [children]);

  const handleGroupKeyDown = useCallback(
    (event: KeyboardEvent) => {
      onKeyDown?.(event);
      if (event.defaultPrevented) return;

      const key = event.key;
      if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "Enter" && key !== " ") return;

      const container = containerRef.current;
      if (!container) return;
      const activeId = container.getAttribute("aria-activedescendant");
      if (!activeId) return;

      const activeEl = container.ownerDocument.getElementById(activeId);
      if (!activeEl) return;
      const itemValue = activeEl.dataset.value;
      if (!itemValue) return;

      const registration = groupHeadersRef.current.get(itemValue);
      if (!registration) return;

      if (key === "ArrowRight") {
        if (!registration.expanded) {
          event.preventDefault();
          registration.toggle();
        }
        return;
      }

      if (key === "ArrowLeft") {
        if (registration.expanded) {
          event.preventDefault();
          registration.toggle();
        }
        return;
      }

      if (key === "Enter" || key === " ") {
        event.preventDefault();
        registration.toggle();
      }
    },
    [onKeyDown],
  );

  const { selectedId, highlighted, handleItemActivate, handleItemHighlight, getContainerProps } =
    useListbox({
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
      onKeyDown: handleGroupKeyDown,
      typeahead: true,
      items,
      getItemId: getEncodedListboxItemId,
    });

  const registerGroupHeader = useCallback((id: string, registration: GroupHeaderRegistration) => {
    groupHeadersRef.current.set(id, registration);
  }, []);

  const unregisterGroupHeader = useCallback((id: string) => {
    groupHeadersRef.current.delete(id);
  }, []);

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
      registerGroupHeader,
      unregisterGroupHeader,
      groupHeaders: groupHeadersRef.current,
    }),
    [
      selectedId,
      highlighted,
      handleItemActivate,
      handleItemHighlight,
      focused,
      idPrefix,
      indicator,
      registerGroupHeader,
      unregisterGroupHeader,
    ],
  );

  return (
    <NavigationListContext value={contextValue}>
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: getContainerProps applies role="listbox" dynamically, which Biome cannot resolve; aria-label and aria-orientation are valid for the listbox role. */}
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
